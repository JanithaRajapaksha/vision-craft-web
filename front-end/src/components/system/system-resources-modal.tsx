"use client";

import React, { useState, useEffect } from "react";
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
  X,
  Container,
  Database,
  Terminal,
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

interface SystemResourcesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SystemResourcesModal({ isOpen, onClose }: SystemResourcesModalProps) {
  const [data, setData] = useState<SystemTelemetry | null>(null);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [resetting, setResetting] = useState(false);

  const fetchTelemetry = async () => {
    try {
      const res = await fetch("/api/v1/system/resources");
      if (res.ok) {
        const json: SystemTelemetry = await res.json();
        setData(json);
      }
    } catch (err) {
      console.warn("Telemetry fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    fetchTelemetry();

    if (!autoRefresh) return;
    const interval = setInterval(fetchTelemetry, 5000);
    return () => clearInterval(interval);
  }, [isOpen, autoRefresh]);

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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden text-slate-100">
        {/* Header */}
        <div className="px-5 py-3.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-sm font-bold text-white flex items-center space-x-2">
              <span>Full-Stack Azure B2ats Resource Profiler</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 font-mono">
                1 GB RAM Target
              </span>
            </h2>
            <p className="text-[11px] text-slate-400">
              Frontend, Backend, Celery, Postgres & Redis memory footprints
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold flex items-center space-x-1.5 transition-all ${
                autoRefresh
                  ? "bg-blue-600/20 text-blue-300 border-blue-500/40"
                  : "bg-slate-800 text-slate-400 border-slate-700"
              }`}
            >
              <RefreshCw className={`w-3 h-3 ${autoRefresh ? "animate-spin" : ""}`} />
              <span>{autoRefresh ? "Auto (3s)" : "Paused"}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setLoading(true);
                fetchTelemetry();
              }}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300"
              title="Refresh"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={handleReset}
              disabled={resetting}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-900/40 border border-slate-700 text-slate-400 hover:text-rose-300"
              title="Reset Counters"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 ml-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {!data ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-2">
              <div className="w-8 h-8 border-3 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
              <p className="text-xs text-slate-400">Loading full-stack telemetry...</p>
            </div>
          ) : (
            <>
              {/* Twin Sizing Gauges: RAM & CPU */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* RAM Gauge */}
                <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex justify-between items-baseline text-xs font-mono">
                    <span className="font-bold text-purple-400 flex items-center space-x-1">
                      <HardDrive className="w-3 h-3 mr-1 inline" />
                      <span>RAM: <strong className="text-white">{data.full_stack.total_vm_ram_needed_mb} MB</strong></span>
                    </span>
                    <span className="font-bold text-slate-300 text-[11px]">
                      {data.full_stack.consumption_percent}% of 1,024 MB
                    </span>
                  </div>

                  <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden p-0.5 border border-slate-700/60 flex">
                    {data.full_stack.services.map((svc) => {
                      const share = (svc.rss_mb / data.full_stack.target_b2ats_ram_mb) * 100;
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
                          className={`${colors[svc.key] || "bg-slate-500"} h-full`}
                          style={{ width: `${share}%` }}
                        />
                      );
                    })}
                    <div
                      title="OS Buffer: 180 MB"
                      className="bg-slate-600 h-full"
                      style={{ width: `${(180 / 1024) * 100}%` }}
                    />
                  </div>

                  <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                    <span>Headroom: <strong className="text-emerald-400">{data.full_stack.headroom_mb} MB</strong></span>
                    <span>Status: <strong className="text-white">{data.full_stack.overall_risk}</strong></span>
                  </div>
                </div>

                {/* CPU Gauge */}
                <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex justify-between items-baseline text-xs font-mono">
                    <span className="font-bold text-blue-400 flex items-center space-x-1">
                      <Cpu className="w-3 h-3 mr-1 inline" />
                      <span>CPU: <strong className="text-white">{data.full_stack.total_stack_cpu_percent ?? 0.0}%</strong></span>
                    </span>
                    <span className="font-bold text-cyan-300 text-[11px]">
                      {data.full_stack.cpu_credit_status ?? "SUSTAINABLE"} (20% Base)
                    </span>
                  </div>

                  <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden p-0.5 border border-slate-700/60 flex">
                    {data.full_stack.services.map((svc) => {
                      const cpuVal = svc.cpu_percent ?? 0.0;
                      const share = (cpuVal / (data.full_stack.cpu_max_percent ?? 200.0)) * 100;
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
                          className={`${colors[svc.key] || "bg-slate-500"} h-full`}
                          style={{ width: `${Math.max(1.0, share)}%` }}
                        />
                      );
                    })}
                  </div>

                  <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                    <span>Burst Headroom: <strong className="text-cyan-400">{data.full_stack.cpu_headroom_percent ?? 180.0}%</strong></span>
                    <span>2 vCPUs (200% Max)</span>
                  </div>
                </div>
              </div>

              {/* 5 Services Mini-Cards (Dual RAM & CPU) */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                  All 5 Services: RAM & CPU Consumption
                </span>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
                  {data.full_stack.services.map((svc) => {
                    const Icon = SERVICE_ICONS[svc.key] || Server;
                    return (
                      <div key={svc.key} className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-[11px] space-y-1.5">
                        <div className="flex justify-between items-center">
                          <Icon className="w-3.5 h-3.5 text-blue-400" />
                          <span className="text-[9px] font-mono text-emerald-400 font-bold">{svc.status}</span>
                        </div>
                        <strong className="text-white text-[11px] block truncate">{svc.name}</strong>
                        
                        <div className="grid grid-cols-2 gap-1 pt-1.5 border-t border-slate-800/80 font-mono text-[10px]">
                          <div className="bg-slate-900 rounded p-1 border border-slate-800">
                            <span className="text-slate-500 block text-[9px]">RAM</span>
                            <strong className="text-purple-300">{svc.rss_mb}M</strong>
                          </div>
                          <div className="bg-slate-900 rounded p-1 border border-slate-800">
                            <span className="text-slate-500 block text-[9px]">CPU</span>
                            <strong className="text-blue-300">{svc.cpu_percent ?? 0.0}%</strong>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Bottlenecks & Directives */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                  Key Bottleneck Insights & Optimizations
                </span>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px]">
                  {data.bottlenecks_and_recommendations.slice(0, 2).map((item, idx) => (
                    <div key={idx} className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1">
                      <div className="flex justify-between items-center">
                        <strong className="text-white text-xs">{item.title}</strong>
                        <span className="text-[9px] px-1.5 py-0.5 rounded font-bold uppercase bg-slate-800 text-slate-300">
                          {item.severity}
                        </span>
                      </div>
                      <p className="text-slate-400 text-[10px]">{item.detail}</p>
                      <div className="pt-0.5 text-[10px] text-blue-300 font-mono">
                        &rarr; {item.optimization}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-2.5 bg-slate-950 border-t border-slate-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
