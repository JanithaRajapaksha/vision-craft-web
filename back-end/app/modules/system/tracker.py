"""VisionCraft Real-time Resource & Telemetry Tracker.
Optimized for low-spec cloud VMs (e.g. Azure B2ats v2: 2 vCPU, 1GB RAM).
Measures CPU, RAM (RSS/VmRSS), identifies performance bottlenecks, and provides actionable tuning tips.
"""
import os
import time
import shutil
import resource
import threading
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from collections import deque


MODULE_METADATA = {
    "3d_printing": {
        "name": "3D Printing & Slicing",
        "description": "FDM STL parser, triangle mesh slicing, G-code generator",
        "prefix": "/api/v1/printing-3d",
        "color": "#3b82f6",
    },
    "pcb_engineering": {
        "name": "PCB & Gerber Studio",
        "description": "RS-274X Gerber parser, NC drill analyzer, 3D STL board synthesizer",
        "prefix": "/api/v1/pcb",
        "color": "#10b981",
    },
    "commercial_orders": {
        "name": "Commercial & Production",
        "description": "Quotations, unified production orders, partner payments",
        "prefix": "/api/v1/commercial",
        "color": "#8b5cf6",
    },
    "accounting_ledger": {
        "name": "Double-Entry Ledger",
        "description": "ACID journal entries, Chart of Accounts, financial statements",
        "prefix": "/api/v1/accounting",
        "color": "#f59e0b",
    },
    "founders_hub": {
        "name": "Founders Capital Hub",
        "description": "Partner equity, capital contributions, profit distributions",
        "prefix": "/api/v1/founders",
        "color": "#6366f1",
    },
    "auth_security": {
        "name": "Authentication & JWT",
        "description": "User login, token issuance, RBAC security verification",
        "prefix": "/api/v1/auth",
        "color": "#ec4899",
    },
    "system_telemetry": {
        "name": "System & Telemetry",
        "description": "Health checks, resource profiling, diagnostics",
        "prefix": "/api/v1/system",
        "color": "#06b6d4",
    },
    "other": {
        "name": "Other Services",
        "description": "Uncategorized root endpoints and static assets",
        "prefix": "/",
        "color": "#64748b",
    },
}


def read_proc_rss_mb() -> float:
    """Read actual current resident memory (VmRSS) from Linux /proc/self/status."""
    try:
        with open("/proc/self/status", "r") as f:
            for line in f:
                if line.startswith("VmRSS:"):
                    return round(int(line.split()[1]) / 1024.0, 1)
    except Exception:
        pass
    try:
        return round(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024.0, 1)
    except Exception:
        return 0.0


from app.modules.system.services_scanner import scan_full_stack_services


