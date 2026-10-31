"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { PCBViewer, DrillHoleData, PadData } from "@/components/3d/pcb-viewer";
import { formatLKR } from "@/lib/utils";
import {
  Cpu,
  UploadCloud,
  FileCode,
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
  Layers,
  ArrowRight,
} from "lucide-react";

interface PCBAnalysis {
  board_name: string;
  width_mm: number;
  length_mm: number;
  thickness_mm: number;
  area_cm2: number;
  layer_count: number;
  hole_count: number;
  top_pad_count: number;
  bottom_pad_count: number;
  rate_per_cm2_lkr: string;
  calculated_price_lkr: string;
  formula_applied: string;
  identified_layers: Record<string, string>;
  drills: DrillHoleData[];
  top_pads: PadData[];
  bottom_pads: PadData[];
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
  customer_email?: string;
  status: string;
  payment_status: string;
  paid_amount_lkr: string;
  total_amount_lkr: string;
  assigned_partner: string;
  notes?: string;
  created_at: string;
  items: OrderItem[];
}

const SOLDER_MASK_COLORS = [
  { name: "Green", label: "Classic Green", hex: "#166534", bgClass: "bg-emerald-700" },
  { name: "Matte Black", label: "Matte Black", hex: "#18181b", bgClass: "bg-zinc-900" },
  { name: "Royal Blue", label: "Royal Blue", hex: "#1d4ed8", bgClass: "bg-blue-700" },
  { name: "Signal Red", label: "Signal Red", hex: "#b91c1c", bgClass: "bg-red-700" },
  { name: "White", label: "Clean White", hex: "#f1f5f9", bgClass: "bg-slate-200 text-slate-800" },
  { name: "Purple", label: "OSH Purple", hex: "#6b21a8", bgClass: "bg-purple-700" },
];

const THICKNESS_OPTIONS = [0.8, 1.0, 1.2, 1.6];
const PARTNERS = ["Janitha", "Melanka", "Lalitha", "Thakshila"];

