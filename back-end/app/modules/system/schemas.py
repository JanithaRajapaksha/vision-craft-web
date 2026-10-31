"""System and Resource Telemetry Schemas focused on CPU, RAM, and Azure B2ats Sizing."""
from typing import List, Optional, Dict, Any
from pydantic import BaseModel


class HostMetrics(BaseModel):
    cpu_cores: int
    cpu_load_1m: float
    cpu_load_5m: float
    cpu_load_15m: float
    cpu_load_percent: float
    ram_total_mb: float
    ram_used_mb: float
    ram_available_mb: float
    ram_used_percent: float
    disk_total_gb: float
    disk_used_gb: float
    disk_free_gb: float
    disk_used_percent: float


class ProcessMetrics(BaseModel):
    pid: int
    uptime_seconds: int
    uptime_formatted: str
    process_start_iso: str
    current_rss_mb: float
    peak_rss_mb: float
    user_cpu_time_seconds: float
    system_cpu_time_seconds: float
    total_cpu_time_seconds: float
    thread_count: int


class DatabaseMetrics(BaseModel):
    dialect: str
    storage_type: str
    file_path: Optional[str] = None
    database_size_mb: float
    status: str


class AzureB2atsProfile(BaseModel):
    vm_type: str
    vm_ram_total_mb: float
    backend_rss_mb: float
    ram_consumption_percent: float
    headroom_mb: float
    risk_level: str
    badge_class: str
    status_text: str


class ServiceItem(BaseModel):
    key: str
    name: str
    role: str
    status: str
    estimated_or_live: str
    rss_mb: float
    azure_b2ats_cap_mb: float
    cpu_percent: float = 0.0
    azure_b2ats_cpu_cap_percent: float = 40.0
    heap_used_mb: Optional[float] = None
    database_size_mb: Optional[float] = None
    connected_clients: Optional[int] = None
    active_workers: Optional[int] = None
    uptime: Optional[str] = None


class FullStackAnalysis(BaseModel):
    target_vm: str
    # Memory (RAM)
    total_stack_ram_mb: float
    os_kernel_overhead_mb: float
    total_vm_ram_needed_mb: float
    target_b2ats_ram_mb: float
    headroom_mb: float
    consumption_percent: float
    overall_risk: str
    risk_summary: str
    # CPU Compute
    total_stack_cpu_percent: float = 0.0
    cpu_baseline_percent: float = 20.0
    cpu_max_percent: float = 200.0
    cpu_headroom_percent: float = 180.0
    cpu_credit_status: str = "SUSTAINABLE"
    cpu_risk_summary: str = "Total CPU is within the 20% sustainable Azure B2ats baseline."
    services: List[ServiceItem]


class BottleneckFinding(BaseModel):
    type: str
    severity: str
    title: str
    detail: str
    optimization: str


class EndpointStat(BaseModel):
    endpoint: str
    count: int
    total_ms: float
    avg_ms: float
    max_ms: float
    cpu_ms: float = 0.0
    errors: int


class ModuleResourceMetrics(BaseModel):
    id: str
    name: str
    description: str
    prefix: str
    color: str
    request_count: int
    request_share_percent: float
    active_requests: int
    total_wall_time_ms: float
    avg_wall_time_ms: float
    max_wall_time_ms: float
    total_cpu_time_ms: float
    avg_cpu_time_ms: float
    cpu_share_percent: float
    cpu_intensity: str = "LOW"
    peak_rss_mb: float = 0.0
    avg_mem_delta_mb: float = 0.0
    status_2xx: int
    status_4xx: int
    status_5xx: int
    top_endpoints: List[EndpointStat] = []


class RequestTrace(BaseModel):
    timestamp: str
    module: str
    method: str
    path: str
    status: int
    duration_ms: float
    cpu_ms: float
    mem_mb: Optional[float] = None


class SystemResourcesResponse(BaseModel):
    timestamp: str
    host: HostMetrics
    process: ProcessMetrics
    database: DatabaseMetrics
    azure_b2ats: AzureB2atsProfile
    full_stack: FullStackAnalysis
    bottlenecks_and_recommendations: List[BottleneckFinding]
    total_system_requests: int
    total_system_cpu_time_ms: float
    modules: List[ModuleResourceMetrics]
    recent_traces: List[RequestTrace]
