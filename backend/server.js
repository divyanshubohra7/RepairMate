const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const Groq = require("groq-sdk");
const mysql = require("mysql2/promise");
const multer = require("multer");
const ffmpegPath = require("ffmpeg-static");
const { execFile } = require("child_process");
const { promisify } = require("util");
const fs = require("fs");
const os = require("os");
const path = require("path");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const execFileAsync = promisify(execFile);

app.use(cors());
app.use(express.json({ limit: "2mb" }));

// --------------------------------------------------
// GROQ AI CONFIGURATION
// --------------------------------------------------

if (!process.env.GROQ_API_KEY) {
  console.error("ERROR: GROQ_API_KEY is missing from your .env file.");
}

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const TEXT_MODEL = "openai/gpt-oss-120b";
const VISION_MODEL = "qwen/qwen3.8-27b";

// --------------------------------------------------
// MYSQL CONNECTION
// --------------------------------------------------

const db = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "repairmate",
  port: Number(process.env.DB_PORT) || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// --------------------------------------------------
// MEDIA UPLOAD CONFIGURATION
// --------------------------------------------------

const allowedMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
  "video/quicktime",
]);

const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: 25 * 1024 * 1024,
    files: 1,
  },

  fileFilter: (req, file, callback) => {
    if (allowedMimeTypes.has(file.mimetype)) {
      return callback(null, true);
    }

    callback(
      new Error(
        "Unsupported file type. Upload a JPG, PNG, WEBP, GIF, MP4, WEBM, or MOV file."
      )
    );
  },
});

// --------------------------------------------------
// AI PROMPTS
// --------------------------------------------------

const SYSTEM_PROMPT = `
You are RepairMate, an AI-powered device and appliance repair assistant.

Help users troubleshoot electronic devices and household appliances.

You may receive information about:
- Smartphones and tablets
- Laptops and desktop computers
- Headphones and earbuds
- Smartwatches and gaming consoles
- Washing machines and refrigerators
- Air conditioners and ceiling fans
- Water pumps, microwave ovens, and air coolers
- Other electronic devices and appliances

Follow these rules:

1. Explain likely causes without pretending to know the exact fault.
2. Give safe, practical troubleshooting steps.
3. Clearly explain when professional repair is necessary.
4. Never recommend opening a device connected to electricity.
5. Never instruct users to handle exposed wiring, capacitors,
   refrigerants, or other hazardous components.
6. For gas leaks, burning smells, smoke, sparks, or electrical
   shocks, tell the user to stop using the device and seek
   qualified professional assistance.
7. If an image is provided, describe only what is visibly supported.
8. If identifying a spare part, explain its likely name, purpose,
   and what information is needed to confirm compatibility.
9. Do not invent exact part numbers, prices, or model compatibility.
10. Use clear Markdown headings, numbered steps, and bullet lists.
11. Finish with a short safety note when appropriate.
`;

// --------------------------------------------------
// HELPER: FORMAT DEVICE DETAILS
// --------------------------------------------------

function getDeviceDescription(body = {}) {
  const category = String(body.category || body.device || "Unknown device");
  const brand = String(body.brand || "Unknown brand");
  const model = String(body.model || "Unknown model");

  return `
Device category: ${category}
Brand: ${brand}
Model: ${model}
`;
}

// --------------------------------------------------
// HELPER: SAVE REPAIR TO MYSQL
// --------------------------------------------------

async function saveRepair(device, problem, diagnosis) {
  const [result] = await db.execute(
    `INSERT INTO repair_history (device, problem, diagnosis)
     VALUES (?, ?, ?)`,
    [device, problem, diagnosis]
  );

  return result.insertId;
}

// --------------------------------------------------
// BASIC HEALTH CHECK
// --------------------------------------------------

app.get("/", (req, res) => {
  res.json({
    message: "RepairMate backend is running!",
    status: "OK",
  });
});

// --------------------------------------------------
// MYSQL HEALTH CHECK
// --------------------------------------------------

