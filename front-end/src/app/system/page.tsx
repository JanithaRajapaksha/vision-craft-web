"use client";

import { useState, useEffect } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import {
  Cpu,
  Zap,
  HardDrive,
  RefreshCw,
  RotateCcw,
  Server,
  Layers,
  ShoppingBag,
  BookOpen,
  DollarSign,
  Shield,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Lightbulb,
  Database,
  Terminal,
  Container,
} from "lucide-react";

interface ServiceItem {
  key: string;
  name: string;
  role: string;
  status: string;
  estimated_or_live: string;
  rss_mb: number;
  azure_b2ats_cap_mb: number;
  cpu_percent?: number;
  azure_b2ats_cpu_cap_percent?: number;
  heap_used_mb?: number;
  database_size_mb?: number;
  connected_clients?: number;
  active_workers?: number;
  uptime?: string;
}

interface FullStackAnalysis {
  target_vm: string;
  // RAM
  total_stack_ram_mb: number;
  os_kernel_overhead_mb: number;
  total_vm_ram_needed_mb: number;
  target_b2ats_ram_mb: number;
  headroom_mb: number;
  consumption_percent: number;
  overall_risk: string;
  risk_summary: string;
  // CPU
  total_stack_cpu_percent?: number;
  cpu_baseline_percent?: number;
  cpu_max_percent?: number;
  cpu_headroom_percent?: number;
  cpu_credit_status?: string;
  cpu_risk_summary?: string;
  services: ServiceItem[];
}

interface BottleneckFinding {
  type: string;
  severity: string;
  title: string;
  detail: string;
  optimization: string;
}

interface EndpointStat {
  endpoint: string;
  count: number;
  total_ms: number;
  avg_ms: number;
  max_ms: number;
  cpu_ms: number;
  errors: number;
}

interface ModuleResourceMetrics {
  id: string;
  name: string;
  description: string;
  prefix: string;
  color: string;
  request_count: number;
  request_share_percent: number;
  total_wall_time_ms: number;
  avg_wall_time_ms: number;
  total_cpu_time_ms: number;
  avg_cpu_time_ms: number;
  cpu_share_percent: number;
  cpu_intensity: "LOW" | "MEDIUM" | "HIGH";
  peak_rss_mb: number;
  avg_mem_delta_mb: number;
  status_2xx: number;
  status_4xx: number;
  status_5xx: number;
  top_endpoints: EndpointStat[];
}

interface RequestTrace {
  timestamp: string;
  module: string;
  method: string;
  path: string;
  status: number;
  duration_ms: number;
  cpu_ms: number;
  mem_mb?: number;
}

interface SystemTelemetry {
  timestamp: string;
  host: {
    cpu_cores: number;
    cpu_load_percent: number;
    ram_total_mb: number;
    ram_used_mb: number;
    ram_used_percent: number;
    disk_used_percent: number;
  };
  process: {
    pid: number;
    uptime_formatted: string;
    current_rss_mb: number;
    peak_rss_mb: number;
    total_cpu_time_seconds: number;
  };
  full_stack: FullStackAnalysis;
  bottlenecks_and_recommendations: BottleneckFinding[];
  total_system_requests: number;
  total_system_cpu_time_ms: number;
  modules: ModuleResourceMetrics[];
  recent_traces: RequestTrace[];
}

const SERVICE_ICONS: Record<string, React.ElementType> = {
  frontend: Container,
  backend: Zap,
  celery: Terminal,
  postgres: Database,
  redis: Server,
};

const MODULE_ICONS: Record<string, React.ElementType> = {
  "3d_printing": Layers,
  pcb_engineering: Cpu,
  commercial_orders: ShoppingBag,
  accounting_ledger: BookOpen,
  founders_hub: DollarSign,
  auth_security: Shield,
  system_telemetry: Activity,
  other: Server,
};

