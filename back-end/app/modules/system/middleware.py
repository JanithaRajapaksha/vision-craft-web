"""FastAPI Middleware for real-time per-module resource profiling."""
import time
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from app.modules.system.tracker import tracker, read_proc_rss_mb


class ResourceProfilingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        path = request.url.path
        method = request.method
        module_key = tracker.classify_module(path)

        # Ingress payload size
        content_length = request.headers.get("content-length")
        ingress_bytes = int(content_length) if content_length and content_length.isdigit() else 0

        # Mark request in flight
        tracker.record_request_start(module_key)

        start_wall = time.perf_counter()
        start_cpu = time.process_time()
        start_rss_mb = read_proc_rss_mb()
        status_code = 500

        try:
            response = await call_next(request)
            status_code = response.status_code
            return response
        except Exception:
            status_code = 500
            raise
        finally:
            end_wall = time.perf_counter()
            end_cpu = time.process_time()
            end_rss_mb = read_proc_rss_mb()

            wall_time_ms = max(0.01, (end_wall - start_wall) * 1000.0)
            cpu_time_ms = max(0.0, (end_cpu - start_cpu) * 1000.0)

            # Egress payload size
            egress_bytes = 0
            if "response" in locals() and hasattr(response, "headers"):
                resp_cl = response.headers.get("content-length")
                if resp_cl and resp_cl.isdigit():
                    egress_bytes = int(resp_cl)
                response.headers["X-Response-Time-Ms"] = f"{wall_time_ms:.2f}"
                response.headers["X-CPU-Time-Ms"] = f"{cpu_time_ms:.2f}"
                response.headers["X-Module"] = module_key

            # Record in tracker
            tracker.record_request_finish(
                module_key=module_key,
                method=method,
                path=path,
                status_code=status_code,
                wall_time_ms=wall_time_ms,
                cpu_time_ms=cpu_time_ms,
                start_rss_mb=start_rss_mb,
                end_rss_mb=end_rss_mb,
                ingress_bytes=ingress_bytes,
                egress_bytes=egress_bytes,
            )