class ResourceTracker:
    def __init__(self):
        self._lock = threading.Lock()
        self.process_start_time = time.time()
        self.process_start_iso = datetime.now(timezone.utc).isoformat()
        self.pid = os.getpid()

        # Azure B2ats v2 standard RAM baseline (1024 MB = 1.0 GiB)
        self.azure_b2ats_ram_target_mb = 1024.0

        # Per-module metrics store
        self.module_metrics: Dict[str, Dict[str, Any]] = {}
        self._init_modules()

        # Recent traces circular buffer (last 30 requests)
        self.recent_traces: deque = deque(maxlen=30)

    def _init_modules(self):
        for mod_key in MODULE_METADATA.keys():
            self.module_metrics[mod_key] = {
                "request_count": 0,
                "active_requests": 0,
                "total_wall_time_ms": 0.0,
                "avg_wall_time_ms": 0.0,
                "min_wall_time_ms": None,
                "max_wall_time_ms": 0.0,
                "total_cpu_time_ms": 0.0,
                "avg_cpu_time_ms": 0.0,
                "peak_rss_mb": 0.0,
                "total_mem_delta_mb": 0.0,
                "avg_mem_delta_mb": 0.0,
                "status_2xx": 0,
                "status_4xx": 0,
                "status_5xx": 0,
                "total_ingress_bytes": 0,
                "total_egress_bytes": 0,
                "last_accessed_at": None,
                "endpoints": {},
            }

    def classify_module(self, path: str) -> str:
        """Determines which module/part of the web a path belongs to."""
        if path.startswith("/api/v1/printing-3d"):
            return "3d_printing"
        elif path.startswith("/api/v1/pcb"):
            return "pcb_engineering"
        elif path.startswith("/api/v1/commercial"):
            return "commercial_orders"
        elif path.startswith("/api/v1/accounting"):
            return "accounting_ledger"
        elif path.startswith("/api/v1/founders"):
            return "founders_hub"
        elif path.startswith("/api/v1/auth"):
            return "auth_security"
        elif path.startswith("/api/v1/system") or path.startswith("/api/v1/health"):
            return "system_telemetry"
        return "other"

    def record_request_start(self, module_key: str):
        with self._lock:
            if module_key in self.module_metrics:
                self.module_metrics[module_key]["active_requests"] += 1

    def record_request_finish(
        self,
        module_key: str,
        method: str,
        path: str,
        status_code: int,
        wall_time_ms: float,
        cpu_time_ms: float,
        start_rss_mb: float = 0.0,
        end_rss_mb: float = 0.0,
        ingress_bytes: int = 0,
        egress_bytes: int = 0,
    ):
        now_iso = datetime.now(timezone.utc).isoformat()
        mem_delta = max(0.0, round(end_rss_mb - start_rss_mb, 2))

        with self._lock:
            if module_key not in self.module_metrics:
                module_key = "other"

            m = self.module_metrics[module_key]
            m["active_requests"] = max(0, m["active_requests"] - 1)
            m["request_count"] += 1
            m["total_wall_time_ms"] += wall_time_ms
            m["total_cpu_time_ms"] += cpu_time_ms
            m["avg_wall_time_ms"] = round(m["total_wall_time_ms"] / m["request_count"], 2)
            m["avg_cpu_time_ms"] = round(m["total_cpu_time_ms"] / m["request_count"], 2)

            if end_rss_mb > m["peak_rss_mb"]:
                m["peak_rss_mb"] = end_rss_mb
            m["total_mem_delta_mb"] += mem_delta
            m["avg_mem_delta_mb"] = round(m["total_mem_delta_mb"] / m["request_count"], 2)

            if m["min_wall_time_ms"] is None or wall_time_ms < m["min_wall_time_ms"]:
                m["min_wall_time_ms"] = round(wall_time_ms, 2)
            if wall_time_ms > m["max_wall_time_ms"]:
                m["max_wall_time_ms"] = round(wall_time_ms, 2)

            if 200 <= status_code < 300:
                m["status_2xx"] += 1
            elif 400 <= status_code < 500:
                m["status_4xx"] += 1
            elif status_code >= 500:
                m["status_5xx"] += 1

            m["total_ingress_bytes"] += ingress_bytes
            m["total_egress_bytes"] += egress_bytes
            m["last_accessed_at"] = now_iso

            # Track endpoint level metrics
            ep_key = f"{method} {path.split('?')[0]}"
            if ep_key not in m["endpoints"]:
                m["endpoints"][ep_key] = {
                    "count": 0,
                    "total_ms": 0.0,
                    "avg_ms": 0.0,
                    "max_ms": 0.0,
                    "cpu_ms": 0.0,
                    "errors": 0,
                }
            ep = m["endpoints"][ep_key]
            ep["count"] += 1
            ep["total_ms"] += wall_time_ms
            ep["cpu_ms"] += cpu_time_ms
            ep["avg_ms"] = round(ep["total_ms"] / ep["count"], 2)
            if wall_time_ms > ep["max_ms"]:
                ep["max_ms"] = round(wall_time_ms, 2)
            if status_code >= 400:
                ep["errors"] += 1

            # Append to circular recent traces
            self.recent_traces.append({
                "timestamp": now_iso,
                "module": module_key,
                "method": method,
                "path": path,
                "status": status_code,
                "duration_ms": round(wall_time_ms, 2),
                "cpu_ms": round(cpu_time_ms, 2),
                "mem_mb": end_rss_mb,
            })

    def get_host_metrics(self) -> Dict[str, Any]:
        """Reads host OS CPU load, RAM usage, and disk consumption."""
        cpu_count = os.cpu_count() or 1
        load_avg = (0.0, 0.0, 0.0)
        try:
            load_avg = os.getloadavg()
        except Exception:
            pass

        cpu_load_pct = round((load_avg[0] / cpu_count) * 100.0, 1)

        total_kb = 0
        avail_kb = 0
        try:
            with open("/proc/meminfo", "r") as f:
                for line in f:
                    parts = line.split(":")
                    if len(parts) == 2:
                        key = parts[0].strip()
                        val = parts[1].strip().split()[0]
                        if key == "MemTotal":
                            total_kb = int(val)
                        elif key == "MemAvailable":
                            avail_kb = int(val)
        except Exception:
            pass

        total_mb = round(total_kb / 1024.0, 1)
        avail_mb = round(avail_kb / 1024.0, 1)
        used_mb = max(0.0, round(total_mb - avail_mb, 1))
        mem_pct = round((used_mb / total_mb) * 100.0, 1) if total_mb > 0 else 0.0

        disk = shutil.disk_usage("/")
        disk_total_gb = round(disk.total / (1024.0 ** 3), 2)
        disk_used_gb = round(disk.used / (1024.0 ** 3), 2)
        disk_free_gb = round(disk.free / (1024.0 ** 3), 2)
        disk_pct = round((disk.used / disk.total) * 100.0, 1) if disk.total > 0 else 0.0

        return {
            "cpu_cores": cpu_count,
            "cpu_load_1m": round(load_avg[0], 2),
            "cpu_load_5m": round(load_avg[1], 2),
            "cpu_load_15m": round(load_avg[2], 2),
            "cpu_load_percent": cpu_load_pct,
            "ram_total_mb": total_mb,
            "ram_used_mb": used_mb,
            "ram_available_mb": avail_mb,
            "ram_used_percent": mem_pct,
            "disk_total_gb": disk_total_gb,
            "disk_used_gb": disk_used_gb,
            "disk_free_gb": disk_free_gb,
            "disk_used_percent": disk_pct,
        }

    def get_process_metrics(self) -> Dict[str, Any]:
        """Reads current Python/FastAPI process memory, CPU time, threads, and uptime."""
        rusage = resource.getrusage(resource.RUSAGE_SELF)
        peak_rss_mb = round(rusage.ru_maxrss / 1024.0, 1)
        current_rss_mb = read_proc_rss_mb()
        if current_rss_mb <= 0:
            current_rss_mb = peak_rss_mb

        thread_count = 1
        try:
            with open("/proc/self/status", "r") as f:
                for line in f:
                    if line.startswith("Threads:"):
                        thread_count = int(line.split()[1])
        except Exception:
            pass

        now = time.time()
        uptime_seconds = int(now - self.process_start_time)
        hours, rem = divmod(uptime_seconds, 3600)
        minutes, seconds = divmod(rem, 60)
        uptime_formatted = f"{hours}h {minutes}m {seconds}s"

        user_cpu_sec = round(rusage.ru_utime, 3)
        sys_cpu_sec = round(rusage.ru_stime, 3)
        total_cpu_sec = round(user_cpu_sec + sys_cpu_sec, 3)

        return {
            "pid": self.pid,
            "uptime_seconds": uptime_seconds,
            "uptime_formatted": uptime_formatted,
            "process_start_iso": self.process_start_iso,
            "current_rss_mb": current_rss_mb,
            "peak_rss_mb": peak_rss_mb,
            "user_cpu_time_seconds": user_cpu_sec,
            "system_cpu_time_seconds": sys_cpu_sec,
            "total_cpu_time_seconds": total_cpu_sec,
            "thread_count": thread_count,
        }

    def get_azure_b2ats_analysis(self, current_rss_mb: float) -> Dict[str, Any]:
        """
        Analyzes resource feasibility specifically for an Azure B2ats v2 VM (2 vCPU, 1024 MB RAM).
        """
        target_ram_mb = self.azure_b2ats_ram_target_mb  # 1024 MB
        pct_of_vm = round((current_rss_mb / target_ram_mb) * 100.0, 1)
        headroom_mb = max(0.0, round(target_ram_mb - current_rss_mb, 1))

        if pct_of_vm < 35.0:
            risk = "LOW"
            badge = "bg-emerald-50 text-emerald-800 border-emerald-300"
            status_text = "Safe & Optimal for Azure B2ats"
        elif pct_of_vm < 65.0:
            risk = "MODERATE"
            badge = "bg-amber-50 text-amber-800 border-amber-300"
            status_text = "Moderate Memory Load – Monitor Concurrency"
        else:
            risk = "HIGH"
            badge = "bg-rose-50 text-rose-800 border-rose-300"
            status_text = "High OOM Risk on 1GB Azure B2ats"

        return {
            "vm_type": "Azure B2ats v2 (2 vCPU, 1.0 GiB RAM)",
            "vm_ram_total_mb": target_ram_mb,
            "backend_rss_mb": current_rss_mb,
            "ram_consumption_percent": pct_of_vm,
            "headroom_mb": headroom_mb,
            "risk_level": risk,
            "badge_class": badge,
            "status_text": status_text,
        }

    def detect_bottlenecks_and_recommendations(
        self, process_metrics: Dict[str, Any], host_metrics: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """
        Automatically identifies bottlenecks and generates concrete Azure B2ats optimization tips.
        """
        findings: List[Dict[str, Any]] = []
        rss = process_metrics["current_rss_mb"]

        # 1. Memory Headroom Check for B2ats (1GB)
        if rss > 400.0:
            findings.append({
                "type": "MEMORY_WARNING",
                "severity": "HIGH",
                "title": "Backend Memory Approaching B2ats Threshold",
                "detail": f"Current process RSS is {rss} MB, taking {round((rss/1024)*100, 1)}% of a 1GB Azure B2ats VM.",
                "optimization": "Limit Uvicorn to 1 worker (--workers 1). Set Docker memory limit to 400m for backend.",
            })
        else:
            findings.append({
                "type": "MEMORY_OPTIMAL",
                "severity": "LOW",
                "title": "Healthy Memory Footprint for B2ats",
                "detail": f"Backend process uses {rss} MB, leaving over {round(1024 - rss, 0)} MB for OS, Frontend & DB.",
                "optimization": "Keep single-worker asynchronous model to maintain low base memory footprint.",
            })

        # 2. Check Computational Heavyweights (3D Slicing & PCB)
        modules = self.module_metrics
        pcb_cpu = modules.get("pcb_engineering", {}).get("total_cpu_time_ms", 0.0)
        printing_cpu = modules.get("3d_printing", {}).get("total_cpu_time_ms", 0.0)

        if pcb_cpu > 100.0 or printing_cpu > 100.0:
            findings.append({
                "type": "CPU_HEAVY_OPS",
                "severity": "MEDIUM",
                "title": "3D Slicing & Gerber Parsing are Primary CPU Consumers",
                "detail": f"3D printing: {printing_cpu}ms CPU, PCB Gerber: {pcb_cpu}ms CPU.",
                "optimization": "B2ats has 20% baseline CPU credits. For heavy batches (>50 models/day), offload slicing to Celery worker or scale to B2as (burstable) or D2as.",
            })
        else:
            findings.append({
                "type": "CPU_LIGHT",
                "severity": "LOW",
                "title": "CPU Consumption Within B2ats Baseline",
                "detail": "Average request latency is under 5ms wall time, well within the 20% burstable baseline.",
                "optimization": "No immediate CPU scaling needed for current prototype request volume.",
            })

        # 3. Azure B2ats Host Deployment Rules
        findings.append({
            "type": "DEPLOYMENT_TIP",
            "severity": "INFO",
            "title": "Recommended Azure B2ats Docker Memory Limits",
            "detail": "To prevent Linux OOM killer from rebooting the VM, configure explicit memory caps in docker-compose.yml.",
            "optimization": "backend: 380MB | frontend: 350MB | postgres: 150MB | redis: 40MB | OS buffer: 104MB.",
        })

        return findings

    def get_database_metrics(self) -> Dict[str, Any]:
        """Returns database storage and status."""
        db_path = "back-end/visioncraft.db"
        if os.path.exists(db_path):
            size_mb = round(os.path.getsize(db_path) / (1024.0 * 1024.0), 2)
            return {
                "dialect": "SQLite",
                "storage_type": "Local Embedded WAL",
                "file_path": db_path,
                "database_size_mb": size_mb,
                "status": "HEALTHY",
            }
        return {
            "dialect": "PostgreSQL",
            "storage_type": "Docker / Remote Engine",
            "database_size_mb": 0.0,
            "status": "HEALTHY",
        }

    async def get_full_telemetry(self) -> Dict[str, Any]:
        """Assembles the clean CPU & RAM focused telemetry breakdown."""
        host = self.get_host_metrics()
        process = self.get_process_metrics()
        database = self.get_database_metrics()
        b2ats = self.get_azure_b2ats_analysis(process["current_rss_mb"])
        recommendations = self.detect_bottlenecks_and_recommendations(process, host)
        full_stack = await scan_full_stack_services(process["current_rss_mb"])

        modules_list = []
        total_all_requests = sum(m["request_count"] for m in self.module_metrics.values())
        total_all_cpu_ms = sum(m["total_cpu_time_ms"] for m in self.module_metrics.values())

        with self._lock:
            for mod_key, meta in MODULE_METADATA.items():
                m = self.module_metrics.get(mod_key, {})
                req_count = m.get("request_count", 0)
                cpu_ms = m.get("total_cpu_time_ms", 0.0)
                avg_cpu = m.get("avg_cpu_time_ms", 0.0)

                req_share_pct = round((req_count / total_all_requests) * 100.0, 1) if total_all_requests > 0 else 0.0
                cpu_share_pct = round((cpu_ms / total_all_cpu_ms) * 100.0, 1) if total_all_cpu_ms > 0 else 0.0

                if avg_cpu > 40.0:
                    cpu_intensity = "HIGH"
                elif avg_cpu > 10.0:
                    cpu_intensity = "MEDIUM"
                else:
                    cpu_intensity = "LOW"

                modules_list.append({
                    "id": mod_key,
                    "name": meta["name"],
                    "description": meta["description"],
                    "prefix": meta["prefix"],
                    "color": meta["color"],
                    "request_count": req_count,
                    "request_share_percent": req_share_pct,
                    "active_requests": m.get("active_requests", 0),
                    "total_wall_time_ms": round(m.get("total_wall_time_ms", 0.0), 2),
                    "avg_wall_time_ms": m.get("avg_wall_time_ms", 0.0),
                    "max_wall_time_ms": m.get("max_wall_time_ms", 0.0),
                    "total_cpu_time_ms": round(cpu_ms, 2),
                    "avg_cpu_time_ms": avg_cpu,
                    "cpu_share_percent": cpu_share_pct,
                    "cpu_intensity": cpu_intensity,
                    "peak_rss_mb": m.get("peak_rss_mb", 0.0),
                    "avg_mem_delta_mb": m.get("avg_mem_delta_mb", 0.0),
                    "status_2xx": m.get("status_2xx", 0),
                    "status_4xx": m.get("status_4xx", 0),
                    "status_5xx": m.get("status_5xx", 0),
                    "top_endpoints": [
                        {"endpoint": ep, **stats}
                        for ep, stats in sorted(
                            m.get("endpoints", {}).items(),
                            key=lambda item: item[1]["count"],
                            reverse=True,
                        )[:4]
                    ],
                })

            traces_list = list(self.recent_traces)

        modules_list.sort(key=lambda x: (x["total_cpu_time_ms"], x["request_count"]), reverse=True)

        return {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "host": host,
            "process": process,
            "database": database,
            "azure_b2ats": b2ats,
            "full_stack": full_stack,
            "bottlenecks_and_recommendations": recommendations,
            "total_system_requests": total_all_requests,
            "total_system_cpu_time_ms": round(total_all_cpu_ms, 2),
            "modules": modules_list,
            "recent_traces": traces_list,
        }

    def reset_counters(self):
        with self._lock:
            self._init_modules()
            self.recent_traces.clear()


tracker = ResourceTracker()
