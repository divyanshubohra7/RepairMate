import { useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Wrench,
  LoaderCircle,
  ArrowLeft,
  Camera,
  ImagePlus,
  Video,
  X,
  Sparkles,
  Search,
  Upload,
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";

const DEVICE_OPTIONS = {
  "Washing Machine": {
    Samsung: ["Front Load", "Top Load", "Other"],
    LG: ["Front Load", "Top Load", "Other"],
    Whirlpool: ["Front Load", "Top Load", "Other"],
    Bosch: ["Front Load", "Other"],
    IFB: ["Front Load", "Top Load", "Other"],
    Other: ["Other"],
  },

  Refrigerator: {
    Samsung: ["Single Door", "Double Door", "Side-by-Side", "Other"],
    LG: ["Single Door", "Double Door", "Side-by-Side", "Other"],
    Whirlpool: ["Single Door", "Double Door", "Other"],
    Haier: ["Single Door", "Double Door", "Other"],
    Other: ["Other"],
  },

  "Air Conditioner": {
    Daikin: ["Split AC", "Window AC", "Other"],
    LG: ["Split AC", "Window AC", "Other"],
    Samsung: ["Split AC", "Other"],
    Voltas: ["Split AC", "Window AC", "Other"],
    Other: ["Other"],
  },

  "Ceiling Fan": {
    Crompton: ["Standard Fan", "BLDC Fan", "Other"],
    Havells: ["Standard Fan", "BLDC Fan", "Other"],
    Orient: ["Standard Fan", "BLDC Fan", "Other"],
    Usha: ["Standard Fan", "BLDC Fan", "Other"],
    Other: ["Other"],
  },

  "Water Pump": {
    Kirloskar: ["Domestic Pump", "Other"],
    Crompton: ["Domestic Pump", "Other"],
    CRI: ["Domestic Pump", "Other"],
    Other: ["Other"],
  },

  "Microwave Oven": {
    LG: ["Solo", "Grill", "Convection", "Other"],
    Samsung: ["Solo", "Grill", "Convection", "Other"],
    IFB: ["Solo", "Grill", "Convection", "Other"],
    Other: ["Other"],
  },

  "Air Cooler": {
    Symphony: ["Desert Cooler", "Personal Cooler", "Other"],
    Bajaj: ["Desert Cooler", "Personal Cooler", "Other"],
    Crompton: ["Desert Cooler", "Personal Cooler", "Other"],
    Other: ["Other"],
  },

  Smartphone: {
    Apple: ["iPhone 17", "iPhone 16", "iPhone 15", "iPhone 14", "Other"],
    Samsung: ["Galaxy S Series", "Galaxy A Series", "Galaxy Z Series", "Other"],
    Google: ["Pixel 10", "Pixel 9", "Pixel 8", "Other"],
    OnePlus: ["OnePlus 13", "OnePlus 12", "Nord Series", "Other"],
    Xiaomi: ["Xiaomi Series", "Redmi Series", "POCO Series", "Other"],
    Motorola: ["Edge Series", "Moto G Series", "Other"],
    Nothing: ["Phone (3)", "Phone (2)", "Phone (1)", "Other"],
    Other: ["Other"],
  },

  Laptop: {
    Apple: ["MacBook Air", "MacBook Pro", "Other"],
    Dell: ["Inspiron", "XPS", "Latitude", "G Series", "Other"],
    HP: ["Pavilion", "Envy", "Spectre", "Victus", "Other"],
    Lenovo: ["ThinkPad", "IdeaPad", "Yoga", "Legion", "Other"],
    ASUS: ["Zenbook", "Vivobook", "ROG", "TUF Gaming", "Other"],
    Acer: ["Aspire", "Swift", "Nitro", "Predator", "Other"],
    MSI: ["Modern", "Prestige", "Katana", "Other"],
    Other: ["Other"],
  },

  Tablet: {
    Apple: ["iPad Pro", "iPad Air", "iPad", "iPad mini", "Other"],
    Samsung: ["Galaxy Tab S Series", "Galaxy Tab A Series", "Other"],
    Lenovo: ["Tab Series", "Other"],
    Xiaomi: ["Pad Series", "Other"],
    Other: ["Other"],
  },

  "Desktop PC": {
    Dell: ["Inspiron Desktop", "OptiPlex", "XPS Desktop", "Other"],
    HP: ["Pavilion Desktop", "Envy Desktop", "Other"],
    Lenovo: ["ThinkCentre", "IdeaCentre", "Other"],
    ASUS: ["ROG Desktop", "Other"],
    Custom: ["Custom-built PC"],
    Other: ["Other"],
  },

  Smartwatch: {
    Apple: ["Apple Watch Series", "Apple Watch SE", "Apple Watch Ultra", "Other"],
    Samsung: ["Galaxy Watch", "Other"],
    Google: ["Pixel Watch", "Other"],
    Garmin: ["Forerunner", "Venu", "Other"],
    Other: ["Other"],
  },

  "Headphones & Earbuds": {
    Apple: ["AirPods", "AirPods Pro", "AirPods Max", "Other"],
    Sony: ["WH Series", "WF Series", "Other"],
    Samsung: ["Galaxy Buds", "Other"],
    Bose: ["QuietComfort", "Other"],
    JBL: ["Tune Series", "Live Series", "Other"],
    Other: ["Other"],
  },

  "Gaming Console": {
    Sony: ["PlayStation 5", "PlayStation 4", "Other"],
    Microsoft: ["Xbox Series X", "Xbox Series S", "Xbox One", "Other"],
    Nintendo: ["Switch", "Switch Lite", "Other"],
    Other: ["Other"],
  },

  Other: {
    Other: ["Other"],
    Samsung: ["Other"],
    LG: ["Other"],
    HP: ["Other"],
    Canon: ["Other"],
    Logitech: ["Other"],
  },
};

function ReportIssue({ onBack }) {
  const [category, setCategory] = useState("Smartphone");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [customModel, setCustomModel] = useState("");
  const [problem, setProblem] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState("diagnosis");
  const [media, setMedia] = useState(null);
  const [mediaPreview, setMediaPreview] = useState("");
  const [mediaType, setMediaType] = useState("");
  const [dragging, setDragging] = useState(false);

  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const brands = Object.keys(DEVICE_OPTIONS[category] || {});
  const models = brand ? DEVICE_OPTIONS[category]?.[brand] || [] : [];

  const selectedModel =
    model === "Other" ? customModel.trim() : model;

  const isVideo = mediaType === "video";

  function clearMedia() {
    if (mediaPreview) {
      URL.revokeObjectURL(mediaPreview);
    }

    setMedia(null);
    setMediaPreview("");
    setMediaType("");

    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  }

  function handleCategoryChange(value) {
    setCategory(value);
    setBrand("");
    setModel("");
    setCustomModel("");
  }

  function handleBrandChange(value) {
    setBrand(value);
    setModel("");
    setCustomModel("");
  }

  function handleMediaChange(file) {
    setError("");
    setDiagnosis("");

    if (!file) return;

    const supportedImageTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
    ];

    const supportedVideoTypes = [
      "video/mp4",
      "video/webm",
      "video/quicktime",
    ];

    if (
      !supportedImageTypes.includes(file.type) &&
      !supportedVideoTypes.includes(file.type)
    ) {
      setError("Please choose a JPG, PNG, WEBP, GIF, MP4, WEBM, or MOV file.");
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      setError("The file is too large. Please choose a file under 25 MB.");
      return;
    }

    clearMedia();

    const type = file.type.startsWith("video/") ? "video" : "image";

    setMedia(file);
    setMediaType(type);
    setMediaPreview(URL.createObjectURL(file));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setError("");
    setDiagnosis("");

    if (!brand || !selectedModel || !problem.trim()) {
      setError(
        "Please select your device brand and model, and describe the problem."
      );
      return;
    }

    setLoading(true);

    try {
      let response;

      if (media) {
        const formData = new FormData();

        formData.append("media", media);
        formData.append("category", category);
        formData.append("brand", brand);
        formData.append("model", selectedModel);
        formData.append("problem", problem.trim());
        formData.append("mode", mode);

        response = await fetch(`${API_BASE}/api/diagnose-media`, {
          method: "POST",
          body: formData,
        });
      } else {
        if (mode === "parts") {
          throw new Error(
            "Please upload a photo or video to identify spare parts."
          );
        }

        response = await fetch(`${API_BASE}/api/diagnose`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            device: `${category} - ${brand} ${selectedModel}`,
            problem: problem.trim(),
          }),
        });
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate a response.");
      }

      setDiagnosis(data.diagnosis || "No diagnosis was returned.");
    } catch (err) {
      setError(
        err.message ||
          "Unable to connect to RepairMate. Please check that the backend is running."
      );
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    clearMedia();
    setBrand("");
    setModel("");
    setCustomModel("");
    setProblem("");
    setDiagnosis("");
    setError("");
    setMode("diagnosis");
  }

  function handleDrop(event) {
    event.preventDefault();
    setDragging(false);

    const file = event.dataTransfer.files?.[0];

    if (file) {
      handleMediaChange(file);
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 text-sm text-gray-600 transition hover:text-gray-900"
      >
        <ArrowLeft size={18} />
        Back to Dashboard
      </button>

      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-blue-100 p-3 text-blue-700">
          <Wrench size={24} />
        </div>

        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            RepairMate AI Assistant
          </h1>
          <p className="text-sm text-gray-500">
            Describe the problem or upload a photo/video of your device.
          </p>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
      >
        {/* DEVICE DETAILS */}

        <div>
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            1. Device Details
          </h2>

          <div className="mb-5">
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Device Category
            </label>

            <select
              value={category}
              onChange={(event) => handleCategoryChange(event.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              {Object.keys(DEVICE_OPTIONS).map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Brand
              </label>

              <select
                value={brand}
                onChange={(event) => handleBrandChange(event.target.value)}
                required
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="">Select brand</option>

                {brands.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Model
              </label>

              <select
                value={model}
                onChange={(event) => {
                  setModel(event.target.value);
                  setCustomModel("");
                }}
                required
                disabled={!brand}
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-gray-100"
              >
                <option value="">
                  {brand ? "Select model" : "Select brand first"}
                </option>

                {models.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {model === "Other" && (
            <div className="mt-5">
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Enter Your Model
              </label>

              <input
                type="text"
                value={customModel}
                onChange={(event) => setCustomModel(event.target.value)}
                placeholder="Enter device model"
                maxLength={150}
                required
                className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>
          )}
        </div>

        {/* AI MODE */}

        <div>
          <h2 className="mb-3 text-lg font-semibold text-gray-900">
            2. Choose AI Mode
          </h2>

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => {
                setMode("diagnosis");
                setError("");
                setDiagnosis("");
              }}
              className={`flex items-start gap-3 rounded-xl border p-4 text-left transition ${
                mode === "diagnosis"
                  ? "border-blue-500 bg-blue-50 ring-2 ring-blue-100"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <Sparkles
                size={22}
                className={
                  mode === "diagnosis" ? "text-blue-600" : "text-gray-500"
                }
              />

              <div>
                <p className="font-semibold text-gray-900">Diagnose Issue</p>
                <p className="mt-1 text-sm text-gray-500">
                  Understand the fault and explore safe troubleshooting steps.
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                setMode("parts");
                setError("");
                setDiagnosis("");
              }}
              className={`flex items-start gap-3 rounded-xl border p-4 text-left transition ${
                mode === "parts"
                  ? "border-blue-500 bg-blue-50 ring-2 ring-blue-100"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <Search
                size={22}
                className={mode === "parts" ? "text-blue-600" : "text-gray-500"}
              />

              <div>
                <p className="font-semibold text-gray-900">
                  Identify Spare Parts
                </p>
                <p className="mt-1 text-sm text-gray-500">
                  Upload a photo to identify a visible component.
                </p>
              </div>
            </button>
          </div>
        </div>

        {/* PHOTO AND VIDEO UPLOAD */}

        <div>
          <h2 className="mb-2 text-lg font-semibold text-gray-900">
            3. Add a Photo or Video
          </h2>

          <p className="mb-4 text-sm text-gray-500">
            Optional for diagnosis, but required for spare-parts identification.
            Maximum file size: 25 MB.
          </p>

          <div
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            className={`rounded-xl border-2 border-dashed p-5 text-center transition sm:p-7 ${
              dragging
                ? "border-blue-500 bg-blue-50"
                : "border-gray-300 bg-gray-50"
            }`}
          >
            {mediaPreview ? (
              <div className="space-y-4">
                {isVideo ? (
                  <video
                    src={mediaPreview}
                    controls
                    playsInline
                    className="mx-auto max-h-72 max-w-full rounded-lg bg-black"
                  />
                ) : (
                  <img
                    src={mediaPreview}
                    alt="Selected device"
                    className="mx-auto max-h-72 max-w-full rounded-lg object-contain"
                  />
                )}

                <p className="break-all text-sm font-medium text-gray-700">
                  {media?.name}
                </p>

                <button
                  type="button"
                  onClick={clearMedia}
                  className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
                >
                  <X size={16} />
                  Remove File
                </button>
              </div>
            ) : (
              <>
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                  <ImagePlus size={27} />
                </div>

                <p className="font-medium text-gray-800">
                  Upload a photo or video
                </p>

                <p className="mt-1 text-sm text-gray-500">
                  Drag and drop a file here, or choose an option below.
                </p>

                <div className="mt-5 flex flex-wrap justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-100"
                  >
                    <Upload size={17} />
                    Choose File
                  </button>

                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700"
                  >
                    <Camera size={17} />
                    Take Photo
                  </button>
                </div>

                <div className="mt-3 flex items-center justify-center gap-2 text-xs text-gray-400">
                  <Video size={15} />
                  Photos: JPG, PNG, WEBP · Videos: MP4, WEBM, MOV
                </div>
              </>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
            className="hidden"
            onChange={(event) => {
              handleMediaChange(event.target.files?.[0]);
              event.target.value = "";
            }}
          />

          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(event) => {
              handleMediaChange(event.target.files?.[0]);
              event.target.value = "";
            }}
          />

          <p className="mt-3 text-xs leading-5 text-gray-500">
            For accurate identification, photograph the damaged area clearly.
            Avoid touching exposed wiring or opening electrical appliances.
            On desktop computers, the camera option depends on your browser
            and connected camera.
          </p>
        </div>

        {/* PROBLEM DESCRIPTION */}

        <div>
          <h2 className="mb-2 text-lg font-semibold text-gray-900">
            4. Describe the Problem
          </h2>

          <label className="mb-2 block text-sm font-medium text-gray-700">
            {mode === "parts"
              ? "What part do you want to identify?"
              : "What's happening with your device?"}
          </label>

          <textarea
            value={problem}
            onChange={(event) => setProblem(event.target.value)}
            placeholder={
              mode === "parts"
                ? "Example: Identify this broken component and explain what replacement information I need."
                : "Example: My washing machine makes a loud rattling noise during the spin cycle..."
            }
            rows={5}
            maxLength={5000}
            required
            className="w-full resize-y rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />

          <p className="mt-1 text-right text-xs text-gray-400">
            {problem.length}/5000 characters
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
          >
            {error}
          </div>
        )}

        {/* ACTION BUTTONS */}

        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-3 font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? (
              <>
                <LoaderCircle size={18} className="animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Sparkles size={18} />
                {mode === "parts" ? "Identify Spare Part" : "Diagnose Issue"}
              </>
            )}
          </button>

          <button
            type="button"
            onClick={resetForm}
            disabled={loading}
            className="rounded-lg border border-gray-300 px-5 py-3 font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-60"
          >
            Clear Form
          </button>
        </div>
      </form>

      {/* AI RESULT */}

      {diagnosis && (
        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-5 border-b border-gray-100 pb-4">
            <div className="flex items-center gap-2">
              <Sparkles size={22} className="text-blue-600" />

              <h2 className="text-xl font-bold text-gray-900">
                {mode === "parts" ? "Spare Part Analysis" : "AI Diagnosis"}
              </h2>
            </div>

            <p className="mt-2 text-sm text-gray-500">
              {category} · {brand} · {selectedModel}
              {media && ` · ${isVideo ? "Video analysis" : "Image analysis"}`}
            </p>
          </div>

          <div className="max-w-none text-gray-700">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h1: ({ children }) => (
                  <h1 className="mb-4 mt-8 border-b border-gray-200 pb-3 text-2xl font-bold text-gray-900 first:mt-0">
                    {children}
                  </h1>
                ),

                h2: ({ children }) => (
                  <h2 className="mb-3 mt-7 border-b border-gray-100 pb-2 text-xl font-bold text-gray-900">
                    {children}
                  </h2>
                ),

                h3: ({ children }) => (
                  <h3 className="mb-2 mt-5 text-lg font-semibold text-gray-800">
                    {children}
                  </h3>
                ),

                p: ({ children }) => (
                  <p className="my-3 leading-7 text-gray-700">{children}</p>
                ),

                ul: ({ children }) => (
                  <ul className="my-4 list-disc space-y-2 pl-6">{children}</ul>
                ),

                ol: ({ children }) => (
                  <ol className="my-4 list-decimal space-y-3 pl-6">{children}</ol>
                ),

                li: ({ children }) => (
                  <li className="pl-1 leading-7">{children}</li>
                ),

                strong: ({ children }) => (
                  <strong className="font-semibold text-gray-900">
                    {children}
                  </strong>
                ),

                table: ({ children }) => (
                  <div className="my-5 w-full overflow-x-auto rounded-lg border border-gray-200">
                    <table className="w-full min-w-[700px] border-collapse text-left text-sm">
                      {children}
                    </table>
                  </div>
                ),

                thead: ({ children }) => (
                  <thead className="bg-gray-100 text-gray-800">{children}</thead>
                ),

                tbody: ({ children }) => (
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {children}
                  </tbody>
                ),

                tr: ({ children }) => (
                  <tr className="divide-x divide-gray-200">{children}</tr>
                ),

                th: ({ children }) => (
                  <th className="min-w-[150px] border-b border-gray-200 px-4 py-3 text-left align-top font-semibold">
                    {children}
                  </th>
                ),

                td: ({ children }) => (
                  <td className="min-w-[150px] px-4 py-3 align-top leading-6">
                    {children}
                  </td>
                ),

                hr: () => <hr className="my-6 border-gray-200" />,

                blockquote: ({ children }) => (
                  <blockquote className="my-4 border-l-4 border-blue-400 bg-blue-50 px-4 py-3 text-gray-700">
                    {children}
                  </blockquote>
                ),

                code: ({ children }) => (
                  <code className="rounded bg-gray-100 px-1.5 py-0.5 text-sm text-blue-700">
                    {children}
                  </code>
                ),
              }}
            >
              {diagnosis}
            </ReactMarkdown>
          </div>

          <p className="mt-6 border-t border-gray-100 pt-4 text-xs leading-5 text-gray-500">
            RepairMate provides AI-generated guidance, not a confirmed physical
            inspection. Visual analysis may not identify hidden faults or
            guarantee spare-part compatibility. Seek qualified professional
            help for electrical or hazardous repairs.
          </p>
        </section>
      )}
    </div>
  );
}

export default ReportIssue;