app.get("/api/health", async (req, res) => {
  try {
    await db.query("SELECT 1");

    res.json({
      status: "OK",
      message: "RepairMate backend and MySQL are connected.",
    });
  } catch (error) {
    console.error("MySQL health check failed:", error.message);

    res.status(500).json({
      status: "ERROR",
      message: "Backend is running, but MySQL is unavailable.",
    });
  }
});

// --------------------------------------------------
// TEXT-BASED AI DIAGNOSIS
// POST /api/diagnose
// --------------------------------------------------

app.post("/api/diagnose", async (req, res) => {
  try {
    const { device, problem } = req.body;

    if (!device || !problem) {
      return res.status(400).json({
        error: "Please provide both device and problem.",
      });
    }

    const completion = await groq.chat.completions.create({
      model: TEXT_MODEL,

      messages: [
        {
          role: "system",
          content: SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: `
${getDeviceDescription({ device })}

Reported problem:
${problem}

Please provide:
1. Likely causes
2. Safe troubleshooting steps
3. When professional repair is needed
`,
        },
      ],

      temperature: 0.3,
      max_tokens: 1800,
    });

    const diagnosis =
      completion.choices?.[0]?.message?.content?.trim();

    if (!diagnosis) {
      return res.status(502).json({
        error: "The AI did not return a diagnosis. Please try again.",
      });
    }

    let historyId = null;

    try {
      historyId = await saveRepair(device, problem, diagnosis);
    } catch (dbError) {
      console.error("Could not save repair history:", dbError.message);
    }

    res.json({
      success: true,
      diagnosis,
      historyId,
    });
  } catch (error) {
    console.error("Text diagnosis failed:", error.message);

    res.status(500).json({
      error: "Diagnosis failed. Please try again.",
      details:
        process.env.NODE_ENV === "development"
          ? error.message
          : undefined,
    });
  }
});

// --------------------------------------------------
// HELPER: CONVERT IMAGE BUFFER TO DATA URL
// --------------------------------------------------

function imageBufferToDataUrl(buffer, mimetype) {
  return `data:${mimetype};base64,${buffer.toString("base64")}`;
}

// --------------------------------------------------
// HELPER: EXTRACT FRAMES FROM VIDEO
// NOTE: This extracts images only. It does not analyze audio.
// --------------------------------------------------

async function extractVideoFrames(videoBuffer) {
  if (!ffmpegPath) {
    throw new Error(
      "FFmpeg is unavailable. Check that ffmpeg-static is installed."
    );
  }

  const tempDirectory = await fs.promises.mkdtemp(
    path.join(os.tmpdir(), "repairmate-")
  );

  const videoPath = path.join(tempDirectory, "uploaded-video.mp4");
  const outputPattern = path.join(tempDirectory, "frame-%03d.jpg");

  try {
    await fs.promises.writeFile(videoPath, videoBuffer);

    // Extract up to three representative frames.
    await execFileAsync(
      ffmpegPath,
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        videoPath,
        "-vf",
        "fps=1/3,scale=960:-2",
        "-frames:v",
        "3",
        "-q:v",
        "5",
        outputPattern,
      ],
      {
        timeout: 60000,
        maxBuffer: 5 * 1024 * 1024,
      }
    );

    const files = (await fs.promises.readdir(tempDirectory))
      .filter((name) => /^frame-\d+\.jpg$/.test(name))
      .sort();

    if (files.length === 0) {
      throw new Error(
        "No video frames could be extracted. Try another video."
      );
    }

    const frames = [];

    for (const file of files.slice(0, 3)) {
      const buffer = await fs.promises.readFile(
        path.join(tempDirectory, file)
      );

      frames.push({
        mimetype: "image/jpeg",
        buffer,
      });
    }

    return frames;
  } finally {
    await fs.promises.rm(tempDirectory, {
      recursive: true,
      force: true,
    });
  }
}

// --------------------------------------------------
// IMAGE / VIDEO AI ANALYSIS
// POST /api/diagnose-media
//
// FormData fields:
// media: image or video
// category: device category
// brand: device brand
// model: device model
// problem: description of the problem
// mode: diagnosis or parts
// --------------------------------------------------

