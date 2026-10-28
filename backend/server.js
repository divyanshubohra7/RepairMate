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
const HEALTH_UPLOAD_DIR = path.join(__dirname, "health-uploads");

fs.mkdirSync(HEALTH_UPLOAD_DIR, { recursive: true });

const healthStorage = multer.diskStorage({
  destination: (req, file, callback) => {
    callback(null, HEALTH_UPLOAD_DIR);
  },

  filename: (req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    const uniqueName = `health-${Date.now()}-${require("crypto").randomUUID()}${extension}`;

    callback(null, uniqueName);
  },
});

const healthUpload = multer({
  storage: healthStorage,

  limits: {
    fileSize: 25 * 1024 * 1024,
    files: 1,
  },

  fileFilter: (req, file, callback) => {
    if (allowedMimeTypes.has(file.mimetype)) {
      return callback(null, true);
    }

    callback(new Error("Unsupported image or video format."));
  },
});

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
You are RepairMate, an AI-powered device and appliance repair assistant serving users in India.

Help users troubleshoot electronic devices and household appliances, including smartphones, laptops, headphones, smartwatches, washing machines, refrigerators, air conditioners, fans, gaming consoles, and other devices.

Follow these rules:

1. Explain likely causes without pretending to know the exact fault.
2. Give safe, practical troubleshooting steps.
3. Clearly explain when professional repair is necessary.
4. Never recommend opening a device connected to electricity.
5. Never instruct users to handle exposed wiring, capacitors, refrigerants, or other hazardous components.
6. For gas leaks, burning smells, smoke, sparks, or electrical shocks, tell the user to stop using the device and seek qualified professional assistance.
7. If an image is provided, describe only what is visibly supported.
8. If identifying a spare part, explain its likely name, purpose, and what information is needed to confirm compatibility.
9. Never invent exact part numbers, prices, or model compatibility.
10. Use clear Markdown headings, numbered steps, and bullet lists.
11. Always include an Estimated Repair Cost (India) section when providing a diagnosis.
12. Express all estimated repair prices in Indian Rupees (₹), not dollars or other currencies.
13. Provide a realistic approximate minimum-to-maximum price range for the likely repair, such as ₹500–₹1,500, when enough information is available.
14. When multiple faults are plausible, give separate estimated ranges for the most likely repairs.
15. Mention whether the estimate includes parts and labour when reasonably known.
16. If the device model or fault is unknown, clearly label the price as a rough estimate and explain that the actual cost depends on the model, replacement parts, labour, and local repair-shop rates.
17. Never present an AI-generated estimate as a verified quotation or guaranteed price. If you cannot reasonably estimate the cost, explain why and ask for more details.
18. Include these sections in a normal diagnosis:
    * Likely Causes
    * Safe Troubleshooting Steps
    * Estimated Repair Cost (India)
    * When Professional Repair Is Needed
19. For spare-parts identification, provide a price estimate only when reasonably possible. Explain that compatibility must be confirmed before purchasing.
20. Finish with a short safety note when appropriate.
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
1. Likely causes of the reported problem.
2. Safe troubleshooting steps.
3. Estimated Repair Cost (India), using approximate price ranges in Indian Rupees (₹).
4. The likely repair required and whether the estimate includes parts and labour, when known.
5. When professional repair is needed.

