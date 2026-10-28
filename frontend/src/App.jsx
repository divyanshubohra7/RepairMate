import { t } from "./i18n/translations";
import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  CheckCircle2,
  Sparkles,
  Wrench,
  Home,
  Smartphone,
  History,
  Plus,
  ArrowLeft,
  RefreshCw,
  Calendar,
  AlertCircle,
  Eye,
  Trash2,
  Laptop,
  Tablet,
  Watch,
  Headphones,
  Gamepad2,
  Monitor,
  X,
  Store,
} from "lucide-react";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import ReportIssue from "./components/ReportIssue";
import MachineHealth from "./components/MachineHealth";
const API_URL = `${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api`;

function App() {
  // My Devices state
const [page, setPage] = useState("dashboard");
// Repair History state
const [repairs, setRepairs] = useState([]);
const [loading, setLoading] = useState(false);
const [error, setError] = useState("");
const [selectedRepair, setSelectedRepair] = useState(null);
const [devices, setDevices] = useState([]);
const [devicesLoading, setDevicesLoading] = useState(false);
const [devicesError, setDevicesError] = useState("");
const [deviceMessage, setDeviceMessage] = useState("");
const [showAddDevice, setShowAddDevice] = useState(false);
const [savingDevice, setSavingDevice] = useState(false);

const [deviceForm, setDeviceForm] = useState({
  category: "Smartphone",
  brand: "Apple",
  model: "",
  nickname: "",
});
const [language, setLanguage] = useState(
  () => localStorage.getItem("repairmate-language") || "en"
);

const changeLanguage = (newLanguage) => {
  setLanguage(newLanguage);
  localStorage.setItem("repairmate-language", newLanguage);
};

const translate = (key) => t(language, key);

const deviceCategories = {
  Smartphone: [
    "Apple", "Samsung", "Google", "OnePlus",
    "Xiaomi", "Motorola", "Nothing", "Other",
  ],
  Laptop: [
    "Apple", "Dell", "HP", "Lenovo",
    "ASUS", "Acer", "MSI", "Other",
  ],
  Tablet: [
    "Apple", "Samsung", "Lenovo", "Xiaomi", "Other",
  ],
  "Desktop PC": [
    "Dell", "HP", "Lenovo", "ASUS", "Custom", "Other",
  ],
  Smartwatch: [
    "Apple", "Samsung", "Google", "Garmin", "Other",
  ],
  "Headphones & Earbuds": [
    "Apple", "Sony", "Samsung", "Bose", "JBL", "Other",
  ],
  "Gaming Console": [
    "Sony", "Microsoft", "Nintendo", "Other",
  ],
  Other: [
    "Other", "Samsung", "LG", "HP", "Canon", "Logitech",
  ],
};

const fetchDevices = async () => {
  setDevicesLoading(true);
  setDevicesError("");

  try {
    const response = await fetch(`${API_URL}/devices`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Unable to load devices.");
    }

    setDevices(
  Array.isArray(data)
    ? data
    : Array.isArray(data.devices)
      ? data.devices
      : []
);
  } catch (err) {
    console.error("Fetch devices error:", err);
    setDevicesError(
      "Unable to load devices. Check that the backend and MySQL are running."
    );
  } finally {
    setDevicesLoading(false);
  }
};

const openDevices = () => {
  setPage("devices");
  setDeviceMessage("");
  fetchDevices();
};

const handleDeviceCategoryChange = (category) => {
  const brands = deviceCategories[category] || [];

  setDeviceForm({
    category,
    brand: brands[0] || "Other",
    model: "",
    nickname: "",
  });
};

const handleAddDevice = async (event) => {
  event.preventDefault();
  setDeviceMessage("");
  setDevicesError("");

  const { category, brand, model, nickname } = deviceForm;

  if (!category || !brand || !model.trim()) {
    setDevicesError("Please select a category and brand and enter a model.");
    return;
  }

  setSavingDevice(true);

  try {
    const response = await fetch(`${API_URL}/devices`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        category,
        brand,
        model: model.trim(),
        nickname: nickname.trim(),
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Unable to register device.");
    }

    setDevices((current) => [data.device, ...current]);

    setDeviceForm({
      category: "Smartphone",
      brand: "Apple",
      model: "",
      nickname: "",
    });

    setShowAddDevice(false);
    setDeviceMessage("Device registered successfully!");
  } catch (err) {
    console.error("Add device error:", err);
    setDevicesError(err.message || "Unable to register device.");
  } finally {
    setSavingDevice(false);
  }
};

const handleDeleteDevice = async (deviceId) => {
  const confirmed = window.confirm(
    "Are you sure you want to remove this device?"
  );

  if (!confirmed) return;

  setDevicesError("");
  setDeviceMessage("");

  try {
    const response = await fetch(`${API_URL}/devices/${deviceId}`, {
      method: "DELETE",
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Unable to delete device.");
    }

    setDevices((current) =>
      current.filter((device) => device.id !== deviceId)
    );

    setDeviceMessage("Device removed successfully.");
  } catch (err) {
    console.error("Delete device error:", err);
    setDevicesError(err.message || "Unable to delete device.");
  }
};

const getDeviceIcon = (category) => {
  switch (category) {
    case "Laptop":
      return Laptop;
    case "Tablet":
      return Tablet;
    case "Smartwatch":
      return Watch;
    case "Headphones & Earbuds":
      return Headphones;
    case "Gaming Console":
      return Gamepad2;
    case "Desktop PC":
      return Monitor;
    default:
      return Smartphone;
  }
};

  const fetchHistory = useCallback(async () => {
  setLoading(true);
  setError("");

  try {
    const response = await fetch(`${API_URL}/history`);

    if (!response.ok) {
      throw new Error("Could not load repair history.");
    }

    const data = await response.json();

    // Support both a direct array and an object containing history.
    const historyRecords = Array.isArray(data)
      ? data
      : Array.isArray(data.history)
        ? data.history
        : [];

    setRepairs(historyRecords);
  } catch (err) {
    console.error("Repair history error:", err);
    setError(
      "Unable to load repair history. Make sure the backend and MySQL are running."
    );
  } finally {
    setLoading(false);
  }
}, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const openHistory = () => {
    setSelectedRepair(null);
    setPage("history");
    fetchHistory();
  };

  const openDashboard = () => {
    setSelectedRepair(null);
    setPage("dashboard");
  };

  const formatDate = (dateValue) => {
    if (!dateValue) return "Date unavailable";

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
      return "Date unavailable";
    }

    return date.toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  };

  const getStatusStyle = (status) => {
    switch ((status || "").toLowerCase()) {
      case "completed":
        return "bg-green-50 text-green-700";

      case "in progress":
        return "bg-orange-50 text-orange-700";

      default:
        return "bg-blue-50 text-blue-700";
    }
  };

  const renderRepairCard = (repair) => (
  <article
    key={repair.id}
    className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow"
  >
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2 mb-2">
          <Smartphone size={19} className="text-blue-600 shrink-0" />

          <h3 className="text-lg font-semibold text-gray-800 break-words">
            {repair.device}
          </h3>
        </div>

        <p className="text-gray-600 break-words">
          {repair.problem}
        </p>

        <p className="flex items-center gap-2 text-sm text-gray-400 mt-3">
          <Calendar size={15} />
          {formatDate(repair.created_at)}
        </p>
      </div>

      <span
        className={`rounded-full px-3 py-1 text-sm w-fit shrink-0 ${getStatusStyle(
          repair.status
        )}`}
      >
        {repair.status || "Diagnosed"}
      </span>
    </div>

    <div className="border-t mt-4 pt-4 flex flex-wrap justify-between items-center gap-3">
      <p className="text-sm text-gray-500">
        Repair ID: #{repair.id}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setSelectedRepair(repair)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100"
        >
          <Eye size={17} />
          View Diagnosis
        </button>

        <button
          onClick={async () => {
  const confirmed = window.confirm(
    "Are you sure you want to permanently delete this diagnosis?"
  );

  if (!confirmed) return;

  try {
    const response = await fetch(
      `${API_URL}/history/${repair.id}`,
      {
        method: "DELETE",
      }
    );

    const responseText = await response.text();

    let data = {};
    try {
      data = responseText ? JSON.parse(responseText) : {};
    } catch {
      throw new Error(
        `Server returned an unexpected response: ${responseText.slice(0, 200)}`
      );
    }

    if (!response.ok) {
      throw new Error(data.error || `Request failed (${response.status})`);
    }

    setRepairs((current) =>
      current.filter(
        (item) => String(item.id) !== String(repair.id)
      )
    );

    setSelectedRepair((current) =>
      current && String(current.id) === String(repair.id)
        ? null
        : current
    );

    window.alert("Diagnosis deleted successfully! ✅");
  } catch (err) {
    console.error("Delete diagnosis error:", err);
    window.alert(`Delete failed: ${err.message}`);
  }
}}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-50 text-red-700 hover:bg-red-100"
          title="Delete diagnosis"
          aria-label={`Delete diagnosis for ${repair.device}`}
        >
          <Trash2 size={17} />
          Delete
        </button>
      </div>
    </div>
  </article>
);

  return (
    <div className="repairmate-app min-h-screen flex">
      {/* Sidebar */}
      <aside className="repairmate-sidebar w-64 shrink-0 p-6">
        <h1 className="text-2xl font-bold mb-8 text-gray-900">
          {translate("appName")}
        </h1>

        <nav className="space-y-3">
          <button
            onClick={openDashboard}
            className={`flex items-center gap-3 w-full p-3 rounded-lg ${
              page === "dashboard"
                ? "bg-blue-50 text-blue-600"
                : "hover:bg-gray-100"
            }`}
          >
            <Home size={20} />
            {translate("dashboard")}
          </button>

          <button
            onClick={openDevices}
            className={`flex items-center gap-3 w-full p-3 rounded-lg ${
              page === "devices"
                ? "bg-blue-50 text-blue-600"
                : "hover:bg-gray-100"
            }`}
          >
            <Smartphone size={20} />
            {translate("myDevices")}
          </button>

          <button
            onClick={openHistory}
            className={`flex items-center gap-3 w-full p-3 rounded-lg ${
              page === "history"
                ? "bg-blue-50 text-blue-600"
                : "hover:bg-gray-100"
            }`}
          >
            <History size={20} />
            {translate("repairHistory")}
          </button>
          <button
  onClick={() => {
    setPage("health");
    fetchDevices();
  }}
  className={`flex w-full items-center gap-3 rounded-lg p-3 ${
    page === "health"
      ? "bg-blue-50 text-blue-600"
      : "hover:bg-gray-100"
  }`}
>
  <Activity size={20} />
  {translate("machineHealth")}
</button>
<button
  onClick={() => setPage("stores")}
  className={`flex w-full items-center gap-3 rounded-lg p-3 ${
    page === "stores"
      ? "bg-blue-50 text-blue-600"
      : "hover:bg-gray-100"
  }`}
>
  <Store size={20} />
  Stores Near Me
</button>
        </nav>
        <div className="border-t border-gray-200 p-4 dark:border-gray-700">
  <label
    htmlFor="repairmate-language"
    className="mb-2 block text-sm font-medium"
  >
    {translate("language")}
  </label>

  <select
    id="repairmate-language"
    value={language}
    onChange={(e) => changeLanguage(e.target.value)}
    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
  >
    <option value="en">🇬🇧 English</option>
    <option value="hi">🇮🇳 हिन्दी</option>
    <option value="kn">🟡 ಕನ್ನಡ</option>
  </select>
</div>
      </aside>

      {/* Main Content */}
      <main className="repairmate-main flex-1 min-w-0 p-5 md:p-8">
                {/* Premium Dashboard */}
        {page === "dashboard" && (
          <div className="space-y-8">
            {/* Welcome Header */}
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <span className="rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
                    {translate("deviceCareHub")}
                  </span>
                  <Sparkles size={15} className="text-indigo-500" />
                </div>

                <h2 className="text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
                  {translate("welcome")}
                  <span className="ml-2 inline-block">👋</span>
                </h2>

                <p className="mt-2 text-sm leading-6 text-slate-500 md:text-base">
                  {translate("dashboardSubtitle")}
                </p>
              </div>

              <button
                onClick={() => setPage("report")}
                className="dashboard-primary-button inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 font-semibold text-white"
              >
                <Plus size={19} />
                {translate("reportIssueButton")}
              </button>
            </div>

            {/* Dashboard Statistics */}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {/* Saved Diagnoses */}
              <article className="dashboard-stat-card group">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-500">
                      {translate("savedDiagnoses")}
                    </p>

                    <h3 className="mt-4 text-4xl font-bold tracking-tight text-slate-900">
                      {repairs.length}
                    </h3>
                  </div>

                  <div className="dashboard-icon dashboard-icon-indigo">
                    <Wrench size={23} />
                  </div>
                </div>

                <div className="mt-5 flex items-center gap-2 border-t border-slate-100 pt-4">
                  <span className="text-xs font-semibold text-indigo-600">
                    {translate("aiPowered")}
                  </span>

                  <span className="text-xs text-slate-400">
                    {translate("diagnosisRecords")}
                  </span>
                </div>
              </article>

              {/* Active Repairs */}
              <article className="dashboard-stat-card group">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-500">
                      {translate("activeRepairs")}
                    </p>

                    <h3 className="mt-4 text-4xl font-bold tracking-tight text-slate-900">
                      {
                        repairs.filter(
                          (repair) =>
                            repair.status?.toLowerCase() === "in progress"
                        ).length
                      }
                    </h3>
                  </div>

                  <div className="dashboard-icon dashboard-icon-amber">
                    <Activity size={23} />
                  </div>
                </div>

                <div className="mt-5 flex items-center gap-2 border-t border-slate-100 pt-4">
                  <span className="text-xs font-semibold text-amber-600">
                    {translate("inProgress")}
                  </span>

                  <span className="text-xs text-slate-400">
                    {translate("repairsTracked")}
                  </span>
                </div>
              </article>

              {/* Completed Repairs */}
              <article className="dashboard-stat-card group sm:col-span-2 xl:col-span-1">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-500">
                      {translate("completedRepairs")}
                    </p>

                    <h3 className="mt-4 text-4xl font-bold tracking-tight text-slate-900">
                      {
                        repairs.filter(
                          (repair) =>
                            repair.status?.toLowerCase() === "completed"
                        ).length
                      }
                    </h3>
                  </div>

                  <div className="dashboard-icon dashboard-icon-emerald">
                    <CheckCircle2 size={23} />
                  </div>
                </div>

                <div className="mt-5 flex items-center gap-2 border-t border-slate-100 pt-4">
                  <span className="text-xs font-semibold text-emerald-600">
                    {translate("completed")}
                  </span>

                  <span className="text-xs text-slate-400">
                    {translate("repairsFinished")}
                  </span>
                </div>
              </article>
            </div>

            {/* Recent Repairs */}
            <section className="dashboard-panel">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-indigo-50 p-2.5 text-indigo-600">
                    <Wrench size={21} />
                  </div>

                  <div>
                    <h3 className="text-lg font-bold text-slate-900">
                      {translate("recentRepairs")}
                    </h3>

                    <p className="mt-1 text-sm text-slate-500">
                      {translate("recentRepairsSubtitle")}
                    </p>
                  </div>
                </div>

                <button
                  onClick={openHistory}
                  className="dashboard-view-all inline-flex items-center justify-center gap-2 self-start rounded-lg px-3 py-2 text-sm font-semibold sm:self-auto"
                >
                  {translate("viewAll")}
                  <ArrowLeft
                    size={15}
                    className="rotate-180"
                  />
                </button>
              </div>

              <div className="mt-6">
                {loading && (
                  <div className="dashboard-empty-state">
                    <RefreshCw
                      size={27}
                      className="mx-auto mb-3 animate-spin text-indigo-500"
                    />

                    <p className="font-medium text-slate-700">
                      {translate("loadingRepairs")}
                    </p>
                  </div>
                )}

                {!loading && error && (
                  <div className="rounded-xl border border-red-100 bg-red-50 p-5">
                    <div className="flex items-start gap-3 text-red-700">
                      <AlertCircle size={21} className="mt-0.5 shrink-0" />

                      <div>
                        <p className="font-semibold">
                          {translate("unableLoadRepairs")}
                        </p>

                        <p className="mt-1 text-sm">
                          {error}
                        </p>

                        <button
                          onClick={fetchHistory}
                          className="mt-3 text-sm font-semibold underline"
                        >
                          {translate("tryAgain")}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {!loading && !error && repairs.length === 0 && (
                  <div className="dashboard-empty-state">
                    <div className="dashboard-empty-icon">
                      <Wrench size={29} />
                    </div>

                    <h4 className="mt-5 text-lg font-semibold text-slate-800">
                      {translate("workspaceReady")}
                    </h4>

                    <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
                      Start by reporting a device problem. RepairMate will
                      generate an AI-assisted diagnosis that you can save
                      and revisit later.
                    </p>

                    <button
                      onClick={() => setPage("report")}
                      className="dashboard-secondary-button mt-5 inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold"
                    >
                      <Plus size={17} />
                      Diagnose your first issue
                    </button>
                  </div>
                )}

                {!loading && !error && repairs.length > 0 && (
                  <div className="space-y-4">
                    {repairs.slice(0, 3).map(renderRepairCard)}
                  </div>
                )}
              </div>
            </section>

            {/* Quick Actions */}
            <section className="dashboard-quick-actions">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600">
                  {translate("quickAccess")}
                </p>

                <h3 className="mt-2 text-lg font-bold text-slate-900">
                  {translate("manageDevices")}
                </h3>

                <p className="mt-1 text-sm text-slate-500">
                  {translate("manageDevicesDescription")}
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  onClick={openDevices}
                  className="dashboard-action-button"
                >
                  <Smartphone size={19} />
                  {translate("myDevices")}
                  <ArrowLeft size={15} className="rotate-180" />
                </button>

                <button
                  onClick={openHistory}
                  className="dashboard-action-button"
                >
                  <History size={19} />
                  Repair History
                  <ArrowLeft size={15} className="rotate-180" />
                </button>
              </div>
            </section>
          </div>
        )}

        {/* Repair History */}
        {page === "history" && (
          <>
            <button
              onClick={openDashboard}
              className="flex items-center gap-2 text-gray-600 hover:text-blue-600 mb-6"
            >
              <ArrowLeft size={20} />
              Back to Dashboard
            </button>

            {selectedRepair ? (
              <section className="bg-white rounded-xl shadow-sm p-6 md:p-8">
                <button
                  onClick={() => setSelectedRepair(null)}
                  className="flex items-center gap-2 text-blue-600 hover:text-blue-800 mb-6"
                >
                  <ArrowLeft size={18} />
                  Back to Repair History
                </button>

                <div className="border-b pb-5 mb-6">
                  <p className="text-sm text-blue-600 font-medium mb-2">
                    Repair #{selectedRepair.id}
                  </p>

                  <h2 className="text-3xl font-bold text-gray-800">
                    {selectedRepair.device}
                  </h2>

                  <p className="text-gray-600 mt-3">
                    {selectedRepair.problem}
                  </p>

                  <div className="flex flex-wrap items-center gap-3 mt-4">
                    <span
                      className={`rounded-full px-3 py-1 text-sm ${getStatusStyle(
                        selectedRepair.status
                      )}`}
                    >
                      {selectedRepair.status || "Diagnosed"}
                    </span>

                    <span className="text-sm text-gray-500">
                      {formatDate(selectedRepair.created_at)}
                    </span>
                  </div>
                </div>

                <h3 className="text-xl font-semibold mb-4">
                  AI Diagnosis
                </h3>

                <div className="prose prose-sm sm:prose-base max-w-none prose-headings:text-gray-800 prose-a:text-blue-600 prose-table:block prose-table:overflow-x-auto">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {selectedRepair.diagnosis || "No diagnosis available."}
                  </ReactMarkdown>
                </div>
              </section>
            ) : (
              <>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
                  <div>
                    <h2 className="text-3xl font-bold text-gray-800">
                      Repair History
                    </h2>

                    <p className="text-gray-500 mt-2">
                      View your previously generated AI diagnoses.
                    </p>
                  </div>

                  <button
                    onClick={fetchHistory}
                    disabled={loading}
                    className="flex items-center justify-center gap-2 bg-white border px-4 py-3 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                  >
                    <RefreshCw
                      size={18}
                      className={loading ? "animate-spin" : ""}
                    />
                    Refresh
                  </button>
                </div>

                {loading && (
                  <div className="bg-white rounded-xl p-10 text-center text-gray-500">
                    Loading repair history...
                  </div>
                )}

                {!loading && error && (
                  <div className="bg-white rounded-xl p-6">
                    <div className="flex items-start gap-3 text-red-600">
                      <AlertCircle size={22} className="shrink-0" />
                      <p>{error}</p>
                    </div>

                    <button
                      onClick={fetchHistory}
                      className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                    >
                      Try again
                    </button>
                  </div>
                )}

                {!loading && !error && repairs.length === 0 && (
                  <div className="bg-white rounded-xl shadow-sm p-12 text-center">
                    <History
                      size={44}
                      className="mx-auto text-gray-300 mb-4"
                    />

                    <h3 className="text-xl font-semibold text-gray-800">
                      No repair history yet
                    </h3>

                    <p className="text-gray-500 mt-2 mb-6">
                      Your AI diagnoses will appear here after you report a device problem.
                    </p>

                    <button
                      onClick={() => setPage("report")}
                      className="inline-flex items-center gap-2 bg-blue-600 text-white px-5 py-3 rounded-lg hover:bg-blue-700"
                    >
                      <Plus size={19} />
                      Report an Issue
                    </button>
                  </div>
                )}

                {!loading && !error && repairs.length > 0 && (
                  <div className="space-y-4">
                    <p className="text-sm text-gray-500">
                      {repairs.length} saved{" "}
                      {repairs.length === 1 ? "diagnosis" : "diagnoses"}
                    </p>

                    {repairs.map(renderRepairCard)}
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* Report Issue */}
        {page === "report" && (
          <>
            <button
              onClick={openDashboard}
              className="flex items-center gap-2 text-gray-600 hover:text-blue-600 mb-6"
            >
              <ArrowLeft size={20} />
              Back to Dashboard
            </button>

            <ReportIssue language={language} />
          </>
        )}

        {/* My Devices */}
{page === "devices" && (
  <>
    <button
      onClick={openDashboard}
      className="mb-6 flex items-center gap-2 text-gray-600 hover:text-blue-600"
    >
      <ArrowLeft size={20} />
      Back to Dashboard
    </button>

    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-3xl font-bold text-gray-800">
          {translate("myDevices")}
        </h2>

        <p className="mt-2 text-gray-500">
          Register and manage all your electronic devices.
        </p>
      </div>

      <button
        onClick={() => {
          setShowAddDevice((current) => !current);
          setDevicesError("");
          setDeviceMessage("");
        }}
        className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-3 text-white hover:bg-blue-700"
      >
        {showAddDevice ? <X size={20} /> : <Plus size={20} />}
        {showAddDevice ? "Cancel" : "Add Device"}
      </button>
    </div>

    {deviceMessage && (
      <div className="mb-5 rounded-lg border border-green-200 bg-green-50 p-4 text-green-700">
        {deviceMessage}
      </div>
    )}

    {devicesError && (
      <div className="mb-5 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
        <AlertCircle size={20} className="mt-0.5 shrink-0" />
        <p>{devicesError}</p>
      </div>
    )}

    {/* Add Device Form */}
    {showAddDevice && (
      <form
        onSubmit={handleAddDevice}
        className="mb-8 space-y-5 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
      >
        <h3 className="text-xl font-semibold text-gray-800">
          {translate("registerNewDevice")}
        </h3>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              {translate("deviceCategoryLabel")}
            </label>

            <select
              value={deviceForm.category}
              onChange={(event) =>
                handleDeviceCategoryChange(event.target.value)
              }
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 outline-none focus:border-blue-500"
            >
              {Object.keys(deviceCategories).map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Brand
            </label>

            <select
              value={deviceForm.brand}
              onChange={(event) =>
                setDeviceForm((current) => ({
                  ...current,
                  brand: event.target.value,
                }))
              }
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 outline-none focus:border-blue-500"
            >
              {(deviceCategories[deviceForm.category] || []).map((brand) => (
                <option key={brand} value={brand}>
                  {brand}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              {translate("deviceModel")}
            </label>

            <input
              type="text"
              value={deviceForm.model}
              onChange={(event) =>
                setDeviceForm((current) => ({
                  ...current,
                  model: event.target.value,
                }))
              }
              placeholder="e.g. iPhone 15, MacBook Air M4"
              maxLength={150}
              required
              className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              {translate("nicknameOptional")}
            </label>

            <input
              type="text"
              value={deviceForm.nickname}
              onChange={(event) =>
                setDeviceForm((current) => ({
                  ...current,
                  nickname: event.target.value,
                }))
              }
              placeholder="e.g. My personal laptop"
              maxLength={100}
              className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-blue-500"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={savingDevice}
          className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-3 font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          <Plus size={18} />
          {savingDevice ? "Saving Device..." : "Register Device"}
        </button>
      </form>
    )}

    {/* Device List */}
    {devicesLoading ? (
      <div className="rounded-xl bg-white p-12 text-center text-gray-500">
        <RefreshCw size={28} className="mx-auto mb-3 animate-spin" />
        {translate("loadingDevices")}
      </div>
    ) : devices.length === 0 ? (
      <div className="rounded-2xl border border-gray-200 bg-white px-6 py-16 text-center shadow-sm">
        <Smartphone size={48} className="mx-auto mb-4 text-gray-300" />

        <h3 className="text-xl font-semibold text-gray-800">
          {translate("noDevicesTitle")}
        </h3>

        <p className="mx-auto mt-2 max-w-md text-gray-500">
          Add your smartphone, laptop, tablet, or another electronic device
          to start building your personal device collection.
        </p>

        <button
          onClick={() => setShowAddDevice(true)}
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-3 text-white hover:bg-blue-700"
        >
          <Plus size={19} />
          {translate("addFirstDevice")}
        </button>
      </div>
    ) : (
      <>
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm text-gray-500">
            {devices.length} registered{" "}
            {devices.length === 1 ? "device" : "devices"}
          </p>

          <button
            onClick={fetchDevices}
            className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {devices.map((device) => {
            const DeviceIcon = getDeviceIcon(device.category);

            return (
              <article
                key={device.id}
                className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
              >
                <div className="mb-5 flex items-start justify-between">
                  <div className="rounded-xl bg-blue-50 p-3 text-blue-600">
                    <DeviceIcon size={27} />
                  </div>

                  <button
                    onClick={() => handleDeleteDevice(device.id)}
                    title="Remove device"
                    aria-label={`Remove ${device.model}`}
                    className="rounded-lg p-2 text-gray-400 transition hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 size={19} />
                  </button>
                </div>

                <p className="text-sm font-medium text-blue-600">
                  {device.category}
                </p>

                <h3 className="mt-1 break-words text-xl font-bold text-gray-800">
                  {device.nickname || device.model}
                </h3>

                <p className="mt-2 text-gray-500">
                  {device.brand} · {device.model}
                </p>

                <p className="mt-3 text-xs text-gray-400">
                  Registered {formatDate(device.created_at)}
                </p>

                <button
                  onClick={() => setPage("report")}
                  className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 font-medium text-blue-700 transition hover:bg-blue-100"
                >
                  <Wrench size={17} />
                  Report an Issue
                </button>
              </article>
            );
          })}
        </div>
      </>
    )}
  </>
)}
{/* Machine Health Monitoring */}
{page === "health" && (
  <MachineHealth
  devices={devices}
  onBack={openDashboard}
  language={language}
/>
)}
{/* Stores Near Me */}
{page === "stores" && (
  <section>
    <button
      onClick={openDashboard}
      className="mb-6 flex items-center gap-2 text-gray-600 hover:text-blue-600"
    >
      <ArrowLeft size={20} />
      Back to Dashboard
    </button>

    <div className="mb-8">
      <h2 className="text-3xl font-bold text-gray-800">
        Stores Near Me
      </h2>

      <p className="mt-2 text-gray-500">
        Find nearby device repair stores.
      </p>
    </div>

    <div className="rounded-2xl border border-gray-200 bg-white px-6 py-16 text-center shadow-sm">
      <Store size={48} className="mx-auto mb-4 text-gray-300" />

      <h3 className="text-xl font-semibold text-gray-800">
        No registered stores
      </h3>

      <p className="mt-2 text-gray-500">
        There are currently no registered stores to display.
      </p>
    </div>
  </section>
)}
      </main>
    </div>
  );
}

export default App;