"use client";

import { useState, useEffect } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { STLViewer } from "@/components/3d/stl-viewer";
import { formatLKR } from "@/lib/utils";
import {
  Layers,
  UploadCloud,
  FileCode,
  Clock,
  Weight,
  DollarSign,
  Box,
  Download,
  Play,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Eye,
} from "lucide-react";

interface DimensionsMM {
  x: number;
  y: number;
  z: number;
}

interface SlicingResult {
  job_id: string;
  cad_model_id: string;
  filename: string;
  dimensions_mm: DimensionsMM;
  volume_cm3: string;
  triangle_count: number;
  layer_height_mm: string;
  infill_percentage: number;
  material: string;
  support_enabled: boolean;
  filament_used_grams: string;
  filament_used_length_mm: string;
  estimated_duration_seconds: number;
  estimated_duration_formatted: string;
  layer_count: number;
  rate_per_gram_lkr: string;
  calculated_price_lkr: string;
  formula_applied: string;
  gcode_download_url?: string;
  created_at: string;
}

interface JobListItem {
  id: string;
  filename: string;
  material: string;
  infill_percentage: number;
  filament_grams: string;
  duration_formatted: string;
  price_lkr: string;
  created_at: string;
}

export default function SlicingStudioPage() {
  const [currentPartner, setCurrentPartner] = useState("Janitha");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // VisionCraft Parameters: Layer height strictly 0.2 or 0.1, Material strictly PLA+, Rate: 25 LKR/g
  const [layerHeight, setLayerHeight] = useState("0.20");
  const [infillPercentage, setInfillPercentage] = useState(20);
  const material = "PLA+";
  const [supportEnabled, setSupportEnabled] = useState(false);
  const ratePerGram = "25.0";

  const [slicingResult, setSlicingResult] = useState<SlicingResult | null>(null);
  const [recentJobs, setRecentJobs] = useState<JobListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Authenticate helper
  const getAuthToken = async (): Promise<string> => {
    let token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token) {
      try {
        const loginRes = await fetch("/api/v1/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: "janitha@visioncraft.lk", password: "Password123!" }),
        });
        if (loginRes.ok) {
          const data = await loginRes.json();
          token = data.access_token as string;
          if (typeof window !== "undefined") {
            localStorage.setItem("token", token);
          }
        }
      } catch (err) {
        console.warn("Backend auth fetch failed:", err);
      }
    }
    return token || "";
  };

  // Fetch recent jobs
  const fetchRecentJobs = async () => {
    try {
      const token = await getAuthToken();
      const res = await fetch("/api/v1/3d-printing/jobs", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setRecentJobs(data);
      }
    } catch (err) {
      console.error("Failed to load jobs", err);
    }
  };

  useEffect(() => {
    fetchRecentJobs();
  }, []);

  // Process an incoming file from picker or drag-and-drop
  const processIncomingFile = (file: File) => {
    if (!file.name.toLowerCase().endsWith(".stl")) {
      setErrorMessage(`"${file.name}" is not an .stl file. Please choose a valid .stl 3D model.`);
      setSelectedFile(null);
      return;
    }
    setSelectedFile(file);
    setPreviewUrl(null);
    setErrorMessage(null);
  };

  // Handle STL File Selection via file input
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processIncomingFile(e.target.files[0]);
    }
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processIncomingFile(e.dataTransfer.files[0]);
    }
  };

  // Run Slicing & Estimating
  const handleSlice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setErrorMessage("Please select an .stl file to slice.");
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const token = await getAuthToken();
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("layer_height", layerHeight);
      formData.append("infill_percentage", infillPercentage.toString());
      formData.append("material", material);
      formData.append("support_enabled", supportEnabled.toString());
      formData.append("rate_per_gram", ratePerGram);

      const res = await fetch("/api/v1/3d-printing/upload-and-slice", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to slice STL file.");
      }

      const result: SlicingResult = await res.json();
      setSlicingResult(result);
      await fetchRecentJobs();
    } catch (err: any) {
      setErrorMessage(err.message || "An error occurred during slicing.");
    } finally {
      setLoading(false);
    }
  };

  // Single-Click Test with Sample 20mm Cube
  const handleTestSampleCube = async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const token = await getAuthToken();
      const res = await fetch(
        `/api/v1/3d-printing/sample-cube?size_mm=20.0&layer_height=${layerHeight}&infill_percentage=${infillPercentage}&material=${material}&rate_per_gram=${ratePerGram}`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to generate sample cube.");
      }

      const result: SlicingResult = await res.json();
      setSlicingResult(result);
      setSelectedFile(null);
      setPreviewUrl(`/api/v1/3d-printing/models/${result.cad_model_id}/stl`);
      await fetchRecentJobs();
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to test sample cube.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar onOpenQuickExpense={() => {}} />

      <div className="flex-1 flex flex-col min-w-0">
        <Header
          currentPartner={currentPartner}
          onPartnerChange={setCurrentPartner}
        />

        <main className="p-4 lg:p-6 space-y-6 max-w-[1600px] mx-auto w-full">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center space-x-2.5">
                <Layers className="w-6 h-6 text-blue-600" />
                <span>VisionCraft FDM Slicing & 3D Model Studio</span>
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                Interactive 3D WebGL Model Inspection • Material: <strong>PLA+ only</strong> • Layer Heights: <strong>0.2mm & 0.1mm only</strong> • Rate: <strong>25 LKR/g</strong>
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={handleTestSampleCube}
                disabled={loading}
                className="flex items-center space-x-1.5 px-3.5 py-2 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg shadow-sm transition-all cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-blue-600" />
                <span>1-Click Test (20mm Calibration Cube)</span>
              </button>
            </div>
          </div>

          {errorMessage && (
            <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-medium flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Slicing Studio Main Layout: Left Panel (Interactive 3D WebGL Studio) + Right Panel (Controls & Telemetry) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            {/* Left Panel: Interactive 3D WebGL Studio taking full vertical space (7 cols on lg, 8 cols on xl) */}
            <div className="lg:col-span-7 xl:col-span-8 flex flex-col min-h-[620px] lg:min-h-[760px]">
              <div className="bg-slate-900 rounded-xl border border-slate-800 shadow-md flex-1 flex flex-col overflow-hidden">
                {/* 3D Viewport Header Bar */}
                <div className="flex items-center justify-between px-4 py-3 bg-slate-800/80 border-b border-slate-700/60 text-slate-200">
                  <div className="flex items-center space-x-2">
                    <Eye className="w-4 h-4 text-blue-400" />
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-100">
                      Interactive 3D WebGL Model Studio
                    </span>
                  </div>
                  <div className="flex items-center space-x-2 text-[11px] text-slate-400 font-medium">
                    {selectedFile ? (
                      <span className="text-emerald-400 font-semibold truncate max-w-xs">
                        {selectedFile.name}
                      </span>
                    ) : previewUrl ? (
                      <span className="text-blue-400 font-semibold">Calibration Cube (20mm)</span>
                    ) : (
                      <span>Virtual 220×220mm FDM Bed</span>
                    )}
                  </div>
                </div>

                {/* Vertical Full-Height 3D Viewport */}
                <div className="flex-1 relative w-full h-full min-h-[560px]">
                  <STLViewer
                    file={selectedFile}
                    modelUrl={previewUrl}
                    className="w-full h-full absolute inset-0"
                  />
                </div>
              </div>
            </div>

            {/* Right Panel: Upload, Slicing Parameters & Results (5 cols on lg, 4 cols on xl) */}
            <div className="lg:col-span-5 xl:col-span-4 flex flex-col space-y-5">
              {/* Parameters & Upload Form Card */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
                <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center space-x-2">
                  <Box className="w-4 h-4 text-blue-600" />
                  <span>Slicing Parameters (PLA+ & 25 LKR/g)</span>
                </h2>

                <form onSubmit={handleSlice} className="space-y-4 text-xs">
                  {/* Drag & Drop File Zone */}
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Upload .STL 3D Model
                    </label>
                    <label
                      htmlFor="stl-upload-input"
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      className={`block border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all ${
                        isDragging
                          ? "border-blue-500 bg-blue-50/70 scale-[1.01]"
                          : selectedFile
                          ? "border-emerald-400 bg-emerald-50/30 hover:border-emerald-500"
                          : "border-slate-300 hover:border-blue-400 hover:bg-slate-50 bg-slate-50/50"
                      }`}
                    >
                      <input
                        type="file"
                        accept=".stl,.STL,model/stl,application/sla,application/vnd.ms-pki.stl,application/octet-stream"
                        onChange={handleFileChange}
                        className="hidden"
                        id="stl-upload-input"
                      />
                      <UploadCloud
                        className={`w-7 h-7 mx-auto mb-1.5 transition-colors ${
                          isDragging ? "text-blue-600 animate-bounce" : selectedFile ? "text-emerald-600" : "text-slate-400"
                        }`}
                      />
                      <div className="text-xs font-semibold text-blue-600 hover:text-blue-500">
                        {isDragging ? "Drop your .stl file here" : "Browse or drag & drop .stl file"}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1 truncate">
                        {selectedFile ? (
                          <span className="font-semibold text-emerald-700 block">
                            ✓ {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                          </span>
                        ) : (
                          "Binary & ASCII formats supported"
                        )}
                      </p>
                    </label>
                  </div>

                  {/* Slicing Parameter Controls */}
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    {/* Layer Height (Strictly 0.2 or 0.1 mm) */}
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Layer Height
                      </label>
                      <select
                        value={layerHeight}
                        onChange={(e) => setLayerHeight(e.target.value)}
                        className="w-full border border-slate-300 rounded-md p-2 bg-white text-slate-800 focus:ring-2 focus:ring-blue-500 font-medium text-xs"
                      >
                        <option value="0.20">0.20 mm (Standard)</option>
                        <option value="0.10">0.10 mm (Fine Detail)</option>
                      </select>
                    </div>

                    {/* Material (Strictly PLA+) */}
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Filament
                      </label>
                      <div className="p-2 bg-slate-100 border border-slate-200 rounded-md text-slate-800 font-semibold flex items-center justify-between text-xs">
                        <span>PLA+</span>
                        <span className="text-[10px] text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded font-mono">
                          1.24 g/cm³
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Infill Slider */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="font-semibold text-slate-700">
                        Infill Density: <span className="text-blue-600 font-bold">{infillPercentage}%</span>
                      </label>
                      <span className="text-[10px] text-slate-500">Grid / Gyroid</span>
                    </div>
                    <input
                      type="range"
                      min="10"
                      max="100"
                      step="5"
                      value={infillPercentage}
                      onChange={(e) => setInfillPercentage(parseInt(e.target.value))}
                      className="w-full accent-blue-600 cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
                      <span>10% Light</span>
                      <span>20% Std</span>
                      <span>50% Rigid</span>
                      <span>100% Solid</span>
                    </div>
                  </div>

                  {/* Support Structures & Rate */}
                  <div className="grid grid-cols-2 gap-3 items-center pt-1">
                    <div className="flex items-center space-x-2 pt-1">
                      <input
                        type="checkbox"
                        id="support-check"
                        checked={supportEnabled}
                        onChange={(e) => setSupportEnabled(e.target.checked)}
                        className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
                      />
                      <label htmlFor="support-check" className="font-semibold text-slate-700 cursor-pointer text-[11px] leading-tight">
                        Enable Supports (+12%)
                      </label>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1 text-[11px]">
                        Rate per 1g
                      </label>
                      <div className="p-1.5 bg-slate-100 border border-slate-200 rounded-md font-mono text-slate-800 font-bold flex justify-between items-center text-xs">
                        <span>25.00 LKR</span>
                        <span className="text-[10px] text-slate-500 font-normal">/ gram</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={loading || !selectedFile}
                      className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-lg shadow-sm flex items-center justify-center space-x-2 disabled:opacity-50 transition-all cursor-pointer"
                    >
                      <Play className="w-4 h-4 fill-white" />
                      <span>{loading ? "Slicing Model & Calculating..." : "Slice STL & Calculate Price"}</span>
                    </button>
                  </div>
                </form>
              </div>

              {/* Telemetry & Price Output Card */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
                <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center space-x-2">
                  <FileCode className="w-4 h-4 text-emerald-600" />
                  <span>Slicing Telemetry & Price (25 LKR/g)</span>
                </h2>

                {slicingResult ? (
                  <div className="space-y-4">
                    {/* Price Hero Banner */}
                    <div className="bg-blue-50/80 border border-blue-200 rounded-xl p-3.5 text-center">
                      <span className="text-[10px] uppercase tracking-wider font-bold text-blue-700 block">
                        Calculated Selling Price
                      </span>
                      <div className="text-2xl font-extrabold text-blue-900 my-1 font-mono">
                        {formatLKR(slicingResult.calculated_price_lkr)}
                      </div>
                      <div className="text-[11px] text-blue-700 font-medium">
                        Formula: {slicingResult.formula_applied}
                      </div>
                    </div>

                    {/* Telemetry Stats Grid */}
                    <div className="grid grid-cols-2 gap-2.5 text-xs">
                      <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                        <div className="flex items-center space-x-1.5 text-slate-500 mb-0.5">
                          <Weight className="w-3.5 h-3.5 text-blue-600" />
                          <span className="font-medium text-[11px]">Weight</span>
                        </div>
                        <span className="text-sm font-bold text-slate-900 font-mono">
                          {slicingResult.filament_used_grams} g
                        </span>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {slicingResult.filament_used_length_mm} mm length
                        </div>
                      </div>

                      <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                        <div className="flex items-center space-x-1.5 text-slate-500 mb-0.5">
                          <Clock className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="font-medium text-[11px]">Print Time</span>
                        </div>
                        <span className="text-sm font-bold text-slate-900 font-mono">
                          {slicingResult.estimated_duration_formatted}
                        </span>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {slicingResult.layer_count} layers @ {slicingResult.layer_height_mm}mm
                        </div>
                      </div>
                    </div>

                    {/* Dimensions & Geometry */}
                    <div className="border border-slate-200 rounded-lg p-2.5 text-[11px] space-y-1">
                      <div className="flex justify-between items-center text-slate-600">
                        <span>Dimensions:</span>
                        <span className="font-mono font-semibold text-slate-900">
                          {slicingResult.dimensions_mm.x} × {slicingResult.dimensions_mm.y} × {slicingResult.dimensions_mm.z} mm
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-slate-600">
                        <span>Mesh Volume:</span>
                        <span className="font-mono font-semibold text-slate-900">
                          {slicingResult.volume_cm3} cm³
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-slate-600">
                        <span>Triangles:</span>
                        <span className="font-mono font-semibold text-slate-900">
                          {slicingResult.triangle_count.toLocaleString()}
                        </span>
                      </div>
                    </div>

                    {/* Download G-code */}
                    {slicingResult.gcode_download_url && (
                      <a
                        href={slicingResult.gcode_download_url}
                        download
                        className="w-full flex items-center justify-center space-x-2 py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-all"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download Sliced G-Code File</span>
                      </a>
                    )}
                  </div>
                ) : (
                  <div className="py-6 px-4 flex flex-col items-center justify-center text-center border-2 border-dashed border-slate-200 rounded-xl">
                    <Layers className="w-8 h-8 text-slate-300 mb-1.5" />
                    <span className="font-bold text-xs text-slate-700">No Model Sliced Yet</span>
                    <p className="text-[11px] text-slate-400 mt-1 max-w-xs">
                      Choose an .stl model on the right or use 1-Click Test to extract telemetry and calculate price at 25 LKR/g.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Recent Slicing History Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                  <Clock className="w-4 h-4 text-blue-600" />
                  <span>Recent Sliced Models & Quotation History</span>
                </h3>
              </div>
              <span className="text-xs text-slate-500 font-medium">
                {recentJobs.length} models sliced
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 uppercase tracking-wider text-[10px] font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-4">Filename</th>
                    <th className="py-2.5 px-4">Material</th>
                    <th className="py-2.5 px-4">Infill %</th>
                    <th className="py-2.5 px-4">Weight (g)</th>
                    <th className="py-2.5 px-4">Estimated Duration</th>
                    <th className="py-2.5 px-4 text-right">Price (25 LKR/g)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-normal">
                  {recentJobs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        No previous slicing history. Sliced models will automatically be logged here.
                      </td>
                    </tr>
                  ) : (
                    recentJobs.map((job) => (
                      <tr key={job.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4 font-medium text-slate-900 flex items-center space-x-2">
                          <Box className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          <span className="truncate max-w-xs">{job.filename}</span>
                        </td>
                        <td className="py-3 px-4 text-slate-600">{job.material}</td>
                        <td className="py-3 px-4 text-slate-600 font-mono">{job.infill_percentage}%</td>
                        <td className="py-3 px-4 font-mono font-bold text-slate-900">{job.filament_grams} g</td>
                        <td className="py-3 px-4 text-slate-600 font-mono">{job.duration_formatted}</td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-blue-700">
                          {formatLKR(job.price_lkr)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