export default function SystemResourcesPage() {
  const [currentPartner, setCurrentPartner] = useState("Janitha");
  const [telemetry, setTelemetry] = useState<SystemTelemetry | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [resetting, setResetting] = useState(false);

  const fetchTelemetry = async () => {
    try {
      const res = await fetch("/api/v1/system/resources");
      if (res.ok) {
        const json: SystemTelemetry = await res.json();
        setTelemetry(json);
      }
    } catch (err) {
      console.warn("Telemetry fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTelemetry();
    if (!autoRefresh) return;
    const timer = setInterval(fetchTelemetry, 5000);
    return () => clearInterval(timer);
  }, [autoRefresh]);

  const handleReset = async () => {
    if (!confirm("Reset CPU and RAM counters to baseline?")) return;
    setResetting(true);
    try {
      await fetch("/api/v1/system/resources/reset", { method: "POST" });
      await fetchTelemetry();
    } catch (err) {
      console.error(err);
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="flex h-screen bg-slate-900 text-slate-100 overflow-hidden font-sans">
      <Sidebar onOpenQuickExpense={() => {}} />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header
          currentPartner={currentPartner}
          onPartnerChange={setCurrentPartner}
        />

        {/* Top Control Bar */}
        <div className="px-6 py-3.5 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-base font-bold text-white">Full-Stack Azure B2ats Resource Profiler</h1>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 font-mono font-bold">
                Target: Azure B2ats v2 (2 vCPU, 1.0 GB RAM)
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Live CPU & RAM telemetry across all 5 services: Frontend, Backend, Celery, Postgres & Redis
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center space-x-1.5 transition-all cursor-pointer ${
                autoRefresh
                  ? "bg-blue-600/20 text-blue-300 border-blue-500/40"
                  : "bg-slate-800 text-slate-400 border-slate-700 hover:text-white"
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${autoRefresh ? "animate-spin" : ""}`} />
              <span>{autoRefresh ? "Auto (3s)" : "Paused"}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setLoading(true);
                fetchTelemetry();
              }}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer"
              title="Refresh Now"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={handleReset}
              disabled={resetting}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-rose-950/40 border border-slate-700 hover:border-rose-700/50 text-slate-400 hover:text-rose-300 text-xs font-semibold flex items-center space-x-1.5 transition-all cursor-pointer"
              title="Reset Counters"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Counters</span>
            </button>
          </div>
        </div>

        {/* Main Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading && !telemetry ? (
            <div className="flex flex-col items-center justify-center h-64 space-y-3">
              <div className="w-10 h-10 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
              <p className="text-xs text-slate-400">Measuring full stack memory footprint & CPU times...</p>
            </div>
          ) : !telemetry ? (
            <div className="text-center p-8 text-slate-500">
              <AlertTriangle className="w-10 h-10 mx-auto mb-2 text-amber-500/70" />
              <p className="text-sm font-semibold text-slate-300">Backend Server Unreachable</p>
              <p className="text-xs text-slate-500 mt-1">Make sure backend is running at http://127.0.0.1:8000.</p>
            </div>
          ) : (
            <>
              {/* ========================================================================= */}
              {/* 1. TWIN SIZING GAUGES: RAM & CPU CONSUMPTION ON AZURE B2ATS (2 vCPU, 1GB) */}
              {/* ========================================================================= */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* 1A. Total Stack RAM Consumption */}
                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4 flex flex-col justify-between">
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-purple-400 block flex items-center space-x-1">
                          <HardDrive className="w-3 h-3 mr-1 inline" />
                          <span>Memory Allocation</span>
                        </span>
                        <h2 className="text-base font-extrabold text-white flex items-center space-x-2 mt-0.5">
                          <span>Total Stack RAM</span>
                          <span className="text-xs px-2 py-0.5 rounded font-mono font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                            1,024 MB Total
                          </span>
                        </h2>
                      </div>

                      <div
                        className={`px-2.5 py-1 rounded-xl border text-[11px] font-bold flex items-center space-x-1.5 ${
                          telemetry.full_stack.overall_risk === "SAFE"
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                            : telemetry.full_stack.overall_risk === "MODERATE"
                            ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                            : "bg-rose-500/10 text-rose-400 border-rose-500/30"
                        }`}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        <span>{telemetry.full_stack.overall_risk}</span>
                      </div>
                    </div>

                    <div className="mt-3 space-y-2">
                      <div className="flex justify-between items-baseline text-xs font-mono">
                        <span className="text-slate-300 font-bold">
                          Stack Total: <strong className="text-white">{telemetry.full_stack.total_vm_ram_needed_mb} MB</strong>
                        </span>
                        <span className="text-purple-300 font-bold">
                          {telemetry.full_stack.consumption_percent}% of 1,024 MB
                        </span>
                      </div>

                      {/* Multi-segment RAM Progress Bar */}
                      <div className="w-full bg-slate-800 rounded-full h-4 overflow-hidden p-0.5 border border-slate-700/60 flex">
                        {telemetry.full_stack.services.map((svc) => {
                          const share = (svc.rss_mb / telemetry.full_stack.target_b2ats_ram_mb) * 100;
                          const colors: Record<string, string> = {
                            frontend: "bg-blue-500",
                            backend: "bg-purple-500",
                            celery: "bg-amber-500",
                            postgres: "bg-emerald-500",
                            redis: "bg-rose-500",
                          };
                          return (
                            <div
                              key={svc.key}
                              title={`${svc.name}: ${svc.rss_mb} MB`}
                              className={`${colors[svc.key] || "bg-slate-500"} h-full transition-all duration-500`}
                              style={{ width: `${share}%` }}
                            />
                          );
                        })}
                        {/* OS reserve */}
                        <div
                          title="Linux Kernel & Host Reserve: 180 MB"
                          className="bg-slate-600 h-full"
                          style={{ width: `${(180 / 1024) * 100}%` }}
                        />
                      </div>

                      {/* RAM Legend */}
                      <div className="flex flex-wrap items-center gap-2.5 text-[10px] font-mono text-slate-400 pt-1">
                        <span className="flex items-center space-x-1">
                          <span className="w-2 h-2 rounded-full bg-blue-500" />
                          <span>Frontend</span>
                        </span>
                        <span className="flex items-center space-x-1">
                          <span className="w-2 h-2 rounded-full bg-purple-500" />
                          <span>Backend</span>
                        </span>
                        <span className="flex items-center space-x-1">
                          <span className="w-2 h-2 rounded-full bg-amber-500" />
                          <span>Celery</span>
                        </span>
                        <span className="flex items-center space-x-1">
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                          <span>PostgreSQL</span>
                        </span>
                        <span className="flex items-center space-x-1">
                          <span className="w-2 h-2 rounded-full bg-rose-500" />
                          <span>Redis</span>
                        </span>
                        <span className="flex items-center space-x-1">
                          <span className="w-2 h-2 rounded-full bg-slate-600" />
                          <span>OS (180M)</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-900 flex justify-between items-center text-xs">
                    <span className="text-slate-400 text-[11px] truncate max-w-[280px]">
                      {telemetry.full_stack.risk_summary}
                    </span>
                    <span className="text-emerald-400 font-mono font-bold shrink-0">
                      Headroom: {telemetry.full_stack.headroom_mb} MB
                    </span>
                  </div>
                </div>

                {/* 1B. Total Stack CPU Consumption */}
                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4 flex flex-col justify-between">
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-blue-400 block flex items-center space-x-1">
                          <Cpu className="w-3 h-3 mr-1 inline" />
                          <span>Compute & Credit Budget</span>
                        </span>
                        <h2 className="text-base font-extrabold text-white flex items-center space-x-2 mt-0.5">
                          <span>Total Stack CPU</span>
                          <span className="text-xs px-2 py-0.5 rounded font-mono font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                            2 vCPUs (200% Max)
                          </span>
                        </h2>
                      </div>

                      <div
                        className={`px-2.5 py-1 rounded-xl border text-[11px] font-bold flex items-center space-x-1.5 ${
                          (telemetry.full_stack.cpu_credit_status ?? "SUSTAINABLE") === "SUSTAINABLE"
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                            : (telemetry.full_stack.cpu_credit_status ?? "BURSTING") === "BURSTING"
                            ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                            : "bg-rose-500/10 text-rose-400 border-rose-500/30"
                        }`}
                      >
                        <Zap className="w-3.5 h-3.5 shrink-0" />
                        <span>{telemetry.full_stack.cpu_credit_status ?? "SUSTAINABLE"}</span>
                      </div>
                    </div>

                    <div className="mt-3 space-y-2">
                      <div className="flex justify-between items-baseline text-xs font-mono">
                        <span className="text-slate-300 font-bold">
                          Stack Load: <strong className="text-white">{telemetry.full_stack.total_stack_cpu_percent ?? 0.0}%</strong>
                          <span className="text-[10px] text-slate-500 font-normal ml-1">
                            (Host: {telemetry.host.cpu_load_percent}%)
                          </span>
                        </span>
                        <span className="text-blue-300 font-bold">
                          Baseline: 20% Sustainable
                        </span>
                      </div>

                      {/* Multi-segment CPU Progress Bar (Scale to 100% or 200% max compute) */}
                      <div className="relative w-full bg-slate-800 rounded-full h-4 overflow-hidden p-0.5 border border-slate-700/60 flex">
                        {telemetry.full_stack.services.map((svc) => {
                          const cpuVal = svc.cpu_percent ?? 0.0;
                          // Scale against 200% total 2-vCPU capacity
                          const share = (cpuVal / (telemetry.full_stack.cpu_max_percent ?? 200.0)) * 100;
                          const colors: Record<string, string> = {
                            frontend: "bg-blue-500",
                            backend: "bg-purple-500",
                            celery: "bg-amber-500",
                            postgres: "bg-emerald-500",
                            redis: "bg-rose-500",
                          };
                          return (
                            <div
                              key={svc.key}
                              title={`${svc.name}: ${cpuVal}% CPU`}
                              className={`${colors[svc.key] || "bg-slate-500"} h-full transition-all duration-500`}
                              style={{ width: `${Math.max(1.0, share)}%` }}
                            />
                          );
                        })}
                      </div>

                      {/* CPU Legend & Credit Baseline Marker Note */}
                      <div className="flex flex-wrap items-center gap-2.5 text-[10px] font-mono text-slate-400 pt-1">
                        <span className="flex items-center space-x-1">
                          <span className="w-2 h-2 rounded-full bg-blue-500" />
                          <span>Frontend</span>
                        </span>
                        <span className="flex items-center space-x-1">
                          <span className="w-2 h-2 rounded-full bg-purple-500" />
                          <span>Backend</span>
                        </span>
                        <span className="flex items-center space-x-1">
                          <span className="w-2 h-2 rounded-full bg-amber-500" />
                          <span>Celery</span>
                        </span>
                        <span className="flex items-center space-x-1">
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                          <span>PostgreSQL</span>
                        </span>
                        <span className="flex items-center space-x-1">
                          <span className="w-2 h-2 rounded-full bg-rose-500" />
                          <span>Redis</span>
                        </span>
                        <span className="flex items-center space-x-1 text-slate-300 font-semibold">
                          <span className="w-2 h-2 rounded-full bg-cyan-400" />
                          <span>20% B2ats Baseline Cap</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-900 flex justify-between items-center text-xs">
                    <span className="text-slate-400 text-[11px] truncate max-w-[280px]">
                      {telemetry.full_stack.cpu_risk_summary ?? "CPU within sustainable baseline."}
                    </span>
                    <span className="text-cyan-400 font-mono font-bold shrink-0">
                      Burst Headroom: {telemetry.full_stack.cpu_headroom_percent ?? 180.0}%
                    </span>
                  </div>
                </div>
              </div>

              {/* ========================================================================= */}
              {/* 2. THE 5 SERVICES BREAKDOWN CARDS (BOTH RAM & CPU MEASURED) */}
              {/* ========================================================================= */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Container className="w-4 h-4 text-blue-400" />
                    <h3 className="text-sm font-bold text-white">All 5 Services: Dual RAM & CPU Telemetry</h3>
                  </div>
                  <div className="flex items-center space-x-3 text-xs text-slate-400 font-mono">
                    <span>
                      Host CPU: <strong className="text-blue-300">{telemetry.host.cpu_load_percent}%</strong> (2 Cores)
                    </span>
                    <span>•</span>
                    <span>
                      Host RAM: <strong className="text-purple-300">{telemetry.host.ram_used_percent}%</strong>
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                  {telemetry.full_stack.services.map((svc) => {
                    const Icon = SERVICE_ICONS[svc.key] || Server;
                    return (
                      <div
                        key={svc.key}
                        className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between space-y-3 hover:border-slate-700 transition-all shadow-md"
                      >
                        <div>
                          <div className="flex items-center justify-between">
                            <div className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-blue-400">
                              <Icon className="w-4 h-4" />
                            </div>
                            <span
                              className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold ${
                                svc.status.includes("ONLINE")
                                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                  : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                              }`}
                            >
                              {svc.status}
                            </span>
                          </div>

                          <h4 className="text-xs font-bold text-white mt-2 leading-tight">{svc.name}</h4>
                          <span className="text-[10px] text-slate-400 block mt-0.5 leading-snug line-clamp-2">
                            {svc.role}
                          </span>
                        </div>

                        {/* Dual RAM & CPU Metric Blocks */}
                        <div className="space-y-2 pt-2 border-t border-slate-800/80 font-mono text-[11px]">
                          {/* RAM Block */}
                          <div className="bg-slate-900/90 rounded-lg p-2 border border-slate-800/90">
                            <div className="flex justify-between items-center text-[10px]">
                              <span className="text-purple-400 font-semibold flex items-center space-x-1">
                                <HardDrive className="w-3 h-3" />
                                <span>RAM (RSS)</span>
                              </span>
                              <span className="text-slate-400 text-[9px]">Cap: {svc.azure_b2ats_cap_mb}M</span>
                            </div>
                            <div className="text-sm font-extrabold text-white mt-0.5 flex items-baseline justify-between">
                              <span>{svc.rss_mb} <span className="text-[10px] font-normal text-slate-400">MB</span></span>
                              <span className="text-[9px] text-purple-300 font-semibold">
                                {Math.round((svc.rss_mb / svc.azure_b2ats_cap_mb) * 100)}% cap
                              </span>
                            </div>
                          </div>

                          {/* CPU Block */}
                          <div className="bg-slate-900/90 rounded-lg p-2 border border-slate-800/90">
                            <div className="flex justify-between items-center text-[10px]">
                              <span className="text-blue-400 font-semibold flex items-center space-x-1">
                                <Cpu className="w-3 h-3" />
                                <span>CPU Load</span>
                              </span>
                              <span className="text-slate-400 text-[9px]">Cap: {svc.azure_b2ats_cpu_cap_percent ?? 40}%</span>
                            </div>
                            <div className="text-sm font-extrabold text-white mt-0.5 flex items-baseline justify-between">
                              <span>{svc.cpu_percent ?? 0.0}%</span>
                              <span className="text-[9px] text-blue-300 font-semibold">
                                Burst limit
                              </span>
                            </div>
                          </div>

                          <div className="text-[9px] text-slate-500 truncate pt-0.5">
                            {svc.estimated_or_live}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ========================================================================= */}
              {/* 3. BOTTLENECKS & AZURE B2ATS TUNING RECOMMENDATIONS */}
              {/* ========================================================================= */}
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Lightbulb className="w-4 h-4 text-amber-400" />
                  <h3 className="text-sm font-bold text-white">Bottlenecks & Azure B2ats Optimization Directives</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {telemetry.bottlenecks_and_recommendations.map((item, idx) => (
                    <div
                      key={idx}
                      className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 flex flex-col justify-between space-y-3"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                              item.severity === "HIGH"
                                ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                                : item.severity === "MEDIUM"
                                ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                                : item.severity === "LOW"
                                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                : "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                            }`}
                          >
                            {item.severity}
                          </span>
                        </div>
                        <h4 className="text-xs font-bold text-white">{item.title}</h4>
                        <p className="text-[11px] text-slate-400 leading-relaxed">{item.detail}</p>
                      </div>

                      <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800 text-[11px] text-slate-300 space-y-1">
                        <span className="text-[10px] uppercase font-bold text-blue-400 block tracking-wider">
                          Optimization:
                        </span>
                        <p className="font-mono text-[10px] text-slate-200">{item.optimization}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ========================================================================= */}
              {/* 4. WEB MODULES COMPUTATIONAL INTENSITY (FASTAPI CORE) */}
              {/* ========================================================================= */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-white">API Engine Computational Breakdown (FastAPI)</h3>
                    <p className="text-xs text-slate-400">
                      Ranked by CPU time and memory allocation per web feature
                    </p>
                  </div>
                  <span className="text-xs font-mono text-slate-400">
                    Total API Calls: <strong className="text-white">{telemetry.total_system_requests}</strong>
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {telemetry.modules.map((mod) => {
                    const Icon = MODULE_ICONS[mod.id] || Server;

                    return (
                      <div
                        key={mod.id}
                        className="bg-slate-950/80 border border-slate-800 hover:border-slate-700 rounded-xl p-4 transition-all shadow-sm space-y-3"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center space-x-2.5">
                            <div
                              className="p-2 rounded-lg"
                              style={{ backgroundColor: `${mod.color}20`, color: mod.color }}
                            >
                              <Icon className="w-4 h-4" />
                            </div>
                            <div>
                              <h4 className="text-xs font-bold text-white">{mod.name}</h4>
                              <span className="text-[10px] font-mono text-slate-500 block">
                                {mod.prefix}
                              </span>
                            </div>
                          </div>

                          <div className="text-right">
                            <span
                              className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
                                mod.cpu_intensity === "HIGH"
                                  ? "bg-rose-500/20 text-rose-300 border-rose-500/30"
                                  : mod.cpu_intensity === "MEDIUM"
                                  ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                                  : "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                              }`}
                            >
                              {mod.cpu_intensity} CPU
                            </span>
                            <span className="text-[10px] text-slate-500 block mt-1 font-mono">
                              {mod.request_count} calls ({mod.request_share_percent}%)
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-[11px] font-mono pt-1">
                          <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800 space-y-1">
                            <span className="text-[10px] font-semibold text-blue-400 block uppercase">
                              CPU Execution
                            </span>
                            <div className="flex justify-between items-baseline">
                              <span className="text-slate-400">Total CPU:</span>
                              <strong className="text-white text-xs">{mod.total_cpu_time_ms} ms</strong>
                            </div>
                            <div className="flex justify-between items-baseline">
                              <span className="text-slate-400">Avg per Call:</span>
                              <strong className="text-blue-300">{mod.avg_cpu_time_ms} ms</strong>
                            </div>
                          </div>

                          <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800 space-y-1">
                            <span className="text-[10px] font-semibold text-purple-400 block uppercase">
                              Memory Footprint
                            </span>
                            <div className="flex justify-between items-baseline">
                              <span className="text-slate-400">Peak RSS:</span>
                              <strong className="text-white text-xs">{mod.peak_rss_mb} MB</strong>
                            </div>
                            <div className="flex justify-between items-baseline">
                              <span className="text-slate-400">Avg Latency:</span>
                              <span className="text-slate-300">{mod.avg_wall_time_ms} ms</span>
                            </div>
                          </div>
                        </div>

                        {mod.top_endpoints.length > 0 && (
                          <div className="pt-2 border-t border-slate-800/60 text-[10px]">
                            <span className="text-[10px] font-semibold text-slate-400 block mb-1">
                              Heavyweight Endpoints:
                            </span>
                            <div className="space-y-1">
                              {mod.top_endpoints.slice(0, 2).map((ep, idx) => (
                                <div
                                  key={idx}
                                  className="flex items-center justify-between font-mono bg-slate-900/50 px-2 py-1 rounded"
                                >
                                  <span className="truncate max-w-[220px] text-slate-300">
                                    {ep.endpoint}
                                  </span>
                                  <span className="text-blue-400 font-bold shrink-0">
                                    {ep.avg_ms} ms avg
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
