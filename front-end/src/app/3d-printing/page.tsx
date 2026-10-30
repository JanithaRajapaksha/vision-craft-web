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
  FileText,
  ShoppingBag,
  Printer,
  Copy,
  Check,
  X,
  Plus,
  Minus,
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
  has_supports?: boolean;
  support_grams?: string;
  support_volume_cm3?: string;
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

interface QuotationItem {
  id: string;
  quotation_id: string;
  title: string;
  description?: string;
  material: string;
  layer_height_mm: string;
  filament_grams: string;
  estimated_hours: string;
  quantity: number;
  unit_price_lkr: string;
  total_price_lkr: string;
}

interface Quotation {
  id: string;
  quotation_number: string;
  customer_name: string;
  customer_phone?: string;
  customer_email?: string;
  status: string;
  subtotal_lkr: string;
  discount_lkr: string;
  total_amount_lkr: string;
  valid_until: string;
  notes?: string;
  created_by_partner: string;
  created_at: string;
  items: QuotationItem[];
}

interface OrderItem {
  id: string;
  order_id: string;
  title: string;
  material: string;
  quantity: number;
  unit_price_lkr: string;
  total_price_lkr: string;
}

interface Order {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone?: string;
  status: string;
  total_amount_lkr: string;
  notes?: string;
  assigned_partner: string;
  created_at: string;
  items: OrderItem[];
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
  const ratePerGram = "25.0";

  const [slicingResult, setSlicingResult] = useState<SlicingResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Commercial States
  const [isQuoteModalOpen, setIsQuoteModalOpen] = useState(false);
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [activeQuotation, setActiveQuotation] = useState<Quotation | null>(null);
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [commercialLoading, setCommercialLoading] = useState(false);
  const [copiedNotification, setCopiedNotification] = useState(false);

  // Form Fields for Quote / Order
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [orderQuantity, setOrderQuantity] = useState(1);
  const [commercialNotes, setCommercialNotes] = useState("");

  // Authenticate helper with automatic recovery from stale/switched tokens
  const getAuthToken = async (forceRefresh: boolean = false): Promise<string> => {
    let token = typeof window !== "undefined" && !forceRefresh ? localStorage.getItem("token") : null;
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
      let token = await getAuthToken();
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("layer_height", layerHeight);
      formData.append("infill_percentage", infillPercentage.toString());
      formData.append("material", material);
      formData.append("rate_per_gram", ratePerGram);

      let res = await fetch("/api/v1/3d-printing/upload-and-slice", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      // If token is invalid or from a different environment (e.g. SQLite vs Docker PostgreSQL), re-auth and retry
      if (res.status === 401) {
        token = await getAuthToken(true);
        res = await fetch("/api/v1/3d-printing/upload-and-slice", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
      }

      if (!res.ok) {
        let errorMsg = `Server error (${res.status})`;
        try {
          const err = await res.json();
          errorMsg = err.detail || errorMsg;
        } catch {
          const text = await res.text();
          if (text) errorMsg = text;
        }
        throw new Error(errorMsg);
      }

      const result: SlicingResult = await res.json();
      setSlicingResult(result);
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
      let token = await getAuthToken();
      let res = await fetch(
        `/api/v1/3d-printing/sample-cube?size_mm=20.0&layer_height=${layerHeight}&infill_percentage=${infillPercentage}&material=${material}&rate_per_gram=${ratePerGram}`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      // If token is invalid or from a different environment, re-auth and retry
      if (res.status === 401) {
        token = await getAuthToken(true);
        res = await fetch(
          `/api/v1/3d-printing/sample-cube?size_mm=20.0&layer_height=${layerHeight}&infill_percentage=${infillPercentage}&material=${material}&rate_per_gram=${ratePerGram}`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
          }
        );
      }

      if (!res.ok) {
        let errorMsg = `Server error (${res.status})`;
        try {
          const err = await res.json();
          errorMsg = err.detail || errorMsg;
        } catch {
          const text = await res.text();
          if (text) errorMsg = text;
        }
        throw new Error(errorMsg);
      }

      const result: SlicingResult = await res.json();
      setSlicingResult(result);
      setSelectedFile(null);
      setPreviewUrl(`/api/v1/3d-printing/models/${result.cad_model_id}/stl`);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to test sample cube.");
    } finally {
      setLoading(false);
    }
  };

  // Handle Create Quotation
  const handleCreateQuotation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slicingResult) return;
    setCommercialLoading(true);
    setErrorMessage(null);
    try {
      let token = await getAuthToken();
      const payload = {
        slicing_job_id: slicingResult.job_id,
        customer_name: customerName.trim() || "Prospective Client",
        customer_phone: customerPhone.trim() || undefined,
        customer_email: customerEmail.trim() || undefined,
        quantity: Number(orderQuantity) || 1,
        notes: commercialNotes.trim() || undefined,
        created_by_partner: currentPartner,
      };

      let res = await fetch("/api/v1/commercial/quotations/from-slice", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (res.status === 401) {
        token = await getAuthToken(true);
        res = await fetch("/api/v1/commercial/quotations/from-slice", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });
      }

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to create quotation.");
      }