app.post(
  "/api/diagnose-media",
  upload.single("media"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          error: "Please upload an image or video.",
        });
      }

      const {
        category = "Unknown device",
        brand = "Unknown brand",
        model = "Unknown model",
        problem = "",
        mode = "diagnosis",
      } = req.body;

      const isVideo = req.file.mimetype.startsWith("video/");

      let images = [];

      if (isVideo) {
        images = await extractVideoFrames(req.file.buffer);
      } else {
        images = [
          {
            mimetype: req.file.mimetype,
            buffer: req.file.buffer,
          },
        ];
      }

      const imageContent = images.map((image) => ({
        type: "image_url",
        image_url: {
          url: imageBufferToDataUrl(image.buffer, image.mimetype),
        },
      }));

      let taskInstructions;

      if (mode === "parts") {
        taskInstructions = `
Analyze the uploaded ${isVideo ? "video frames" : "image"} to help
identify visible device components or spare parts.

Please provide:
1. **Likely part identification** — name the component if possible.
2. **Visual evidence** — explain what you can actually see.
3. **Purpose** — what the component normally does.
4. **Possible issue** — only if supported by the visual evidence.
5. **Compatibility information** — what model or part number is
   needed to confirm the correct replacement.
6. **Safety guidance** — whether professional inspection is advisable.

Do not claim an exact identification when the image is unclear.
Do not invent part numbers or guarantee compatibility.
`;
      } else {
        taskInstructions = `
Diagnose the reported device problem using the uploaded
${isVideo ? "video frames" : "image"} and the user's description.

Please provide:
1. **What is visible**
2. **Likely causes**
3. **Safe troubleshooting steps**
4. **When professional repair is needed**
5. **Additional information needed**, if the cause is uncertain.

Be clear about the limits of visual diagnosis.
`;
      }

      const userContent = [
        {
          type: "text",
          text: `
${getDeviceDescription({ category, brand, model })}

User's description:
${problem || "No additional description provided."}

${taskInstructions}

Important: A video is represented by a small number of extracted
visual frames. Do not claim to have heard or analyzed its audio.
`,
        },
        ...imageContent,
      ];

      const completion = await groq.chat.completions.create({
        model: VISION_MODEL,

        messages: [
          {
            role: "system",
            content: SYSTEM_PROMPT,
          },
          {
            role: "user",
            content: userContent,
          },
        ],

        temperature: 0.2,
        max_tokens: 1800,
      });

      const diagnosis =
        completion.choices?.[0]?.message?.content?.trim();

      if (!diagnosis) {
        return res.status(502).json({
          error: "The AI did not return an analysis. Please try again.",
        });
      }

      const deviceDescription = [category, brand, model]
        .filter(
          (value) =>
            value &&
            !["Unknown device", "Unknown brand", "Unknown model"].includes(
              value
            )
        )
        .join(" ");

      const historyDevice = deviceDescription || "Unknown device";

      const historyProblem = [
        isVideo ? "[Video uploaded]" : "[Image uploaded]",
        mode === "parts" ? "[Spare-parts identification]" : "[Diagnosis]",
        problem,
      ]
        .filter(Boolean)
        .join(" ");

      let historyId = null;

      try {
        historyId = await saveRepair(
          historyDevice,
          historyProblem,
          diagnosis
        );
      } catch (dbError) {
        console.error("Could not save media repair history:", dbError.message);
      }

      res.json({
        success: true,
        diagnosis,
        historyId,
        mediaType: isVideo ? "video" : "image",
        mode,
        framesAnalyzed: images.length,
      });
    } catch (error) {
      console.error("Media analysis failed:", error.message);

      res.status(500).json({
        error: "Image/video analysis failed. Please try again.",
        details:
          process.env.NODE_ENV === "development"
            ? error.message
            : undefined,
      });
    }
  }
);

// --------------------------------------------------
// GET ALL DEVICES
// GET /api/devices
// --------------------------------------------------

