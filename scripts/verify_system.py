#!/usr/bin/env python3
"""
VisionCraft OS – Automated System Health & End-to-End Verification Suite
======================================================================
Tests backend, frontend proxy, database auth, 3D slicing, and 25 LKR/g pricing.
Works whether VisionCraft is running in Docker Compose or Local Dev.

Usage:
    python3 scripts/verify_system.py
"""
import sys
import struct
import time
from decimal import Decimal
import urllib.request
import urllib.error
import json

GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
BLUE = "\033[94m"
BOLD = "\033[1m"
RESET = "\033[0m"

FRONTEND_URL = "http://localhost:3000"
BACKEND_URL = "http://localhost:8000"


def print_header(title: str):
    print(f"\n{BOLD}{BLUE}{'=' * 70}{RESET}")
    print(f"{BOLD}{BLUE}  {title}{RESET}")
    print(f"{BOLD}{BLUE}{'=' * 70}{RESET}")


def create_cube_stl(size: float = 20.0) -> bytes:
    triangles = [
        ((0,0,0), (size,0,0), (size,size,0)),
        ((0,0,0), (size,size,0), (0,size,0)),
        ((0,0,size), (size,size,size), (size,0,size)),
        ((0,0,size), (0,size,size), (size,size,size)),
        ((0,0,0), (size,0,size), (size,0,0)),
        ((0,0,0), (0,0,size), (size,0,size)),
        ((0,size,0), (size,size,0), (size,size,size)),
        ((0,size,0), (size,size,size), (0,size,size)),
        ((0,0,0), (0,size,0), (0,size,size)),
        ((0,0,0), (0,size,size), (0,0,size)),
        ((size,0,0), (size,size,size), (size,size,0)),
        ((size,0,0), (size,0,size), (size,size,size)),
    ]
    raw = bytearray(b"\x00" * 80)
    raw.extend(struct.pack("<I", len(triangles)))
    for v1, v2, v3 in triangles:
        raw.extend(struct.pack("<3f", 0.0, 0.0, 0.0))
        raw.extend(struct.pack("<3f", *v1))
        raw.extend(struct.pack("<3f", *v2))
        raw.extend(struct.pack("<3f", *v3))
        raw.extend(struct.pack("<H", 0))
    return bytes(raw)


def http_request(url: str, method: str = "GET", headers: dict = None, data: bytes = None):
    t0 = time.time()
    req = urllib.request.Request(url, data=data, method=method)
    if headers:
        for k, v in headers.items():
            req.add_header(k, v)
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            elapsed = (time.time() - t0) * 1000
            return resp.status, resp.read(), elapsed
    except urllib.error.HTTPError as e:
        elapsed = (time.time() - t0) * 1000
        return e.code, e.read(), elapsed
    except Exception as e:
        elapsed = (time.time() - t0) * 1000
        return 0, str(e).encode(), elapsed


