"use client";

import { useState, useEffect } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
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
  const [layerHeight, setLayerHeight] = useState("0.20");
  const [infillPercentage, setInfillPercentage] = useState(20);
  const [material, setMaterial] = useState("PLA");
  const [supportEnabled, setSupportEnabled] = useState(false);
  const [ratePerGram, setRatePerGram] = useState("28.0");

  const [slicingResult, setSlicingResult] = useState<SlicingResult | null>(null);
  const [recentJobs, setRecentJobs] = useState<JobListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Authenticate helper
  const getAuthToken = async (): Promise<string> => {
    let token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token) {
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

  // Handle STL File Selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (!file.name.toLowerCase().endsWith(".stl")) {
        setErrorMessage("Please select a valid .stl 3D model file.");
        setSelectedFile(null);
        return;
      }
      setSelectedFile(file);
      setErrorMessage(null);
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

        <main className="p-6 space-y-6 max-w-7xl mx-auto w-full">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center space-x-2.5">
                <Layers className="w-6 h-6 text-blue-600" />
                <span>FDM .STL Slicing & Price Estimator</span>
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                Upload any .stl model, configure FDM infill and layer parameters, and calculate pricing at VisionCraft's standard 28 LKR/g rate.
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={handleTestSampleCube}
                disabled={loading}
                className="flex items-center space-x-1.5 px-3.5 py-2 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg shadow-sm transition-all"
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

          {/* Slicing Studio Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Upload & Configuration Form (7 Columns) */}
            <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-5">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center space-x-2">
                <Box className="w-4 h-4 text-blue-600" />
                <span>STL Model & FDM Parameters</span>
              </h2>

              <form onSubmit={handleSlice} className="space-y-4 text-xs">
                {/* Drag & Drop File Zone */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Select .STL 3D Model File
                  </label>
                  <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center hover:border-blue-500 transition-colors bg-slate-50/50">
                    <UploadCloud className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                    <input
                      type="file"
                      accept=".stl"
                      onChange={handleFileChange}
                      className="hidden"
                      id="stl-upload-input"
                    />
                    <label
                      htmlFor="stl-upload-input"
                      className="cursor-pointer inline-flex items-center space-x-1.5 text-xs font-semibold text-blue-600 hover:text-blue-500"
                    >
                      <span>Choose .stl file</span>
                    </label>
                    <p className="text-[11px] text-slate-500 mt-1">
                      {selectedFile ? (
                        <span className="font-semibold text-slate-900">
                          Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                        </span>
                      ) : (
                        "Compatible with Binary and ASCII .stl 3D meshes"
                      )}
                    </p>
                  </div>
                </div>

                {/* Slicing Parameter Controls */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  {/* Layer Height */}
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Layer Height (Quality)
                    </label>
                    <select
                      value={layerHeight}
                      onChange={(e) => setLayerHeight(e.target.value)}
                      className="w-full border border-slate-300 rounded-md p-2 bg-white text-slate-800 focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="0.12">0.12 mm (High Detail / Fine)</option>
                      <option value="0.20">0.20 mm (Standard Resolution)</option>
                      <option value="0.28">0.28 mm (Draft / Fast Print)</option>
                    </select>
                  </div>

                  {/* Material */}
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Filament Material
                    </label>
                    <select
                      value={material}
                      onChange={(e) => setMaterial(e.target.value)}
                      className="w-full border border-slate-300 rounded-md p-2 bg-white text-slate-800 focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="PLA">PLA (Density: 1.24 g/cm³)</option>
                      <option value="PETG">PETG (Density: 1.27 g/cm³)</option>
                      <option value="ABS">ABS (Density: 1.04 g/cm³)</option>
                      <option value="TPU">TPU Flexible (Density: 1.21 g/cm³)</option>
                    </select>
                  </div>
                </div>

                {/* Infill Slider */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="font-semibold text-slate-700">
                      Infill Density: <span className="text-blue-600 font-bold">{infillPercentage}%</span>
                    </label>
                    <span className="text-[11px] text-slate-500">Grid / Gyroid Pattern</span>
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
                    <span>10% (Light)</span>
                    <span>20% (Standard)</span>
                    <span>50% (Rigid)</span>
                    <span>100% (Solid)</span>
                  </div>
                </div>

                {/* Support Structures & Rate */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center pt-1">
                  <div className="flex items-center space-x-2 pt-2">
                    <input
                      type="checkbox"
                      id="support-check"
                      checked={supportEnabled}
                      onChange={(e) => setSupportEnabled(e.target.checked)}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
                    />
                    <label htmlFor="support-check" className="font-semibold text-slate-700 cursor-pointer">
                      Enable Support Structures (+12% allowance)
                    </label>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Rate per 1g (LKR)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.5"
                        value={ratePerGram}
                        onChange={(e) => setRatePerGram(e.target.value)}
                        className="w-full border border-slate-300 rounded-md p-2 font-mono text-slate-800 bg-slate-50 font-semibold"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-slate-500 font-medium">
                        LKR / g
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-3">
                  <button
                    type="submit"
                    disabled={loading || !selectedFile}
                    className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm rounded-lg shadow-sm flex items-center justify-center space-x-2 disabled:opacity-50 transition-all cursor-pointer"
                  >
                    <Play className="w-4 h-4 fill-white" />
                    <span>{loading ? "Slicing Model & Extracting Telemetry..." : "Slice STL & Calculate Price"}</span>
                  </button>
                </div>
              </form>
            </div>

            {/* Right: Slicing Results & Telemetry Card (5 Columns) */}
            <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center space-x-2 mb-4">
                  <FileCode className="w-4 h-4 text-emerald-600" />
                  <span>Slicing Telemetry & Price Output</span>
                </h2>

                {slicingResult ? (
                  <div className="space-y-4">
                    {/* Price Hero Banner */}
                    <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-4 text-center">
                      <span className="text-[11px] uppercase tracking-wider font-bold text-blue-700 block">
                        Calculated Selling Price
                      </span>
                      <div className="text-3xl font-extrabold text-blue-900 my-1 font-mono">
                        {formatLKR(slicingResult.calculated_price_lkr)}
                      </div>
                      <div className="text-xs text-blue-700 font-medium">
                        Formula: {slicingResult.formula_applied}
                      </div>
                    </div>

                    {/* Telemetry Stats Grid */}
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                        <div className="flex items-center space-x-1.5 text-slate-500 mb-1">
                          <Weight className="w-3.5 h-3.5 text-blue-600" />
                          <span className="font-medium">Filament Weight</span>
                        </div>
                        <span className="text-base font-bold text-slate-900 font-mono">
                          {slicingResult.filament_used_grams} g
                        </span>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {slicingResult.filament_used_length_mm} mm length
                        </div>
                      </div>

                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                        <div className="flex items-center space-x-1.5 text-slate-500 mb-1">
                          <Clock className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="font-medium">Estimated Time</span>
                        </div>
                        <span className="text-base font-bold text-slate-900 font-mono">
                          {slicingResult.estimated_duration_formatted}
                        </span>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {slicingResult.layer_count} total layers
                        </div>
                      </div>
                    </div>

                    {/* Dimensions & Geometry */}
                    <div className="border border-slate-200 rounded-lg p-3 text-xs space-y-1.5">
                      <div className="flex justify-between items-center text-slate-600">
                        <span>Source File:</span>
                        <span className="font-semibold text-slate-900 max-w-[180px] truncate">
                          {slicingResult.filename}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-slate-600">
                        <span>Dimensions (X × Y × Z):</span>
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
                        <span>Triangle Facets:</span>
                        <span className="font-mono font-semibold text-slate-900">
                          {slicingResult.triangle_count.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-slate-600">
                        <span>Material Profile:</span>
                        <span className="font-semibold text-slate-900">
                          {slicingResult.material} ({slicingResult.layer_height_mm}mm layer)
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
                  <div className="h-64 flex flex-col items-center justify-center text-center p-6 border-2 border-dashed border-slate-200 rounded-xl">
                    <Layers className="w-10 h-10 text-slate-300 mb-2" />
                    <span className="font-bold text-sm text-slate-700">No Model Sliced Yet</span>
                    <p className="text-xs text-slate-400 mt-1 max-w-xs">
                      Select an .stl file or click "1-Click Test" to view dimensions, grams, printing duration, and the 28 LKR/g price estimation.
                    </p>
                  </div>
                )}
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
                <span>Pricing: Hardcoded 28 LKR / 1g</span>
                <span className="text-blue-600 font-semibold">VisionCraft Slicer Engine</span>
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
                    <th className="py-2.5 px-4 text-right">Price (28 LKR/g)</th>
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
