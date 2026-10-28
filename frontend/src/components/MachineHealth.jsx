import { useEffect, useState } from "react";
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  FileImage,
  RefreshCw,
  Trash2,
  Upload,
  Video,
  X,
} from "lucide-react";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const API_URL = `${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api`;

const CHECKPOINTS = [1, 7, 14, 28];

export default function MachineHealth({ devices, onBack }) {
  const [deviceId, setDeviceId] = useState("");
  const [checkpointDay, setCheckpointDay] = useState("1");
  const [problem, setProblem] = useState("");
  const [media, setMedia] = useState(null);

  const [records, setRecords] = useState([]);
  const [comparison, setComparison] = useState("");
  const [comparisonMessage, setComparisonMessage] = useState("");

  const [loadingRecords, setLoadingRecords] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!deviceId && devices.length > 0) {
      setDeviceId(String(devices[0].id));
    }
  }, [devices, deviceId]);

  const selectedDevice = devices.find(
    (device) => String(device.id) === String(deviceId)
  );

  const formatDate = (value) => {
    if (!value) return "Date unavailable";

    const date = new Date(value);

    return Number.isNaN(date.getTime())
      ? "Date unavailable"
      : date.toLocaleString();
  };

  const fetchRecords = async () => {
    if (!deviceId) {
      setRecords([]);
      setComparison("");
      setComparisonMessage("");
      return;
    }

    setLoadingRecords(true);
    setError("");
    setComparison("");
    setComparisonMessage("");

    try {
      const response = await fetch(
        `${API_URL}/health-records/${deviceId}`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to load health records.");
      }

      setRecords(Array.isArray(data.records) ? data.records : []);
    } catch (err) {
      console.error("Fetch health records failed:", err);
      setError(err.message || "Unable to load health records.");
    } finally {
      setLoadingRecords(false);
    }
  };

  useEffect(() => {
    fetchRecords();
    // Fetch when the selected device changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceId]);

  const handleUpload = async (event) => {
    event.preventDefault();

    setError("");
    setSuccess("");
    setComparison("");
    setComparisonMessage("");

    if (!deviceId) {
      setError("Please register a device before monitoring its health.");
      return;
    }

    if (!media) {
      setError("Please select an image or video to upload.");
      return;
    }

    if (media.size > 25 * 1024 * 1024) {
      setError("The maximum upload size is 25 MB.");
      return;
    }

    const formData = new FormData();

    formData.append("media", media);
    formData.append("device_id", deviceId);
    formData.append("checkpoint_day", checkpointDay);
    formData.append("problem", problem.trim());

    setUploading(true);

    try {
      const response = await fetch(`${API_URL}/health-records`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Health analysis failed.");
      }

      setSuccess(
        `Day ${checkpointDay} health record saved successfully!`
      );

      setMedia(null);
      setProblem("");

      const fileInput = document.getElementById("health-media-input");

      if (fileInput) {
        fileInput.value = "";
      }

      await fetchRecords();
    } catch (err) {
      console.error("Upload health record failed:", err);
      setError(err.message || "Could not upload health record.");
    } finally {
      setUploading(false);
    }
  };

  const handleCompare = async () => {
    if (!deviceId) return;

    setComparing(true);
    setError("");
    setComparison("");
    setComparisonMessage("");

    try {
      const response = await fetch(
        `${API_URL}/health-records/${deviceId}/compare`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Comparison failed.");
      }

      if (data.comparison) {
        setComparison(data.comparison);
      } else {
        setComparisonMessage(
          data.message ||
            "Upload records from at least two checkpoints to compare observations."
        );
      }
    } catch (err) {
      console.error("Compare health records failed:", err);
      setError(err.message || "Unable to compare health records.");
    } finally {
      setComparing(false);
    }
  };

  const handleDelete = async (record) => {
    const confirmed = window.confirm(
      `Delete the Day ${record.checkpoint_day} health record? This cannot be undone.`
    );

    if (!confirmed) return;

    setDeletingId(record.id);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(
        `${API_URL}/health-records/${record.id}`,
        { method: "DELETE" }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not delete health record.");
      }

      setRecords((current) =>
        current.filter((item) => item.id !== record.id)
      );

      setSuccess("Health record deleted successfully.");
      setComparison("");
      setComparisonMessage("");
    } catch (err) {
      console.error("Delete health record failed:", err);
      setError(err.message || "Unable to delete health record.");
    } finally {
      setDeletingId(null);
    }
  };

  const recordedDays = new Set(
    records.map((record) => Number(record.checkpoint_day))
  );

  return (
    <div className="space-y-8">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-indigo-600"
      >
        <ArrowLeft size={18} />
        Back to Dashboard
      </button>

      {/* Page heading */}
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="bg-gradient-to-br from-indigo-950 via-indigo-900 to-violet-800 p-7 text-white md:p-9">
          <div className="flex items-start justify-between gap-4">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold">
                <Activity size={14} />
                DEVICE HEALTH TRACKING
              </span>

              <h2 className="mt-5 text-3xl font-bold tracking-tight md:text-4xl">
                Machine Health Monitoring
              </h2>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-indigo-100 md:text-base">
                Track visible changes in your devices over time with
                AI-assisted observations and a monitoring timeline.
              </p>
            </div>

            <div className="hidden rounded-2xl border border-white/15 bg-white/10 p-4 sm:block">
              <Activity size={34} />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 p-5 md:grid-cols-4 md:p-6">
          {CHECKPOINTS.map((day) => {
            const completed = recordedDays.has(day);

            return (
              <div
                key={day}
                className={`rounded-2xl border p-4 ${
                  completed
                    ? "border-emerald-200 bg-emerald-50"
                    : "border-slate-200 bg-slate-50"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-slate-600">
                    Day {day}
                  </span>

                  {completed ? (
                    <CheckCircle2
                      size={18}
                      className="text-emerald-600"
                    />
                  ) : (
                    <Clock size={18} className="text-slate-400" />
                  )}
                </div>

                <p
                  className={`mt-2 text-xs font-medium ${
                    completed ? "text-emerald-700" : "text-slate-500"
                  }`}
                >
                  {completed ? "Record available" : "Awaiting record"}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Feedback messages */}
      {error && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
          <AlertCircle size={20} className="mt-0.5 shrink-0" />
          <p className="text-sm">{error}</p>

          <button
            onClick={() => setError("")}
            className="ml-auto"
            aria-label="Dismiss error"
          >
            <X size={18} />
          </button>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-700">
          <CheckCircle2 size={20} className="shrink-0" />
          <p className="text-sm">{success}</p>
        </div>
      )}

      {/* Upload form */}
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
        <div className="mb-6">
          <p className="text-xs font-bold uppercase tracking-widest text-indigo-600">
            New health record
          </p>

          <h3 className="mt-2 text-2xl font-bold text-slate-900">
            Inspect your device
          </h3>

          <p className="mt-2 text-sm leading-6 text-slate-500">
            Upload a clear photo or short video. Use similar angles and
            lighting at each checkpoint for more meaningful observations.
          </p>
        </div>

        {devices.length === 0 ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <p className="font-semibold text-amber-900">
              No registered devices found
            </p>

            <p className="mt-2 text-sm leading-6 text-amber-800">
              Add a device under My Devices before creating a health record.
            </p>
          </div>
        ) : (
          <form onSubmit={handleUpload} className="space-y-6">
            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label
                  htmlFor="health-device"
                  className="mb-2 block text-sm font-semibold text-slate-700"
                >
                  Select device
                </label>

                <select
                  id="health-device"
                  value={deviceId}
                  onChange={(event) => {
                    setDeviceId(event.target.value);
                    setComparison("");
                    setComparisonMessage("");
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50"
                >
                  {devices.map((device) => (
                    <option key={device.id} value={device.id}>
                      {device.nickname || device.model} — {device.brand}
                    </option>
                  ))}
                </select>

                {selectedDevice && (
                  <p className="mt-2 text-xs text-slate-500">
                    {selectedDevice.category} · {selectedDevice.model}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="health-checkpoint"
                  className="mb-2 block text-sm font-semibold text-slate-700"
                >
                  Monitoring checkpoint
                </label>

                <select
                  id="health-checkpoint"
                  value={checkpointDay}
                  onChange={(event) =>
                    setCheckpointDay(event.target.value)
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50"
                >
                  {CHECKPOINTS.map((day) => (
                    <option key={day} value={day}>
                      Day {day}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label
                htmlFor="health-media-input"
                className="mb-2 block text-sm font-semibold text-slate-700"
              >
                Upload image or video
              </label>

              <label
                htmlFor="health-media-input"
                className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-center transition hover:border-indigo-400 hover:bg-indigo-50/50"
              >
                <div className="rounded-2xl bg-white p-4 text-indigo-600 shadow-sm">
                  {media?.type.startsWith("video/") ? (
                    <Video size={28} />
                  ) : (
                    <FileImage size={28} />
                  )}
                </div>

                <p className="mt-4 break-all text-sm font-semibold text-slate-800">
                  {media ? media.name : "Choose a photo or video"}
                </p>

                <p className="mt-2 text-xs text-slate-500">
                  JPG, PNG, WEBP, GIF, MP4, WEBM or MOV · Maximum 25 MB
                </p>

                <span className="mt-4 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white">
                  <Upload size={16} />
                  Browse files
                </span>
              </label>

              <input
                id="health-media-input"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
                className="sr-only"
                onChange={(event) =>
                  setMedia(event.target.files?.[0] || null)
                }
              />

              {media && (
                <button
                  type="button"
                  onClick={() => {
                    setMedia(null);

                    const input = document.getElementById(
                      "health-media-input"
                    );

                    if (input) input.value = "";
                  }}
                  className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-red-600 hover:text-red-700"
                >
                  <X size={15} />
                  Remove selected file
                </button>
              )}
            </div>

            <div>
              <label
                htmlFor="health-observations"
                className="mb-2 block text-sm font-semibold text-slate-700"
              >
                Your observations{" "}
                <span className="font-normal text-slate-400">
                  (optional)
                </span>
              </label>

              <textarea
                id="health-observations"
                value={problem}
                onChange={(event) => setProblem(event.target.value)}
                rows={3}
                maxLength={1500}
                placeholder="Example: The outer casing has a new scratch near the charging port."
                className="w-full resize-y rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50"
              />

              <p className="mt-1 text-right text-xs text-slate-400">
                {problem.length}/1500
              </p>
            </div>

            <button
              type="submit"
              disabled={uploading || !deviceId || !media}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3.5 font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              {uploading ? (
                <>
                  <RefreshCw size={18} className="animate-spin" />
                  Analyzing device...
                </>
              ) : (
                <>
                  <Activity size={18} />
                  Analyze & Save Record
                </>
              )}
            </button>
          </form>
        )}
      </section>

      {/* Timeline */}
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-indigo-600">
              Monitoring history
            </p>

            <h3 className="mt-2 text-2xl font-bold text-slate-900">
              Health Timeline
            </h3>

            <p className="mt-2 text-sm text-slate-500">
              Saved observations for the selected device.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={fetchRecords}
              disabled={loadingRecords || !deviceId}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw
                size={16}
                className={loadingRecords ? "animate-spin" : ""}
              />
              Refresh
            </button>

            <button
              onClick={handleCompare}
              disabled={comparing || records.length < 2}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {comparing ? (
                <RefreshCw size={16} className="animate-spin" />
              ) : (
                <Activity size={16} />
              )}
              Compare records
            </button>
          </div>
        </div>

        <div className="mt-6">
          {loadingRecords ? (
            <div className="py-12 text-center text-slate-500">
              <RefreshCw
                size={28}
                className="mx-auto mb-3 animate-spin text-indigo-500"
              />
              Loading health timeline...
            </div>
          ) : records.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-12 text-center">
              <Activity
                size={38}
                className="mx-auto text-slate-300"
              />

              <h4 className="mt-4 font-semibold text-slate-800">
                No health records yet
              </h4>

              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                Upload your first image or video to begin tracking visible
                changes in this device.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {records.map((record) => (
                <article
                  key={record.id}
                  className="overflow-hidden rounded-2xl border border-slate-200"
                >
                  <div className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <div className="rounded-xl bg-indigo-100 p-3 text-indigo-700">
                        {record.media_type === "video" ? (
                          <Video size={21} />
                        ) : (
                          <FileImage size={21} />
                        )}
                      </div>

                      <div>
                        <h4 className="font-bold text-slate-900">
                          Day {record.checkpoint_day} · Health Report
                        </h4>

                        <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                          <Calendar size={13} />
                          {formatDate(record.created_at)}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => handleDelete(record)}
                      disabled={deletingId === record.id}
                      className="inline-flex items-center justify-center gap-2 self-start rounded-lg px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50 sm:self-auto"
                    >
                      {deletingId === record.id ? (
                        <RefreshCw size={16} className="animate-spin" />
                      ) : (
                        <Trash2 size={16} />
                      )}
                      Delete
                    </button>
                  </div>

                  <div className="p-5">
                    <div className="mb-4">
                      <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold capitalize text-indigo-700">
                        {record.media_type} analysis
                      </span>
                    </div>

                    <div className="prose prose-sm max-w-none break-words prose-headings:text-slate-800 prose-a:text-indigo-600 prose-table:block prose-table:overflow-x-auto">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {record.observations || "No observations available."}
                      </ReactMarkdown>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        {(comparison || comparisonMessage) && (
          <div className="mt-8 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-5 md:p-6">
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-xl bg-white p-2.5 text-indigo-600 shadow-sm">
                <Activity size={21} />
              </div>

              <div>
                <h4 className="font-bold text-slate-900">
                  Health Comparison
                </h4>

                <p className="mt-1 text-xs text-slate-500">
                  AI-assisted comparison of saved observations
                </p>
              </div>
            </div>

            {comparison ? (
              <div className="prose prose-sm max-w-none break-words prose-headings:text-slate-800 prose-table:block prose-table:overflow-x-auto">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {comparison}
                </ReactMarkdown>
              </div>
            ) : (
              <p className="text-sm leading-6 text-slate-600">
                {comparisonMessage}
              </p>
            )}

            <p className="mt-5 border-t border-indigo-100 pt-4 text-xs leading-5 text-slate-500">
              These results summarize written AI observations. They do not
              establish a definitive mechanical diagnosis or prove physical
              deterioration. Visual analysis cannot assess audio or hidden
              internal components.
            </p>
          </div>
        )}
      </section>

      <p className="text-xs leading-5 text-slate-400">
        Safety note: AI observations are informational, not a substitute for
        qualified inspection. Stop using a device if you notice smoke,
        sparks, burning smells, or electrical shocks.
      </p>
    </div>
  );
}