      const quote: Quotation = await res.json();
      setActiveQuotation(quote);
      setIsQuoteModalOpen(false);
      setCustomerName("");
      setCustomerPhone("");
      setCustomerEmail("");
      setOrderQuantity(1);
      setCommercialNotes("");
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to create quotation.");
    } finally {
      setCommercialLoading(false);
    }
  };

  // Handle Add to Order
  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slicingResult) return;
    setCommercialLoading(true);
    setErrorMessage(null);
    try {
      let token = await getAuthToken();
      const payload = {
        slicing_job_id: slicingResult.job_id,
        customer_name: customerName.trim() || "Walk-in Customer",
        customer_phone: customerPhone.trim() || undefined,
        customer_email: customerEmail.trim() || undefined,
        quantity: Number(orderQuantity) || 1,
        notes: commercialNotes.trim() || undefined,
        assigned_partner: currentPartner,
        payment_status: "UNPAID",
      };

      let res = await fetch("/api/v1/commercial/orders/from-slice", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (res.status === 401) {
        token = await getAuthToken(true);
        res = await fetch("/api/v1/commercial/orders/from-slice", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });
      }

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to add to active order.");
      }

      const order: Order = await res.json();
      setActiveOrder(order);
      setIsOrderModalOpen(false);
      setCustomerName("");
      setCustomerPhone("");
      setCustomerEmail("");
      setOrderQuantity(1);
      setCommercialNotes("");
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to add to order.");
    } finally {
      setCommercialLoading(false);
    }
  };

  // Copy WhatsApp Quotation Format
  const copyWhatsAppText = (quote: Quotation) => {
    const item = quote.items && quote.items[0];
    const text = `*VisionCraft 3D Printing Quotation*
Quotation No: *${quote.quotation_number}*
Client: *${quote.customer_name}*
Valid Until: ${new Date(quote.valid_until).toLocaleDateString()}

*Specification:*
- Item: ${item?.title || "FDM 3D Print"}
- Material: ${item?.material || "PLA+"} (${item?.layer_height_mm || "0.20"}mm layer height)
- Mass: ${item?.filament_grams || "0"}g per piece
- Quantity: ${item?.quantity || 1} pcs
- Unit Rate: ${formatLKR(item?.unit_price_lkr || "0")} (25.00 LKR/g)
--------------------------------------
*Total Amount: ${formatLKR(quote.total_amount_lkr)}*

_VisionCraft Engineering Solutions, Colombo, Sri Lanka_`;

    navigator.clipboard.writeText(text);
    setCopiedNotification(true);
    setTimeout(() => setCopiedNotification(false), 2500);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100">
      <Sidebar onOpenQuickExpense={() => {}} />

      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <Header
          currentPartner={currentPartner}
          onPartnerChange={setCurrentPartner}
        />

        {/* Studio Subheader Bar */}
        <div className="bg-white border-b border-slate-200 px-5 py-2.5 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <Layers className="w-5 h-5 text-blue-600" />
              <h1 className="text-sm font-bold text-slate-900 tracking-tight">
                VisionCraft FDM Slicing Studio
              </h1>
            </div>
            <div className="hidden sm:flex items-center space-x-2 text-[11px] text-slate-500 font-medium border-l border-slate-200 pl-3">
              <span>PLA+ only</span>
              <span>•</span>
              <span>0.2mm & 0.1mm layers</span>
              <span>•</span>
              <span className="font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">25.00 LKR/g</span>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleTestSampleCube}
              disabled={loading}
              className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg shadow-sm transition-all cursor-pointer shrink-0"
            >
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              <span>1-Click Test Cube</span>
            </button>
          </div>
        </div>

        {errorMessage && (
          <div className="mx-4 mt-2.5 p-2.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs font-medium flex items-center space-x-2 shrink-0">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Main Studio Viewport (Full Window Height, Zero Body Scroll) */}
        <main className="flex-1 flex flex-col lg:flex-row overflow-hidden p-3 gap-3">
          {/* Left: Interactive 3D WebGL Studio (Takes entire remaining space) */}
          <div className="flex-1 min-w-0 h-full bg-slate-900 rounded-xl border border-slate-800 shadow-sm flex flex-col overflow-hidden relative">
            {/* 3D Viewport Header Bar */}
            <div className="h-10 px-4 flex items-center justify-between bg-slate-800/90 border-b border-slate-700/60 shrink-0 text-slate-200">
              <div className="flex items-center space-x-2">
                <Eye className="w-4 h-4 text-blue-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-100">
                  Interactive 3D WebGL Studio
                </span>
              </div>
              <div className="flex items-center space-x-2 text-[11px] text-slate-400 font-medium truncate max-w-xs">
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

            {/* 3D Canvas Mount Point */}
            <div className="flex-1 relative w-full h-full min-h-[350px]">
              <STLViewer
                file={selectedFile}
                modelUrl={previewUrl}
                className="w-full h-full absolute inset-0"
              />
            </div>
          </div>

          {/* Right Panel: Upload, Parameters & Telemetry (Fixed width, internal scroll if screen is small) */}
          <div className="w-full lg:w-[420px] shrink-0 h-full flex flex-col overflow-y-auto space-y-3 pr-0.5">
            {/* Parameters & Upload Form Card */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3.5 shrink-0">
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center space-x-2">
                <Box className="w-4 h-4 text-blue-600" />
                <span>Slicing Parameters (PLA+ & 25 LKR/g)</span>
              </h2>

              <form onSubmit={handleSlice} className="space-y-3 text-xs">
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
                    className={`block border-2 border-dashed rounded-xl p-3 text-center cursor-pointer transition-all ${
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
                      className={`w-6 h-6 mx-auto mb-1 transition-colors ${
                        isDragging ? "text-blue-600 animate-bounce" : selectedFile ? "text-emerald-600" : "text-slate-400"
                      }`}
                    />
                    <div className="text-[11px] font-semibold text-blue-600 hover:text-blue-500">
                      {isDragging ? "Drop .stl file here" : "Browse or drag & drop .stl file"}
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5 truncate">
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
                <div className="grid grid-cols-2 gap-2.5 pt-0.5">
                  {/* Layer Height (Strictly 0.2 or 0.1 mm) */}
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Layer Height
                    </label>
                    <select
                      value={layerHeight}
                      onChange={(e) => setLayerHeight(e.target.value)}
                      className="w-full border border-slate-300 rounded-md p-1.5 bg-white text-slate-800 focus:ring-2 focus:ring-blue-500 font-medium text-xs"
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
                    <div className="p-1.5 bg-slate-100 border border-slate-200 rounded-md text-slate-800 font-semibold flex items-center justify-between text-xs">
                      <span>PLA+</span>
                      <span className="text-[10px] text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded font-mono">
                        1.24 g/cm³
                      </span>
                    </div>
                  </div>
                </div>

                {/* Infill Slider */}
                <div>
                  <div className="flex justify-between items-center mb-0.5">
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
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>10% Light</span>
                    <span>20% Std</span>
                    <span>50% Rigid</span>
                    <span>100% Solid</span>
                  </div>
                </div>

                {/* Support Detection & Rate */}
                <div className="grid grid-cols-2 gap-2.5 items-center pt-0.5">
                  <div className="p-1.5 bg-cyan-50/70 border border-cyan-200 rounded-md text-[10px] text-cyan-900 font-medium flex items-center space-x-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 shrink-0"></span>
                    <span>Auto Support Detection</span>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-0.5 text-[10px]">
                      Rate per 1g
                    </label>
                    <div className="p-1 bg-slate-100 border border-slate-200 rounded-md font-mono text-slate-800 font-bold flex justify-between items-center text-xs">
                      <span>25.00 LKR</span>
                      <span className="text-[9px] text-slate-500 font-normal">/ gram</span>
                    </div>
                  </div>
                </div>

                <div className="pt-1">
                  <button
                    type="submit"
                    disabled={loading || !selectedFile}
                    className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-lg shadow-sm flex items-center justify-center space-x-2 disabled:opacity-50 transition-all cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 fill-white" />
                    <span>{loading ? "Slicing Model & Calculating..." : "Slice STL & Calculate Price"}</span>
                  </button>
                </div>
              </form>
            </div>

            {/* Telemetry & Price Output Card */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3 shrink-0">
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center space-x-2">
                <FileCode className="w-4 h-4 text-emerald-600" />
                <span>Slicing Telemetry & Price (25 LKR/g)</span>
              </h2>

              {slicingResult ? (
                <div className="space-y-3">
                  {/* Price Hero Banner */}
                  <div className="bg-blue-50/80 border border-blue-200 rounded-xl p-3 text-center">
                    <span className="text-[10px] uppercase tracking-wider font-bold text-blue-700 block">
                      Calculated Selling Price
                    </span>
                    <div className="text-2xl font-extrabold text-blue-900 my-0.5 font-mono">
                      {formatLKR(slicingResult.calculated_price_lkr)}
                    </div>
                    <div className="text-[10px] text-blue-700 font-medium">
                      Formula: {slicingResult.formula_applied}
                    </div>
                  </div>

                  {/* Telemetry Stats Grid */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
                      <div className="flex items-center space-x-1.5 text-slate-500 mb-0.5">
                        <Weight className="w-3.5 h-3.5 text-blue-600" />
                        <span className="font-medium text-[10px]">Total Weight</span>
                      </div>
                      <span className="text-sm font-bold text-slate-900 font-mono">
                        {slicingResult.filament_used_grams} g
                      </span>
                      <div className="text-[9px] text-slate-400 mt-0.5">
                        {slicingResult.filament_used_length_mm} mm length
                      </div>
                    </div>

                    <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
                      <div className="flex items-center space-x-1.5 text-slate-500 mb-0.5">
                        <Clock className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="font-medium text-[10px]">Print Time</span>
                      </div>
                      <span className="text-sm font-bold text-slate-900 font-mono">
                        {slicingResult.estimated_duration_formatted}
                      </span>
                      <div className="text-[9px] text-slate-400 mt-0.5">
                        {slicingResult.layer_count} layers @ {slicingResult.layer_height_mm}mm
                      </div>
                    </div>
                  </div>

                  {/* Dimensions & Geometry */}
                  <div className="border border-slate-200 rounded-lg p-2 text-[10px] space-y-1">
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

                  {/* Sliced Support Telemetry Row */}
                  <div className="bg-cyan-50/50 p-1.5 rounded-lg border border-cyan-200/80 flex items-center justify-between text-[10px]">
                    <div className="flex items-center space-x-1.5 text-slate-700">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-500"></span>
                      <span className="font-semibold">Support Material:</span>
                    </div>
                    {slicingResult.has_supports || (parseFloat(slicingResult.support_grams || "0") > 0) ? (
                      <span className="font-bold text-cyan-800 bg-cyan-100/70 px-1.5 py-0.5 rounded border border-cyan-300">
                        +{slicingResult.support_grams || "0.00"} g included
                      </span>
                    ) : (
                      <span className="font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                        0.00 g (Self-supporting)
                      </span>
                    )}
                  </div>

                  {/* Commercial Actions: Get Quotation & Add to Order */}
                  <div className="pt-2 border-t border-slate-200/80 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setOrderQuantity(1);
                        setIsQuoteModalOpen(true);
                      }}
                      className="py-2.5 px-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold flex items-center justify-center space-x-1.5 shadow-sm transition-all cursor-pointer"
                    >
                      <FileText className="w-4 h-4 text-blue-100" />
                      <span>Get Quotation</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setOrderQuantity(1);
                        setIsOrderModalOpen(true);
                      }}
                      className="py-2.5 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold flex items-center justify-center space-x-1.5 shadow-sm transition-all cursor-pointer"
                    >
                      <ShoppingBag className="w-4 h-4 text-emerald-400" />
                      <span>Add to Order</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="py-5 px-3 flex flex-col items-center justify-center text-center border-2 border-dashed border-slate-200 rounded-xl">
                  <Layers className="w-7 h-7 text-slate-300 mb-1" />
                  <span className="font-bold text-xs text-slate-700">No Model Sliced Yet</span>
                  <p className="text-[10px] text-slate-400 mt-0.5 max-w-xs">
                    Choose an .stl model on the right or use 1-Click Test to extract telemetry and calculate price at 25 LKR/g.
                  </p>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* ========================================================================= */}
      {/* 1. Modal: Create Quotation */}
      {/* ========================================================================= */}
      {isQuoteModalOpen && slicingResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden flex flex-col">
            <div className="bg-slate-900 px-5 py-4 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="p-1.5 rounded-lg bg-blue-600/30 text-blue-400 border border-blue-500/30">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold tracking-tight">Generate Official Quotation</h3>
                  <p className="text-[11px] text-slate-400">14-Day Price Guarantee at 25 LKR/g</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsQuoteModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateQuotation} className="p-5 space-y-4 text-xs">
              {/* Sliced Model Summary Pill */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-900 block truncate max-w-[220px]">
                    {slicingResult.filename}
                  </span>
                  <span className="text-[10px] text-slate-500 font-medium">
                    {slicingResult.filament_used_grams}g PLA+ • {slicingResult.layer_height_mm}mm layers
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Unit Price</span>
                  <span className="font-extrabold text-blue-900 font-mono text-sm">
                    {formatLKR(slicingResult.calculated_price_lkr)}
                  </span>
                </div>
              </div>

              {/* Customer Inputs */}
              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Customer / Company Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Kasun Perera / Apex Robotics"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      WhatsApp / Phone
                    </label>
                    <input
                      type="text"
                      placeholder="+94 77 ..."
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Email (Optional)
                    </label>
                    <input
                      type="email"
                      placeholder="client@email.com"
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Quantity Stepper & Live Total */}
                <div className="border border-slate-200 rounded-xl p-3 bg-blue-50/40 flex items-center justify-between">
                  <div>
                    <span className="block font-bold text-slate-900 text-xs">Quantity</span>
                    <span className="text-[10px] text-slate-500">Number of printed units</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => setOrderQuantity(Math.max(1, orderQuantity - 1))}
                      className="w-7 h-7 flex items-center justify-center rounded-lg bg-white border border-slate-300 hover:bg-slate-100 font-bold cursor-pointer"
                    >
                      <Minus className="w-3.5 h-3.5 text-slate-700" />
                    </button>
                    <input
                      type="number"
                      min={1}
                      max={500}
                      value={orderQuantity}
                      onChange={(e) => setOrderQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-12 text-center py-1 border border-slate-300 rounded-lg font-bold font-mono text-xs bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => setOrderQuantity(orderQuantity + 1)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg bg-white border border-slate-300 hover:bg-slate-100 font-bold cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5 text-slate-700" />
                    </button>
                  </div>
                </div>

                {/* Total Quote Value Preview */}
                <div className="flex justify-between items-center px-1">
                  <span className="text-xs font-bold text-slate-600">Total Quotation Value:</span>
                  <span className="text-base font-extrabold text-blue-900 font-mono">
                    {formatLKR(
                      (parseFloat(slicingResult.calculated_price_lkr) * orderQuantity).toFixed(2)
                    )}
                  </span>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Special Notes / Specifications
                  </label>
                  <textarea
                    rows={2}
                    placeholder="e.g. 20% infill, black PLA+, smooth bed finish"
                    value={commercialNotes}
                    onChange={(e) => setCommercialNotes(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setIsQuoteModalOpen(false)}
                  className="flex-1 py-2 px-3 border border-slate-300 text-slate-700 font-semibold rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={commercialLoading}
                  className="flex-1 py-2 px-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg shadow-sm transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center space-x-1.5"
                >
                  {commercialLoading ? (
                    <span>Generating...</span>
                  ) : (
                    <>
                      <FileText className="w-3.5 h-3.5" />
                      <span>Create Quotation</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. Modal: Add to Active Order */}
      {/* ========================================================================= */}
      {isOrderModalOpen && slicingResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden flex flex-col">
            <div className="bg-slate-900 px-5 py-4 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="p-1.5 rounded-lg bg-emerald-600/30 text-emerald-400 border border-emerald-500/30">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold tracking-tight">Queue Active Production Order</h3>
                  <p className="text-[11px] text-slate-400">Assigns job directly to 3D printer queue</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOrderModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateOrder} className="p-5 space-y-4 text-xs">
              {/* Sliced Model Summary */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-900 block truncate max-w-[220px]">
                    {slicingResult.filename}
                  </span>
                  <span className="text-[10px] text-slate-500 font-medium">
                    {slicingResult.estimated_duration_formatted} print time • {slicingResult.filament_used_grams}g
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Unit Price</span>
                  <span className="font-extrabold text-slate-900 font-mono text-sm">
                    {formatLKR(slicingResult.calculated_price_lkr)}
                  </span>
                </div>
              </div>

              {/* Customer Inputs */}
              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Customer Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Customer or Project Name"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Contact Phone / WhatsApp
                  </label>
                  <input
                    type="text"
                    placeholder="+94 77 ..."
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                {/* Quantity */}
                <div className="border border-slate-200 rounded-xl p-3 bg-emerald-50/40 flex items-center justify-between">
                  <div>
                    <span className="block font-bold text-slate-900 text-xs">Batch Quantity</span>
                    <span className="text-[10px] text-slate-500">Number of copies to produce</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => setOrderQuantity(Math.max(1, orderQuantity - 1))}
                      className="w-7 h-7 flex items-center justify-center rounded-lg bg-white border border-slate-300 hover:bg-slate-100 font-bold cursor-pointer"
                    >
                      <Minus className="w-3.5 h-3.5 text-slate-700" />
                    </button>
                    <input
                      type="number"
                      min={1}
                      max={500}
                      value={orderQuantity}
                      onChange={(e) => setOrderQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-12 text-center py-1 border border-slate-300 rounded-lg font-bold font-mono text-xs bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => setOrderQuantity(orderQuantity + 1)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg bg-white border border-slate-300 hover:bg-slate-100 font-bold cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5 text-slate-700" />
                    </button>
                  </div>
                </div>

                {/* Production Total */}
                <div className="flex justify-between items-center px-1">
                  <span className="text-xs font-bold text-slate-600">Total Order Revenue:</span>
                  <span className="text-base font-extrabold text-emerald-900 font-mono">
                    {formatLKR(
                      (parseFloat(slicingResult.calculated_price_lkr) * orderQuantity).toFixed(2)
                    )}
                  </span>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Production Notes / Filament Color
                  </label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Standard Black PLA+, smooth finish, priority print"
                    value={commercialNotes}
                    onChange={(e) => setCommercialNotes(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setIsOrderModalOpen(false)}
                  className="flex-1 py-2 px-3 border border-slate-300 text-slate-700 font-semibold rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={commercialLoading}
                  className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg shadow-sm transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center space-x-1.5"
                >
                  {commercialLoading ? (
                    <span>Queueing...</span>
                  ) : (
                    <>
                      <ShoppingBag className="w-3.5 h-3.5" />
                      <span>Confirm & Queue Order</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. Modal: Printable / Shareable Official Quotation Sheet */}
      {/* ========================================================================= */}
      {activeQuotation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col my-auto">
            {/* Action Bar (Top) */}
            <div className="bg-slate-900 px-6 py-3.5 text-white flex items-center justify-between print:hidden">
              <div className="flex items-center space-x-2">
                <FileText className="w-5 h-5 text-blue-400" />
                <span className="font-bold text-sm">Official Quotation Created</span>
                <span className="bg-blue-900 text-blue-200 text-[10px] px-2 py-0.5 rounded font-mono font-semibold">
                  {activeQuotation.quotation_number}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => copyWhatsAppText(activeQuotation)}
                  className="flex items-center space-x-1 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-semibold text-emerald-400 border border-slate-700 transition-colors cursor-pointer"
                >
                  {copiedNotification ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy for WhatsApp</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex items-center space-x-1 px-2.5 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-xs font-semibold text-white transition-colors cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print / PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveQuotation(null)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable Quotation Document */}
            <div className="p-8 space-y-6 text-slate-800">
              {/* Header with VisionCraft Branding */}
              <div className="flex justify-between items-start border-b border-slate-200 pb-5">
                <div>
                  <h1 className="text-2xl font-black text-slate-900 tracking-tight">VisionCraft</h1>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    Engineering Design & Rapid FDM 3D Prototyping
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Colombo, Sri Lanka • contact@visioncraft.lk
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold uppercase tracking-wider text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200">
                    Quotation
                  </span>
                  <div className="text-lg font-black text-slate-900 font-mono mt-2">
                    {activeQuotation.quotation_number}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Date: {new Date(activeQuotation.created_at).toLocaleDateString()}
                  </div>
                  <div className="text-[11px] text-emerald-600 font-semibold">
                    Valid Until: {new Date(activeQuotation.valid_until).toLocaleDateString()}
                  </div>
                </div>
              </div>

              {/* Client & Partner Details */}
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider block mb-1">
                    Quotation Prepared For:
                  </span>
                  <div className="font-bold text-slate-900 text-sm">{activeQuotation.customer_name}</div>
                  {activeQuotation.customer_phone && (
                    <div className="text-slate-600 text-[11px] mt-0.5">
                      Phone/WhatsApp: {activeQuotation.customer_phone}
                    </div>
                  )}
                  {activeQuotation.customer_email && (
                    <div className="text-slate-600 text-[11px]">{activeQuotation.customer_email}</div>
                  )}
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider block mb-1">
                    Prepared By:
                  </span>
                  <div className="font-bold text-slate-900 text-sm">{activeQuotation.created_by_partner}</div>
                  <div className="text-slate-500 text-[11px]">VisionCraft Co-Founder</div>
                  <div className="text-blue-700 font-semibold text-[11px] mt-1">Rate: 25.00 LKR / 1g PLA+</div>
                </div>
              </div>

              {/* Items Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold uppercase text-[10px]">
                    <tr>
                      <th className="py-2.5 px-3">Item Description</th>
                      <th className="py-2.5 px-3 text-center">Material & Spec</th>
                      <th className="py-2.5 px-3 text-center">Mass (g)</th>
                      <th className="py-2.5 px-3 text-center">Qty</th>
                      <th className="py-2.5 px-3 text-right">Unit Rate (LKR)</th>
                      <th className="py-2.5 px-3 text-right">Total (LKR)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {activeQuotation.items.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/50">
                        <td className="py-3 px-3 font-semibold text-slate-900">
                          {item.title}
                          {activeQuotation.notes && (
                            <span className="block text-[10px] text-slate-400 font-normal mt-0.5">
                              Note: {activeQuotation.notes}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center text-slate-600">
                          {item.material} • {item.layer_height_mm}mm
                        </td>
                        <td className="py-3 px-3 text-center font-mono">{item.filament_grams} g</td>
                        <td className="py-3 px-3 text-center font-bold">{item.quantity}</td>
                        <td className="py-3 px-3 text-right font-mono text-slate-700">
                          {formatLKR(item.unit_price_lkr)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                          {formatLKR(item.total_price_lkr)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Total & Terms */}
              <div className="flex justify-between items-end pt-2">
                <div className="text-[10px] text-slate-400 max-w-sm space-y-0.5">
                  <p className="font-semibold text-slate-600">Terms & Conditions:</p>
                  <p>• All parts are fabricated using high-grade PLA+ with calibrated FDM parameters.</p>
                  <p>• Quotation valid for 14 calendar days from date of issue.</p>
                  <p>• 50% advance required upon production order confirmation.</p>
                </div>
                <div className="text-right bg-blue-50/60 border border-blue-200 rounded-xl p-4 min-w-[220px]">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 block">
                    Total Amount Due
                  </span>
                  <div className="text-2xl font-black text-blue-900 font-mono mt-0.5">
                    {formatLKR(activeQuotation.total_amount_lkr)}
                  </div>
                  <span className="text-[10px] text-slate-500 font-medium">All prices in Sri Lankan Rupees (LKR)</span>
                </div>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex items-center justify-between print:hidden">
              <span className="text-[11px] text-slate-500">
                Created by {activeQuotation.created_by_partner} on {new Date(activeQuotation.created_at).toLocaleDateString()}
              </span>
              <button
                type="button"
                onClick={() => setActiveQuotation(null)}
                className="py-1.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg text-xs transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. Toast: Active Order Confirmation */}
      {/* ========================================================================= */}
      {activeOrder && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white rounded-2xl p-4 shadow-2xl border border-slate-800 max-w-sm animate-in slide-in-from-bottom-5">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold">Order Queued Successfully!</h4>
                <div className="text-sm font-extrabold font-mono text-emerald-400 mt-0.5">
                  {activeOrder.order_number}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setActiveOrder(null)}
              className="text-slate-400 hover:text-white p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-800 text-[11px] text-slate-300 flex justify-between items-center">
            <span>Customer: <strong className="text-white">{activeOrder.customer_name}</strong></span>
            <span className="font-mono font-bold text-white">{formatLKR(activeOrder.total_amount_lkr)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