export default function EngineeringPCBPage() {
  const [currentPartner, setCurrentPartner] = useState("Janitha");
  const [activeTab, setActiveTab] = useState<"visualizer" | "layers">("visualizer");

  // PCB Analysis State
  const [analysis, setAnalysis] = useState<PCBAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [downloadingSTL, setDownloadingSTL] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Configuration Parameters
  const [ratePerCm2, setRatePerCm2] = useState<number>(15.0);
  const [thicknessMm, setThicknessMm] = useState<number>(1.6);
  const [solderMaskColor, setSolderMaskColor] = useState<string>("Green");
  const [padFinish, setPadFinish] = useState<"ENIG" | "HASL">("ENIG");

  // Commercial Modals
  const [isQuoteModalOpen, setIsQuoteModalOpen] = useState(false);
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [createdQuotation, setCreatedQuotation] = useState<Quotation | null>(null);
  const [createdOrder, setCreatedOrder] = useState<Order | null>(null);
  const [quoteSuccessOpen, setQuoteSuccessOpen] = useState(false);
  const [orderSuccessOpen, setOrderSuccessOpen] = useState(false);
  const [copiedQuote, setCopiedQuote] = useState(false);
  const [copiedOrder, setCopiedOrder] = useState(false);

  // Form Fields
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [orderQuantity, setOrderQuantity] = useState<number>(5);
  const [assignedPartner, setAssignedPartner] = useState("Janitha");
  const [orderNotes, setOrderNotes] = useState("");
  const [commercialSubmitting, setCommercialSubmitting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-login & Token Helper
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
        console.warn("Auth fetch failed:", err);
      }
    }
    return token || "";
  };

  // Load Benchmark Sample Board automatically on initial mount
  useEffect(() => {
    loadBenchmarkBoard();
  }, []);

  // 1-Click Benchmark Board Loader
  const loadBenchmarkBoard = async () => {
    setAnalyzing(true);
    setErrorMessage(null);
    try {
      const res = await fetch(
        `/api/v1/pcb/sample-board?rate_per_cm2_lkr=${ratePerCm2}&pcb_thickness_mm=${thicknessMm}`,
        { method: "POST" }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Failed to generate sample PCB." }));
        throw new Error(err.detail || "Sample PCB failed to generate.");
      }
      const data: PCBAnalysis = await res.json();
      setAnalysis(data);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || "Failed to load benchmark PCB.");
    } finally {
      setAnalyzing(false);
    }
  };

  // Upload and analyze Gerber Archive (.zip) or loose Gerber files
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setAnalyzing(true);
    setErrorMessage(null);

    try {
      const formData = new FormData();
      for (let i = 0; i < files.length; i++) {
        formData.append("files", files[i]);
      }
      formData.append("rate_per_cm2_lkr", ratePerCm2.toString());
      formData.append("pcb_thickness_mm", thicknessMm.toString());
      formData.append("solder_mask_color", solderMaskColor);

      const res = await fetch("/api/v1/pcb/upload-and-analyze", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Failed to parse Gerber files." }));
        throw new Error(err.detail || "Unable to extract PCB layers from upload.");
      }

      const data: PCBAnalysis = await res.json();
      setAnalysis(data);
    } catch (err: any) {
      console.error("PCB parse error:", err);
      setErrorMessage(err.message || "Failed to parse Gerber files.");
    } finally {
      setAnalyzing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Re-calculate price when rate or thickness changes
  const handleRateOrThicknessChange = async (newRate: number, newThickness: number) => {
    setRatePerCm2(newRate);
    setThicknessMm(newThickness);

    if (analysis) {
      const area = analysis.area_cm2;
      const layerFactor = analysis.layer_count === 1 ? 1.0 : 1.25;
      const calcPrice = Math.max(500, area * newRate * layerFactor);

      setAnalysis({
        ...analysis,
        thickness_mm: newThickness,
        rate_per_cm2_lkr: newRate.toFixed(2),
        calculated_price_lkr: calcPrice.toFixed(2),
        formula_applied: `${area} cm² × ${newRate.toFixed(2)} LKR/cm² (Layer factor: ${layerFactor}x)`,
      });
    }
  };

  // Download 3D STL file of the board
  const handleDownloadSTL = async () => {
    if (!analysis) return;
    setDownloadingSTL(true);
    try {
      const res = await fetch("/api/v1/pcb/generate-stl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          width_mm: analysis.width_mm,
          length_mm: analysis.length_mm,
          thickness_mm: analysis.thickness_mm,
          drills: analysis.drills,
          pads: analysis.top_pads,
        }),
      });

      if (!res.ok) throw new Error("Failed to generate STL mesh.");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${analysis.board_name}_3D.stl`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      alert("Error generating STL: " + err.message);
    } finally {
      setDownloadingSTL(false);
    }
  };

  // Create Quotation
  const handleCreateQuotation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!analysis) return;

    setCommercialSubmitting(true);
    try {
      let token = await getAuthToken();
      let res = await fetch("/api/v1/pcb/quotation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          board_name: analysis.board_name,
          customer_name: customerName,
          customer_phone: customerPhone || undefined,
          customer_email: customerEmail || undefined,
          width_mm: analysis.width_mm,
          length_mm: analysis.length_mm,
          area_cm2: analysis.area_cm2,
          layer_count: analysis.layer_count,
          thickness_mm: analysis.thickness_mm,
          solder_mask_color: solderMaskColor,
          quantity: orderQuantity,
          rate_per_cm2_lkr: analysis.rate_per_cm2_lkr,
          unit_price_lkr: analysis.calculated_price_lkr,
          notes: orderNotes || undefined,
          created_by_partner: currentPartner,
        }),
      });

      if (res.status === 401) {
        token = await getAuthToken(true);
        res = await fetch("/api/v1/pcb/quotation", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            board_name: analysis.board_name,
            customer_name: customerName,
            customer_phone: customerPhone || undefined,
            customer_email: customerEmail || undefined,
            width_mm: analysis.width_mm,
            length_mm: analysis.length_mm,
            area_cm2: analysis.area_cm2,
            layer_count: analysis.layer_count,
            thickness_mm: analysis.thickness_mm,
            solder_mask_color: solderMaskColor,
            quantity: orderQuantity,
            rate_per_cm2_lkr: analysis.rate_per_cm2_lkr,
            unit_price_lkr: analysis.calculated_price_lkr,
            notes: orderNotes || undefined,
            created_by_partner: currentPartner,
          }),
        });
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Failed to create quotation." }));
        throw new Error(err.detail || "Quotation creation failed.");
      }

      const quoteData: Quotation = await res.json();
      setCreatedQuotation(quoteData);
      setIsQuoteModalOpen(false);
      setQuoteSuccessOpen(true);
    } catch (err: any) {
      alert("Quotation Error: " + err.message);
    } finally {
      setCommercialSubmitting(false);
    }
  };

  // Add PCB directly to Production Order
  const handleAddToOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!analysis) return;

    setCommercialSubmitting(true);
    try {
      let token = await getAuthToken();
      let res = await fetch("/api/v1/pcb/order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          board_name: analysis.board_name,
          customer_name: customerName,
          customer_phone: customerPhone || undefined,
          customer_email: customerEmail || undefined,
          width_mm: analysis.width_mm,
          length_mm: analysis.length_mm,
          area_cm2: analysis.area_cm2,
          layer_count: analysis.layer_count,
          thickness_mm: analysis.thickness_mm,
          solder_mask_color: solderMaskColor,
          quantity: orderQuantity,
          unit_price_lkr: analysis.calculated_price_lkr,
          assigned_partner: assignedPartner,
          notes: orderNotes || undefined,
        }),
      });

      if (res.status === 401) {
        token = await getAuthToken(true);
        res = await fetch("/api/v1/pcb/order", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            board_name: analysis.board_name,
            customer_name: customerName,
            customer_phone: customerPhone || undefined,
            customer_email: customerEmail || undefined,
            width_mm: analysis.width_mm,
            length_mm: analysis.length_mm,
            area_cm2: analysis.area_cm2,
            layer_count: analysis.layer_count,
            thickness_mm: analysis.thickness_mm,
            solder_mask_color: solderMaskColor,
            quantity: orderQuantity,
            unit_price_lkr: analysis.calculated_price_lkr,
            assigned_partner: assignedPartner,
            notes: orderNotes || undefined,
          }),
        });
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Failed to queue order." }));
        throw new Error(err.detail || "Order queueing failed.");
      }

      const orderData: Order = await res.json();
      setCreatedOrder(orderData);
      setIsOrderModalOpen(false);
      setOrderSuccessOpen(true);
    } catch (err: any) {
      alert("Order Error: " + err.message);
    } finally {
      setCommercialSubmitting(false);
    }
  };

  const copyToClipboard = (text: string, type: "quote" | "order") => {
    navigator.clipboard.writeText(text);
    if (type === "quote") {
      setCopiedQuote(true);
      setTimeout(() => setCopiedQuote(false), 2000);
    } else {
      setCopiedOrder(true);
      setTimeout(() => setCopiedOrder(false), 2000);
    }
  };

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden font-sans">
      <Sidebar onOpenQuickExpense={() => {}} />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header
          currentPartner={currentPartner}
          onPartnerChange={setCurrentPartner}
        />

        {/* Main Studio Viewport */}
        <main className="flex-1 flex flex-col md:flex-row overflow-hidden bg-slate-900">
          {/* ========================================================================= */}
          {/* LEFT: Interactive 3D WebGL PCB Board Studio */}
          {/* ========================================================================= */}
          <div className="flex-1 flex flex-col relative h-[50vh] md:h-full border-b md:border-b-0 md:border-r border-slate-800 bg-slate-950">
            {/* Top Bar with Board Header and Detected Layers */}
            <div className="p-3 bg-slate-900/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 z-10 shrink-0">
              <div className="flex items-center space-x-2">
                <div className="p-1.5 rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30">
                  <Cpu className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-xs font-bold text-white flex items-center space-x-2">
                    <span className="truncate max-w-[200px]">
                      {analysis ? analysis.board_name : "PCB Gerber Studio"}
                    </span>
                    {analysis && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 font-mono font-normal">
                        {analysis.layer_count}-Layer
                      </span>
                    )}
                  </h2>
                  <p className="text-[10px] text-slate-400">
                    RS-274X Gerber & Excellon Drill 3D Mesh Inspection
                  </p>
                </div>
              </div>

              {/* Detected Layers Badges */}
              {analysis && (
                <div className="flex items-center space-x-1.5 text-[10px]">
                  {Object.entries(analysis.identified_layers).map(([type, fname]) => (
                    <span
                      key={type}
                      className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700/80 font-mono"
                      title={fname}
                    >
                      {type.replace("_", " ").toUpperCase()}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* 3D WebGL Canvas */}
            <div className="flex-1 relative overflow-hidden flex items-center justify-center">
              {analyzing ? (
                <div className="flex flex-col items-center justify-center space-y-3 text-slate-300">
                  <div className="w-10 h-10 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                  <p className="text-xs font-bold tracking-wider uppercase text-blue-400">
                    Extracting Gerbers & Calculating Bounding Contours...
                  </p>
                </div>
              ) : analysis ? (
                <PCBViewer
                  width_mm={analysis.width_mm}
                  length_mm={analysis.length_mm}
                  thickness_mm={analysis.thickness_mm}
                  solderMaskColor={solderMaskColor}
                  padFinish={padFinish}
                  drills={analysis.drills}
                  topPads={analysis.top_pads}
                  bottomPads={analysis.bottom_pads}
                  className="w-full h-full"
                />
              ) : (
                <div className="text-center p-6 text-slate-500">
                  <Cpu className="w-12 h-12 mx-auto mb-2 opacity-40 text-blue-400" />
                  <p className="text-sm font-semibold text-slate-300">No PCB Design Loaded</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Upload a Gerber ZIP package or click "Benchmark Board" to inspect.
                  </p>
                </div>
              )}

              {/* Error banner */}
              {errorMessage && (
                <div className="absolute top-4 inset-x-4 bg-rose-950/90 border border-rose-500 text-rose-200 px-4 py-2.5 rounded-xl text-xs flex items-center space-x-2 z-20 shadow-xl">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span className="flex-1 font-medium">{errorMessage}</span>
                  <button onClick={() => setErrorMessage(null)} className="text-rose-400 hover:text-white">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            {/* Bottom STL Export Bar */}
            {analysis && (
              <div className="p-2.5 bg-slate-900 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 z-10 shrink-0">
                <div className="flex items-center space-x-3 text-[11px] font-mono">
                  <span>
                    Drills: <strong className="text-white">{analysis.hole_count}</strong>
                  </span>
                  <span>•</span>
                  <span>
                    Top Pads: <strong className="text-white">{analysis.top_pad_count}</strong>
                  </span>
                  <span>•</span>
                  <span>
                    Bottom Pads: <strong className="text-white">{analysis.bottom_pad_count}</strong>
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleDownloadSTL}
                  disabled={downloadingSTL}
                  className="flex items-center space-x-1.5 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-[11px] font-bold transition-all cursor-pointer disabled:opacity-50"
                >
                  <Download className="w-3.5 h-3.5 text-blue-400" />
                  <span>{downloadingSTL ? "Generating 3D STL..." : "Download Board 3D STL"}</span>
                </button>
              </div>
            )}
          </div>

          {/* ========================================================================= */}
          {/* RIGHT: Parameter & Engineering Drawer */}
          {/* ========================================================================= */}
          <div className="w-full md:w-[420px] lg:w-[460px] bg-white border-l border-slate-200 flex flex-col h-[50vh] md:h-full overflow-hidden shadow-2xl shrink-0">
            {/* Drawer Header */}
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
              <div className="flex items-center space-x-2">
                <Cpu className="w-4 h-4 text-blue-600" />
                <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800">
                  PCB Fabrication & Sizing
                </h3>
              </div>
              <button
                type="button"
                onClick={loadBenchmarkBoard}
                disabled={analyzing}
                className="flex items-center space-x-1 px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-[11px] font-bold transition-all cursor-pointer disabled:opacity-50"
              >
                <Sparkles className="w-3 h-3 text-blue-600" />
                <span>Benchmark Board</span>
              </button>
            </div>

            {/* Scrollable Configuration Controls */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
              {/* 1. File Upload Dropzone */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                  Upload Gerber Package (.zip or .gbr)
                </label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-xl p-4 text-center cursor-pointer transition-all bg-slate-50/70 hover:bg-blue-50/20 group"
                >
                  <UploadCloud className="w-6 h-6 text-slate-400 group-hover:text-blue-500 mx-auto mb-1 transition-colors" />
                  <span className="font-bold text-xs text-slate-700 block">
                    Drop Gerber Archive or Click to Browse
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    Supports .gm1/.gko outline, .gtl/.gbl copper, and .drl/.xln drills
                  </span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".zip,.gbr,.gm1,.gm2,.gko,.gtl,.gbl,.drl,.xln,.txt"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </div>
              </div>

              {/* 2. Board Configuration (Solder Mask, Thickness, Finish) */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-3">
                <span className="text-[11px] font-bold text-slate-800 uppercase tracking-wider block">
                  Fabrication Specifications
                </span>

                {/* Solder Mask Color Selection */}
                <div>
                  <span className="text-[10px] font-semibold text-slate-500 block mb-1.5">
                    Solder Mask Color: <strong className="text-slate-900">{solderMaskColor}</strong>
                  </span>
                  <div className="grid grid-cols-3 gap-1.5">
                    {SOLDER_MASK_COLORS.map((col) => (
                      <button
                        key={col.name}
                        type="button"
                        onClick={() => setSolderMaskColor(col.name)}
                        className={`flex items-center space-x-1.5 px-2 py-1.5 rounded-lg border text-[11px] font-medium transition-all cursor-pointer ${
                          solderMaskColor === col.name
                            ? "border-blue-600 bg-white ring-2 ring-blue-500/20 text-slate-900 font-bold shadow-sm"
                            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        <span className={`w-3 h-3 rounded-full shrink-0 shadow-inner ${col.bgClass}`} />
                        <span className="truncate">{col.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* PCB Thickness Selection */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[10px] font-semibold text-slate-500 block mb-1">
                      Board Thickness:
                    </span>
                    <div className="grid grid-cols-4 gap-1">
                      {THICKNESS_OPTIONS.map((th) => (
                        <button
                          key={th}
                          type="button"
                          onClick={() => handleRateOrThicknessChange(ratePerCm2, th)}
                          className={`py-1 text-center rounded-lg border text-[10px] font-mono font-bold transition-all cursor-pointer ${
                            thicknessMm === th
                              ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                              : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
                          }`}
                        >
                          {th}mm
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Surface Finish */}
                  <div>
                    <span className="text-[10px] font-semibold text-slate-500 block mb-1">
                      Surface Finish:
                    </span>
                    <div className="grid grid-cols-2 gap-1">
                      {[
                        { id: "ENIG", label: "ENIG (Gold)" },
                        { id: "HASL", label: "HASL (Silver)" },
                      ].map((fin) => (
                        <button
                          key={fin.id}
                          type="button"
                          onClick={() => setPadFinish(fin.id as "ENIG" | "HASL")}
                          className={`py-1 text-center rounded-lg border text-[10px] font-semibold transition-all cursor-pointer ${
                            padFinish === fin.id
                              ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                              : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
                          }`}
                        >
                          {fin.id}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Base Rate per cm² input */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-semibold text-slate-500">
                      Fabrication Rate (LKR / cm²):
                    </span>
                    <span className="text-[11px] font-mono font-bold text-blue-900">
                      {ratePerCm2.toFixed(2)} LKR/cm²
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="range"
                      min={5.0}
                      max={40.0}
                      step={1.0}
                      value={ratePerCm2}
                      onChange={(e) =>
                        handleRateOrThicknessChange(parseFloat(e.target.value), thicknessMm)
                      }
                      className="flex-1 accent-blue-600 cursor-pointer"
                    />
                    <input
                      type="number"
                      step={0.5}
                      min={1.0}
                      max={100.0}
                      value={ratePerCm2}
                      onChange={(e) =>
                        handleRateOrThicknessChange(
                          parseFloat(e.target.value) || 15.0,
                          thicknessMm
                        )
                      }
                      className="w-16 px-2 py-1 text-right border border-slate-300 rounded text-xs font-mono font-bold"
                    />
                  </div>
                </div>
              </div>

              {/* 3. Real-Time Telemetry & Pricing Card */}
              {analysis && (
                <div className="bg-slate-900 text-white rounded-xl p-4 shadow-xl border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <div className="flex items-center space-x-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Board Sizing & Area
                      </span>
                    </div>
                    <span className="font-mono text-xs text-blue-400 font-bold">
                      {analysis.area_cm2} cm²
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700/60">
                      <span className="text-[10px] text-slate-400 block font-medium">
                        Width × Length
                      </span>
                      <span className="font-mono font-bold text-white text-sm">
                        {analysis.width_mm} × {analysis.length_mm} mm
                      </span>
                    </div>

                    <div className="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700/60">
                      <span className="text-[10px] text-slate-400 block font-medium">
                        Plated Holes (Drills)
                      </span>
                      <span className="font-mono font-bold text-emerald-400 text-sm">
                        {analysis.hole_count} holes
                      </span>
                    </div>

                    <div className="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700/60">
                      <span className="text-[10px] text-slate-400 block font-medium">
                        Layers & Mask
                      </span>
                      <span className="font-bold text-white text-xs">
                        {analysis.layer_count}-Layer • {solderMaskColor}
                      </span>
                    </div>

                    <div className="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700/60">
                      <span className="text-[10px] text-slate-400 block font-medium">
                        Copper Pads Total
                      </span>
                      <span className="font-mono font-bold text-amber-300 text-sm">
                        {analysis.top_pad_count + analysis.bottom_pad_count} pads
                      </span>
                    </div>
                  </div>

                  {/* Calculated Price Showcase */}
                  <div className="pt-2 border-t border-slate-800 flex items-end justify-between">
                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-wider">
                        Unit Fabrication Price
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {analysis.formula_applied}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-xl font-black text-emerald-400 font-mono tracking-tight block">
                        {formatLKR(analysis.calculated_price_lkr)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Commercial Action Buttons */}
            {analysis && (
              <div className="p-4 bg-slate-50 border-t border-slate-200 space-y-2 shrink-0">
                <div className="grid grid-cols-2 gap-2">
                  {/* [Get Quotation] Button */}
                  <button
                    type="button"
                    onClick={() => setIsQuoteModalOpen(true)}
                    className="flex items-center justify-center space-x-1.5 py-2.5 px-3 bg-white hover:bg-slate-100 text-slate-900 border border-slate-300 rounded-xl font-bold text-xs shadow-sm transition-all cursor-pointer"
                  >
                    <FileText className="w-4 h-4 text-blue-600" />
                    <span>Get Quotation</span>
                  </button>

                  {/* [Add to Order] Button */}
                  <button
                    type="button"
                    onClick={() => setIsOrderModalOpen(true)}
                    className="flex items-center justify-center space-x-1.5 py-2.5 px-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-xs shadow-md transition-all cursor-pointer"
                  >
                    <ShoppingBag className="w-4 h-4 text-white" />
                    <span>Add to Order</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* ========================================================================= */}
      {/* 1. Modal: Create Quotation */}
      {/* ========================================================================= */}
      {isQuoteModalOpen && analysis && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden flex flex-col">
            <div className="bg-slate-900 px-5 py-4 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="p-1.5 rounded-lg bg-blue-600/30 text-blue-400 border border-blue-500/30">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold tracking-tight">Generate PCB Quotation</h3>
                  <p className="text-[11px] text-slate-400">14-Day Price Guarantee at {ratePerCm2} LKR/cm²</p>
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
              {/* Board Summary Card */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-900 block truncate max-w-[220px]">
                    {analysis.board_name}
                  </span>
                  <span className="text-[10px] text-slate-500 font-medium">
                    {analysis.area_cm2} cm² • {analysis.layer_count}-Layer • {solderMaskColor}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Unit Price</span>
                  <span className="font-extrabold text-blue-900 font-mono text-sm">
                    {formatLKR(analysis.calculated_price_lkr)}
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

                {/* Quantity Stepper */}
                <div className="border border-slate-200 rounded-xl p-3 bg-blue-50/40 flex items-center justify-between">
                  <div>
                    <span className="block font-bold text-slate-900 text-xs">Quantity (pcs)</span>
                    <span className="text-[10px] text-slate-500">Fabrication batch count</span>
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

                {/* Total Preview */}
                <div className="flex justify-between items-center px-1">
                  <span className="text-xs font-bold text-slate-600">Total Quotation Value:</span>
                  <span className="text-base font-extrabold text-blue-900 font-mono">
                    {formatLKR(
                      (parseFloat(analysis.calculated_price_lkr) * orderQuantity).toFixed(2)
                    )}
                  </span>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Notes / Fabrication Directives
                  </label>
                  <textarea
                    rows={2}
                    placeholder="e.g. 1.6mm thickness, green mask, ENIG gold finish..."
                    value={orderNotes}
                    onChange={(e) => setOrderNotes(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsQuoteModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-100 font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={commercialSubmitting}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold shadow-md transition-all cursor-pointer disabled:opacity-50 flex items-center space-x-1.5"
                >
                  <FileText className="w-4 h-4" />
                  <span>{commercialSubmitting ? "Generating..." : "Generate QT-2026"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. Modal: Add directly to Order (Clean, Unpaid Default) */}
      {/* ========================================================================= */}
      {isOrderModalOpen && analysis && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden flex flex-col">
            <div className="bg-slate-900 px-5 py-4 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="p-1.5 rounded-lg bg-emerald-600/30 text-emerald-400 border border-emerald-500/30">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold tracking-tight">Queue PCB Production Order</h3>
                  <p className="text-[11px] text-slate-400">Directly adds to active fabrication queue</p>
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

            <form onSubmit={handleAddToOrder} className="p-5 space-y-4 text-xs">
              <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-3 flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-900 block truncate max-w-[220px]">
                    {analysis.board_name}
                  </span>
                  <span className="text-[10px] text-emerald-800 font-medium">
                    {analysis.area_cm2} cm² • {analysis.layer_count}-Layer • {solderMaskColor}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Unit Price</span>
                  <span className="font-extrabold text-emerald-900 font-mono text-sm">
                    {formatLKR(analysis.calculated_price_lkr)}
                  </span>
                </div>
              </div>

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
                      Assigned Partner
                    </label>
                    <select
                      value={assignedPartner}
                      onChange={(e) => setAssignedPartner(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none font-medium"
                    >
                      {PARTNERS.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Quantity Stepper */}
                <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 flex items-center justify-between">
                  <div>
                    <span className="block font-bold text-slate-900 text-xs">Quantity (pcs)</span>
                    <span className="text-[10px] text-slate-500">Fabrication batch count</span>
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

                {/* Total Value */}
                <div className="flex justify-between items-center px-1">
                  <span className="text-xs font-bold text-slate-600">Total Order Amount:</span>
                  <span className="text-base font-extrabold text-slate-900 font-mono">
                    {formatLKR(
                      (parseFloat(analysis.calculated_price_lkr) * orderQuantity).toFixed(2)
                    )}
                  </span>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Production Notes / Delivery Instructions
                  </label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Urgent prototype delivery by Friday..."
                    value={orderNotes}
                    onChange={(e) => setOrderNotes(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsOrderModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-100 font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={commercialSubmitting}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold shadow-md transition-all cursor-pointer disabled:opacity-50 flex items-center space-x-1.5"
                >
                  <ShoppingBag className="w-4 h-4" />
                  <span>{commercialSubmitting ? "Queueing..." : "Confirm & Queue Order"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. Success Modal: Quotation Created */}
      {/* ========================================================================= */}
      {quoteSuccessOpen && createdQuotation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col">
            <div className="bg-emerald-600 px-5 py-4 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-5 h-5 text-white" />
                <h3 className="text-sm font-bold">Quotation Successfully Generated</h3>
              </div>
              <button
                onClick={() => setQuoteSuccessOpen(false)}
                className="text-emerald-100 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="text-center py-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                  Official Quotation Number
                </span>
                <div className="flex items-center justify-center space-x-2 mt-1">
                  <span className="text-2xl font-black font-mono text-slate-900">
                    {createdQuotation.quotation_number}
                  </span>
                  <button
                    onClick={() => copyToClipboard(createdQuotation.quotation_number, "quote")}
                    className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600"
                    title="Copy Quote Number"
                  >
                    {copiedQuote ? (
                      <Check className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">Customer:</span>
                  <strong className="text-slate-900">{createdQuotation.customer_name}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Item:</span>
                  <strong className="text-slate-900 truncate max-w-[200px]">
                    {createdQuotation.items[0]?.title}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Quantity:</span>
                  <strong className="text-slate-900">{createdQuotation.items[0]?.quantity} pcs</strong>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-2 text-sm font-bold">
                  <span className="text-slate-700">Total Amount:</span>
                  <span className="text-blue-900 font-mono">
                    {formatLKR(createdQuotation.total_amount_lkr)}
                  </span>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex items-center space-x-1.5 px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-100 font-bold"
                >
                  <Printer className="w-4 h-4 text-slate-500" />
                  <span>Print Sheet</span>
                </button>
                <button
                  type="button"
                  onClick={() => setQuoteSuccessOpen(false)}
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. Success Modal: Order Queued */}
      {/* ========================================================================= */}
      {orderSuccessOpen && createdOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col">
            <div className="bg-slate-900 px-5 py-4 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <h3 className="text-sm font-bold">PCB Order Added to Production</h3>
              </div>
              <button
                onClick={() => setOrderSuccessOpen(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="text-center py-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                  Production Order Reference
                </span>
                <div className="flex items-center justify-center space-x-2 mt-1">
                  <span className="text-2xl font-black font-mono text-emerald-600">
                    {createdOrder.order_number}
                  </span>
                  <button
                    onClick={() => copyToClipboard(createdOrder.order_number, "order")}
                    className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600"
                    title="Copy Order Number"
                  >
                    {copiedOrder ? (
                      <Check className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">Customer:</span>
                  <strong className="text-slate-900">{createdOrder.customer_name}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Assigned Partner:</span>
                  <strong className="text-blue-700">{createdOrder.assigned_partner}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Payment Status:</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                    UNPAID (Pending Collection)
                  </span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-2 text-sm font-bold">
                  <span className="text-slate-700">Order Total:</span>
                  <span className="text-emerald-900 font-mono">
                    {formatLKR(createdOrder.total_amount_lkr)}
                  </span>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between">
                <Link
                  href="/orders"
                  className="flex items-center space-x-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold shadow-sm"
                >
                  <ShoppingBag className="w-4 h-4" />
                  <span>Go to Orders Dashboard</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </Link>
                <button
                  type="button"
                  onClick={() => setOrderSuccessOpen(false)}
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