def run_checks():
    print_header("VisionCraft OS – Automated System Diagnostic Test Suite")
    results = []

    def record(name: str, passed: bool, msg: str, elapsed_ms: float):
        status_str = f"{GREEN}PASS{RESET}" if passed else f"{RED}FAIL{RESET}"
        print(f"[{status_str}] {name:<46} ({elapsed_ms:>6.1f}ms) - {msg}")
        results.append((name, passed, msg))

    # 1. Backend Direct Health Check
    status, body, t = http_request(f"{BACKEND_URL}/api/v1/health")
    if status == 200:
        data = json.loads(body.decode())
        record("1. Backend Health Check (port 8000)", True, f"Status: {data.get('status')}", t)
    else:
        record("1. Backend Health Check (port 8000)", False, f"HTTP {status} - Is backend running?", t)

    # 2. Frontend Next.js Direct Check
    status, body, t = http_request(f"{FRONTEND_URL}/3d-printing")
    if status == 200:
        record("2. Frontend Studio Page (port 3000)", True, "HTML Studio rendered 200 OK", t)
    else:
        record("2. Frontend Studio Page (port 3000)", False, f"HTTP {status} - Is frontend running?", t)

    # 3. Next.js API Proxy / Rewrite Check
    status, body, t = http_request(f"{FRONTEND_URL}/api/v1/health")
    if status == 200:
        record("3. Next.js API Proxy (port 3000 -> 8000)", True, "Proxy successfully routed /api/v1/health", t)
    else:
        record("3. Next.js API Proxy (port 3000 -> 8000)", False, f"Proxy returned {status}", t)

    # 4. Partner Authentication
    login_payload = json.dumps({"email": "janitha@visioncraft.lk", "password": "Password123!"}).encode()
    status, body, t = http_request(
        f"{BACKEND_URL}/api/v1/auth/login",
        method="POST",
        headers={"Content-Type": "application/json"},
        data=login_payload,
    )
    token = None
    if status == 200:
        data = json.loads(body.decode())
        token = data.get("access_token")
        record("4. Partner Authentication (Janitha)", True, f"JWT received (role={data['user']['role']})", t)
    else:
        record("4. Partner Authentication (Janitha)", False, f"HTTP {status} - {body.decode()[:60]}", t)

    # 5. Slicing 20mm Sample Cube at 25.00 LKR/g
    if token:
        status, body, t = http_request(
            f"{BACKEND_URL}/api/v1/3d-printing/sample-cube?size_mm=20.0&layer_height=0.20&infill_percentage=20&material=PLA+&rate_per_gram=25.0",
            method="POST",
            headers={"Authorization": f"Bearer {token}"},
        )
        if status == 200:
            cube_data = json.loads(body.decode())
            rate = Decimal(str(cube_data["rate_per_gram_lkr"]))
            calc_price = Decimal(str(cube_data["calculated_price_lkr"]))
            grams = Decimal(str(cube_data["filament_used_grams"]))
            expected_price = (grams * rate).quantize(Decimal("0.01"))
            price_ok = (calc_price == expected_price) and rate == Decimal("25.00")
            record(
                "5. 1-Click 20mm Cube Slicing (25 LKR/g)",
                price_ok,
                f"Weight: {grams}g | Price: {calc_price} LKR (100 layers)",
                t,
            )
        else:
            record("5. 1-Click 20mm Cube Slicing (25 LKR/g)", False, f"HTTP {status} - {body.decode()[:60]}", t)

    # 6. Multipart Form-Data Binary STL Upload & Slice
    if token:
        stl_bytes = create_cube_stl(20.0)
        boundary = "----WebKitFormBoundaryVisionCraftTest"
        c_type = f"multipart/form-data; boundary={boundary}"
        
        parts = []
        def add_field(name, val):
            parts.append(f"--{boundary}\r\nContent-Disposition: form-data; name=\"{name}\"\r\n\r\n{val}\r\n".encode())
        
        add_field("layer_height", "0.20")
        add_field("infill_percentage", "20")
        add_field("material", "PLA+")
        add_field("rate_per_gram", "25.0")
        
        file_header = f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"benchmark_cube.stl\"\r\nContent-Type: application/octet-stream\r\n\r\n".encode()
        parts.append(file_header)
        parts.append(stl_bytes)
        parts.append(f"\r\n--{boundary}--\r\n".encode())
        
        body_bytes = b"".join(parts)
        status, body, t = http_request(
            f"{BACKEND_URL}/api/v1/3d-printing/upload-and-slice",
            method="POST",
            headers={"Authorization": f"Bearer {token}", "Content-Type": c_type},
            data=body_bytes,
        )
        if status == 200:
            upload_data = json.loads(body.decode())
            cad_id = upload_data.get("cad_model_id")
            job_id = upload_data.get("job_id")
            record("6. Binary STL Upload & Telemetry Extraction", True, f"Triangles: {upload_data['triangle_count']} | Dim: {upload_data['dimensions_mm']['x']}mm", t)
            
            # 7. G-Code Generation & Download
            status_gc, body_gc, t_gc = http_request(
                f"{BACKEND_URL}/api/v1/3d-printing/gcode/{job_id}",
                headers={"Authorization": f"Bearer {token}"},
            )
            gcode_ok = status_gc == 200 and "VisionCraft FDM Slicer" in body_gc.decode()
            record("7. G-Code Kinematics Preview Download", gcode_ok, f"G-Code Header Verified ({len(body_gc)} bytes)", t_gc)

            # 8. Stored STL Mesh Download
            status_stl, body_stl, t_stl = http_request(
                f"{BACKEND_URL}/api/v1/3d-printing/models/{cad_id}/stl",
                headers={"Authorization": f"Bearer {token}"},
            )
            stl_ok = status_stl == 200 and len(body_stl) == len(stl_bytes)
            record("8. Database & Storage Binary Mesh Retrieval", stl_ok, f"Retrieved matching {len(body_stl)} bytes", t_stl)

            # 9. Create Formal Quotation from Slicing Job
            quote_req = json.dumps({
                "slicing_job_id": job_id,
                "customer_name": "Diagnostic Robot Labs",
                "customer_phone": "+94 77 000 0000",
                "quantity": 4,
                "notes": "Automated system test",
                "created_by_partner": "Janitha",
            }).encode()
            status_q, body_q, t_q = http_request(
                f"{BACKEND_URL}/api/v1/commercial/quotations/from-slice",
                method="POST",
                headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
                data=quote_req,
            )
            quote_ok = status_q == 201 and "QT-" in body_q.decode()
            record("9. Create Formal Quotation (QT-2026-XXXX)", quote_ok, f"Quote Number Verified ({status_q})", t_q)

            # 10. Queue Production Order from Slicing Job
            order_req = json.dumps({
                "slicing_job_id": job_id,
                "customer_name": "Diagnostic Robot Labs",
                "quantity": 2,
                "notes": "Priority batch order",
                "assigned_partner": "Janitha",
            }).encode()
            status_o, body_o, t_o = http_request(
                f"{BACKEND_URL}/api/v1/commercial/orders/from-slice",
                method="POST",
                headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
                data=order_req,
            )
            order_ok = status_o == 201 and "ORD-" in body_o.decode()
            record("10. Queue Production Order (ORD-2026-XXXX)", order_ok, f"Order Number Verified ({status_o})", t_o)
        else:
            record("6. Binary STL Upload & Telemetry Extraction", False, f"HTTP {status} - {body.decode()[:60]}", t)

    # 11. Stale/Unknown User Token (Docker/Local DB mismatch test)
    status, body, t = http_request(
        f"{BACKEND_URL}/api/v1/auth/me",
        headers={"Authorization": "Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJub25leGlzdGVudCJ9.dummy"},
    )
    stale_handled = status == 401
    record("11. Stale/Invalid Token 401 Rejection", stale_handled, "Correctly rejected with 401 Unauthorized", t)

    # Summary
    passed_count = sum(1 for _, p, _ in results if p)
    total_count = len(results)
    print_header(f"Diagnostic Summary: {passed_count}/{total_count} Tests Passed")
    if passed_count == total_count:
        print(f"\n{BOLD}{GREEN}ALL SYSTEMS OPERATIONAL! VisionCraft OS is production-ready.{RESET}\n")
    else:
        print(f"\n{BOLD}{RED}ATTENTION: {total_count - passed_count} check(s) failed. Check details above.{RESET}\n")


if __name__ == "__main__":
    run_checks()