app.get("/api/devices", async (req, res) => {
  try {
    const [rows] = await db.execute(
      "SELECT * FROM devices ORDER BY id DESC"
    );

    res.json(rows);
  } catch (error) {
    console.error("Get devices failed:", error.message);

    res.status(500).json({
      error: "Could not fetch devices.",
    });
  }
});

// --------------------------------------------------
// ADD A DEVICE
// POST /api/devices
// --------------------------------------------------

app.post("/api/devices", async (req, res) => {
  try {
    const { name, brand, model, category } = req.body;

    if (!name || !brand || !model) {
      return res.status(400).json({
        error: "Name, brand, and model are required.",
      });
    }

    const [result] = await db.execute(
      `INSERT INTO devices (name, brand, model, category)
       VALUES (?, ?, ?, ?)`,
      [name, brand, model, category || null]
    );

    res.status(201).json({
      success: true,
      message: "Device added successfully.",
      id: result.insertId,
    });
  } catch (error) {
    console.error("Add device failed:", error.message);

    res.status(500).json({
      error: "Could not add device.",
    });
  }
});

// --------------------------------------------------
// DELETE A DEVICE
// DELETE /api/devices/:id
// --------------------------------------------------

app.delete("/api/devices/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        error: "Invalid device ID.",
      });
    }

    const [result] = await db.execute(
      "DELETE FROM devices WHERE id = ?",
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        error: "Device not found.",
      });
    }

    res.json({
      success: true,
      message: "Device deleted successfully.",
    });
  } catch (error) {
    console.error("Delete device failed:", error.message);

    res.status(500).json({
      error: "Could not delete device.",
    });
  }
});

// --------------------------------------------------
// GET REPAIR HISTORY
// GET /api/history
// --------------------------------------------------

app.get("/api/history", async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT id, device, problem, diagnosis, status, created_at
       FROM repair_history
       ORDER BY created_at DESC, id DESC`
    );

    res.json(rows);
  } catch (error) {
    console.error("Get repair history failed:", error.message);

    res.status(500).json({
      error: "Could not fetch repair history.",
    });
  }
});

// --------------------------------------------------
// DELETE ONE REPAIR HISTORY RECORD
// DELETE /api/history/:id
//
// IMPORTANT: This route must appear only once.
// --------------------------------------------------

app.delete("/api/history/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        error: "Invalid history ID.",
      });
    }

    const [result] = await db.execute(
      "DELETE FROM repair_history WHERE id = ?",
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        error: "Repair history record not found.",
      });
    }

    res.json({
      success: true,
      message: "Repair history deleted successfully.",
      id,
    });
  } catch (error) {
    console.error("Delete repair history failed:", error.message);

    res.status(500).json({
      error: "Could not delete repair history.",
    });
  }
});

// --------------------------------------------------
// MULTER / GENERAL ERROR HANDLER
// --------------------------------------------------

app.use((error, req, res, next) => {
  console.error("Request error:", error.message);

  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({
        error: "File is too large. Maximum upload size is 25 MB.",
      });
    }

    return res.status(400).json({
      error: error.message,
    });
  }

  if (
    error.message &&
    error.message.startsWith("Unsupported file type")
  ) {
    return res.status(400).json({
      error: error.message,
    });
  }

  res.status(500).json({
    error: "An unexpected server error occurred.",
    details:
      process.env.NODE_ENV === "development"
        ? error.message
        : undefined,
  });
});

// --------------------------------------------------
// START SERVER
// --------------------------------------------------

async function startServer() {
  try {
    const connection = await db.getConnection();

    console.log("MySQL connected successfully!");

    connection.release();

    app.listen(PORT, () => {
      console.log(`RepairMate backend running at http://localhost:${PORT}`);
      console.log("Text diagnosis: POST /api/diagnose");
      console.log("Image/video analysis: POST /api/diagnose-media");
      console.log("Repair history: GET /api/history");
    });
  } catch (error) {
    console.error("MySQL connection failed:", error.message);
    console.error(
      "Check your MySQL service, database name, and backend .env settings."
    );

    process.exit(1);
  }
}

startServer();