Clearly label costs as estimates, not guaranteed quotations. Explain when the device model or additional information is needed for a more accurate estimate.
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
    const { category, brand, model, nickname } = req.body;

    if (!category || !brand || !model) {
      return res.status(400).json({
        error: "Category, brand, and model are required.",
      });
    }

    const [result] = await db.execute(
      `INSERT INTO devices (category, brand, model, nickname)
       VALUES (?, ?, ?, ?)`,
      [
        category.trim(),
        brand.trim(),
        model.trim(),
        nickname?.trim() || null,
      ]
    );

    const [rows] = await db.execute(
      "SELECT * FROM devices WHERE id = ?",
      [result.insertId]
    );

    return res.status(201).json({
      message: "Device registered successfully.",
      device: rows[0],
    });
  } catch (error) {
    console.error("Device registration error:", error);

    return res.status(500).json({
      error: "Failed to register device. Please try again.",
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
// MACHINE HEALTH MONITORING
// --------------------------------------------------

// POST /api/health-records
// Upload media and analyze the device's visible condition.
//
// FormData:
// device_id: registered device ID
// checkpoint_day: 1, 7, 14, or 28
// problem: optional description
// media: image or video

app.post(
  "/api/health-records",
  healthUpload.single("media"),
  async (req, res) => {
    let savedFilePath = null;

    try {
      if (!req.file) {
        return res.status(400).json({
          error: "Please upload an image or video.",
        });
      }

      savedFilePath = req.file.path;

      const deviceId = Number(req.body.device_id);
      const checkpointDay = Number(req.body.checkpoint_day);
      const problem = String(req.body.problem || "").trim();

      if (!Number.isInteger(deviceId) || deviceId <= 0) {
        return res.status(400).json({
          error: "A valid device_id is required.",
        });
      }

      if (![1, 7, 14, 28].includes(checkpointDay)) {
        return res.status(400).json({
          error: "checkpoint_day must be 1, 7, 14, or 28.",
        });
      }

      const [devices] = await db.execute(
        "SELECT * FROM devices WHERE id = ?",
        [deviceId]
      );

      if (devices.length === 0) {
        return res.status(404).json({
          error: "Device not found.",
        });
      }

      const device = devices[0];
      const isVideo = req.file.mimetype.startsWith("video/");

      let images;

      if (isVideo) {
        const videoBuffer = await fs.promises.readFile(savedFilePath);
        images = await extractVideoFrames(videoBuffer);
      } else {
        images = [
          {
            mimetype: req.file.mimetype,
            buffer: await fs.promises.readFile(savedFilePath),
          },
        ];
      }

      const imageContent = images.map((image) => ({
        type: "image_url",
        image_url: {
          url: imageBufferToDataUrl(
            image.buffer,
            image.mimetype
          ),
        },
      }));

      const prompt = `
You are analyzing a device for RepairMate's Machine Health Monitoring feature.

Device category: ${device.category || "Unknown"}
Brand: ${device.brand || "Unknown"}
Model: ${device.model || "Unknown"}
Checkpoint: Day ${checkpointDay}

User's observations:
${problem || "No additional observations provided."}

Analyze only the visible evidence in the uploaded image or extracted video frames.

Return a useful report containing:
1. **Visible condition:** What can actually be seen?
2. **Potential concerns:** Any visible wear, cracks, corrosion, damage, leakage, or other relevant signs.
3. **Recommended actions:** Safe steps the user can take.
4. **Monitoring recommendation:** What should be checked at the next checkpoint?
5. **Limitations:** What cannot be determined from these images?

Do not invent previous observations or claim a change without an earlier record to compare.
Do not claim to analyze audio or detect sounds.
Do not claim to determine the condition of internal components from external images alone.
Use clear Markdown.
`;

      const completion = await groq.chat.completions.create({
        model: VISION_MODEL,

        messages: [
          {
            role: "system",
            content: SYSTEM_PROMPT,
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: prompt,
              },
              ...imageContent,
            ],
          },
        ],

        temperature: 0.2,
        max_tokens: 1800,
      });

      const observations =
        completion.choices?.[0]?.message?.content?.trim();

      if (!observations) {
        throw new Error("AI returned an empty health report.");
      }

      const [result] = await db.execute(
        `INSERT INTO health_records
          (device_id, checkpoint_day, media_type, file_path, observations)
         VALUES (?, ?, ?, ?, ?)`,
        [
          deviceId,
          checkpointDay,
          isVideo ? "video" : "image",
          savedFilePath,
          observations,
        ]
      );

      res.status(201).json({
        success: true,
        message: "Health record created successfully.",
        record: {
          id: result.insertId,
          device_id: deviceId,
          checkpoint_day: checkpointDay,
          media_type: isVideo ? "video" : "image",
          observations,
          created_at: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error("Create health record failed:", error.message);

      // Remove the uploaded file if processing failed.
      if (savedFilePath) {
        await fs.promises.unlink(savedFilePath).catch(() => {});
      }

      res.status(500).json({
        error: "Could not create health record.",
        details:
          process.env.NODE_ENV === "development"
            ? error.message
            : undefined,
      });
    }
  }
);

// GET /api/health-records/:deviceId
// Retrieve the health timeline for one device.

app.get("/api/health-records/:deviceId", async (req, res) => {
  try {
    const deviceId = Number(req.params.deviceId);

    if (!Number.isInteger(deviceId) || deviceId <= 0) {
      return res.status(400).json({
        error: "Invalid device ID.",
      });
    }

    const [rows] = await db.execute(
      `SELECT
          id,
          device_id,
          checkpoint_day,
          media_type,
          observations,
          created_at
       FROM health_records
       WHERE device_id = ?
       ORDER BY checkpoint_day ASC, created_at ASC, id ASC`,
      [deviceId]
    );

    res.json({
      success: true,
      records: rows,
    });
  } catch (error) {
    console.error("Get health timeline failed:", error.message);

    res.status(500).json({
      error: "Could not retrieve health records.",
    });
  }
});

// GET /api/health-records/:deviceId/compare
// Compare the latest observations from different checkpoints.

app.get(
  "/api/health-records/:deviceId/compare",
  async (req, res) => {
    try {
      const deviceId = Number(req.params.deviceId);

      if (!Number.isInteger(deviceId) || deviceId <= 0) {
        return res.status(400).json({
          error: "Invalid device ID.",
        });
      }

      const [records] = await db.execute(
        `SELECT
            id,
            device_id,
            checkpoint_day,
            media_type,
            observations,
            created_at
         FROM health_records
         WHERE device_id = ?
         ORDER BY checkpoint_day ASC, created_at DESC, id DESC`,
        [deviceId]
      );

      // Use the latest record for each checkpoint.
      const latestByDay = new Map();

      for (const record of records) {
        if (!latestByDay.has(record.checkpoint_day)) {
          latestByDay.set(record.checkpoint_day, record);
        }
      }

      const checkpoints = [...latestByDay.values()].sort(
        (a, b) => a.checkpoint_day - b.checkpoint_day
      );

      if (checkpoints.length < 2) {
        return res.json({
          success: true,
          message:
            "Upload records for at least two different checkpoints to compare observations.",
          comparison: null,
          checkpoints,
        });
      }

      const comparisonPrompt = `
You are comparing RepairMate machine health reports.

Compare the following observations from different checkpoints for the same device.

${checkpoints
  .map(
    (record) => `
DAY ${record.checkpoint_day}:
${record.observations}
`
  )
  .join("\n")}

Return:
1. **Changes in observations:** What appears different in the written reports?
2. **Potential deterioration:** Any concerning changes supported by the reports?
3. **Stable observations:** What appears unchanged or cannot be assessed?
4. **Recommended next steps:** Safe monitoring or professional inspection advice.

Important:
- You are comparing written AI observations, not directly comparing the original images.
- Do not claim a physical change unless the reports support it.
- State when evidence is insufficient.
- Do not infer internal mechanical condition or audio changes.
- Use clear Markdown.
`;

      const completion = await groq.chat.completions.create({
        model: TEXT_MODEL,

        messages: [
          {
            role: "system",
            content: SYSTEM_PROMPT,
          },
          {
            role: "user",
            content: comparisonPrompt,
          },
        ],

        temperature: 0.2,
        max_tokens: 1500,
      });

      const comparison =
        completion.choices?.[0]?.message?.content?.trim();

      res.json({
        success: true,
        comparison:
          comparison || "The AI could not generate a comparison.",
        checkpoints,
      });
    } catch (error) {
      console.error("Compare health records failed:", error.message);

      res.status(500).json({
        error: "Could not compare health records.",
        details:
          process.env.NODE_ENV === "development"
            ? error.message
            : undefined,
      });
    }
  }
);

// DELETE /api/health-records/:id
// Delete a health record and its locally stored media.

app.delete("/api/health-records/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        error: "Invalid health record ID.",
      });
    }

    const [rows] = await db.execute(
      "SELECT id, file_path FROM health_records WHERE id = ?",
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        error: "Health record not found.",
      });
    }

    await db.execute(
      "DELETE FROM health_records WHERE id = ?",
      [id]
    );

    const storedPath = path.resolve(rows[0].file_path);
    const uploadRoot = path.resolve(HEALTH_UPLOAD_DIR);

    // Only delete files inside the dedicated health-uploads folder.
    if (storedPath.startsWith(uploadRoot + path.sep)) {
      await fs.promises.unlink(storedPath).catch((error) => {
        if (error.code !== "ENOENT") {
          console.error("Could not delete health media:", error.message);
        }
      });
    }

    res.json({
      success: true,
      message: "Health record deleted successfully.",
    });
  } catch (error) {
    console.error("Delete health record failed:", error.message);

    res.status(500).json({
      error: "Could not delete health record.",
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