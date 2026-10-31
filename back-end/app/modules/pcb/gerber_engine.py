"""VisionCraft PCB & Gerber Analysis Engine.
Parses Gerber RS-274X, Excellon drill files, calculates board area, and generates 3D meshes.
"""
import io
import re
import math
import struct
import zipfile
from typing import Dict, Any, List, Tuple, Optional
from decimal import Decimal


class GerberEngine:
    @staticmethod
    def identify_and_extract_files(raw_bytes: bytes, filename: str) -> Dict[str, Tuple[str, str]]:
        """
        Classifies incoming files (either a ZIP archive or a raw Gerber/Drill text file)
        into: outline, top_copper, bottom_copper, drill, top_mask, bottom_mask, top_silk.
        Returns a dict of layer_type -> (filename, content_str).
        """
        extracted: Dict[str, Tuple[str, str]] = {}

        if zipfile.is_zipfile(io.BytesIO(raw_bytes)):
            with zipfile.ZipFile(io.BytesIO(raw_bytes)) as z:
                for member in z.namelist():
                    # Skip directories or macOS metadata
                    if member.endswith("/") or "__MACOSX" in member:
                        continue
                    try:
                        content_str = z.read(member).decode("utf-8", errors="ignore")
                    except Exception:
                        continue

                    lower_name = member.lower()
                    layer_type = GerberEngine._classify_filename(lower_name, content_str)
                    if layer_type and layer_type not in extracted:
                        extracted[layer_type] = (member, content_str)
        else:
            # Single file upload
            content_str = raw_bytes.decode("utf-8", errors="ignore")
            lower_name = filename.lower()
            layer_type = GerberEngine._classify_filename(lower_name, content_str) or "top_copper"
            extracted[layer_type] = (filename, content_str)

        return extracted

    @staticmethod
    def _classify_filename(name: str, content: str = "") -> Optional[str]:
        """Classify a file by extension, KiCad/Altium naming, or header content."""
        # Outline / Edge cuts / Mechanical
        if any(ext in name for ext in [".gm1", ".gm2", ".gko", ".outline", "edge_cuts", "edge.cuts", "profile", "boardoutline"]):
            return "outline"
        # Drill / Excellon
        if any(ext in name for ext in [".drl", ".xln", ".exc", "-pth.drl", "-npth.drl", "drill"]) or "M48" in content[:200]:
            return "drill"
        # Top Copper
        if any(ext in name for ext in [".gtl", ".top", ".cmp", "f_cu", "f.cu", "toplayer", "copper_top"]):
            return "top_copper"
        # Bottom Copper
        if any(ext in name for ext in [".gbl", ".bot", ".sol", "b_cu", "b.cu", "bottomlayer", "copper_bot"]):
            return "bottom_copper"
        # Solder Mask
        if any(ext in name for ext in [".gts", "f_mask", "f.mask"]):
            return "top_mask"
        if any(ext in name for ext in [".gbs", "b_mask", "b.mask"]):
            return "bottom_mask"
        # Silkscreen
        if any(ext in name for ext in [".gto", "f_silk", "f.silk"]):
            return "top_silk"
        if any(ext in name for ext in [".gbo", "b_silk", "b.silk"]):
            return "bottom_silk"

        return None

    @staticmethod
    def parse_gerber_layer(content: str) -> Dict[str, Any]:
        """
        Parses Gerber RS-274X commands to extract bounding box, pads, traces, and contours.
        """
        # Determine Units (Default mm)
        is_metric = True
        if "%MOIN*%" in content or "G20*" in content:
            is_metric = False
        elif "%MOMM*%" in content or "G21*" in content:
            is_metric = True

        unit_scale = 1.0 if is_metric else 25.4

        # Coordinate format parsing: %FSLAX24Y24*% or %FSLAX25Y25*%
        # format: integer digits (2), decimal digits (4, 5, or 6)
        coord_divisor = 10000.0  # default 4 decimal digits
        fs_match = re.search(r"%FS[L|T]AX(\d)(\d)Y\d(\d)\*?%", content)
        if fs_match:
            dec_x = int(fs_match.group(2))
            coord_divisor = 10.0 ** dec_x

        # Parse Aperture definitions: %ADD10C,0.8000*% or %ADD11R,1.5X1.0*%
        apertures: Dict[int, Dict[str, Any]] = {}
        for ap_match in re.finditer(r"%ADD(\d+)([a-zA-Z]+),([0-9.X]+)\*?%", content):
            d_code = int(ap_match.group(1))
            shape = ap_match.group(2).upper()
            params = ap_match.group(3).split("X")
            dim1 = float(params[0]) * unit_scale if len(params) > 0 else 0.5
            dim2 = float(params[1]) * unit_scale if len(params) > 1 else dim1
            apertures[d_code] = {"shape": shape, "size_x": dim1, "size_y": dim2}

        # Parse operations (D01=draw line, D02=move, D03=flash pad)
        current_aperture = 10
        current_x = 0.0
        current_y = 0.0

        pads: List[Dict[str, Any]] = []
        traces: List[Dict[str, Any]] = []
        all_x: List[float] = []
        all_y: List[float] = []

        # Split commands by '*'
        lines = content.replace("\n", "").split("*")
        for line in lines:
            line = line.strip()
            if not line or line.startswith("%"):
                continue

            # Tool / Aperture switch: G54D12 or D12
            tool_match = re.search(r"D(\d{2,3})", line)
            if tool_match and not any(line.endswith(d) for d in ["D01", "D02", "D03"]):
                current_aperture = int(tool_match.group(1))

            # Coordinates: X12345Y67890D01
            x_match = re.search(r"X([+-]?\d+)", line)
            y_match = re.search(r"Y([+-]?\d+)", line)

            if x_match:
                current_x = (float(x_match.group(1)) / coord_divisor) * unit_scale
            if y_match:
                current_y = (float(y_match.group(1)) / coord_divisor) * unit_scale

            if line.endswith("D01"):  # Draw trace segment
                all_x.append(current_x)
                all_y.append(current_y)
                ap = apertures.get(current_aperture, {"size_x": 0.25})
                traces.append({
                    "x2": round(current_x, 3),
                    "y2": round(current_y, 3),
                    "width": round(ap.get("size_x", 0.25), 3),
                })
            elif line.endswith("D02"):  # Move without drawing
                all_x.append(current_x)
                all_y.append(current_y)
            elif line.endswith("D03"):  # Flash Pad
                all_x.append(current_x)
                all_y.append(current_y)
                ap = apertures.get(current_aperture, {"shape": "C", "size_x": 1.2, "size_y": 1.2})
                pads.append({
                    "x": round(current_x, 3),
                    "y": round(current_y, 3),
                    "shape": ap.get("shape", "C"),
                    "size_x": round(ap.get("size_x", 1.2), 3),
                    "size_y": round(ap.get("size_y", 1.2), 3),
                })

        min_x = min(all_x) if all_x else 0.0
        max_x = max(all_x) if all_x else 0.0
        min_y = min(all_y) if all_y else 0.0
        max_y = max(all_y) if all_y else 0.0

        return {
            "min_x": round(min_x, 3),
            "max_x": round(max_x, 3),
            "min_y": round(min_y, 3),
            "max_y": round(max_y, 3),
            "width_mm": round(max(0.0, max_x - min_x), 2),
            "length_mm": round(max(0.0, max_y - min_y), 2),
            "pads": pads,
            "traces": traces,
            "pad_count": len(pads),
            "trace_count": len(traces),
        }

    @staticmethod
    def parse_excellon_drill(content: str) -> Dict[str, Any]:
        """
        Parses Excellon NC Drill file format to extract drill hole coordinates and tool diameters.
        """
        # Determine Units
        unit_scale = 25.4 if "INCH" in content.upper() else 1.0

        # Coordinate format divisor (Excellon standard: 3.3 or 2.4 decimal)
        divisor = 1000.0  # metric 3 decimal digits default
        if "INCH" in content.upper():
            divisor = 10000.0

        tools: Dict[str, float] = {}
        holes: List[Dict[str, Any]] = []

        # Tool definitions: T01C0.8 or T1F00S00C0.032
        for tool_match in re.finditer(r"(T\d+)[A-Z0-9]*C([0-9.]+)", content):
            t_id = tool_match.group(1)
            dia = float(tool_match.group(2)) * unit_scale
            tools[t_id] = round(dia, 3)

        current_tool = list(tools.keys())[0] if tools else "T01"
        current_dia = tools.get(current_tool, 0.8)

        # Parse coordinate drill hits
        for line in content.splitlines():
            line = line.strip()
            if line.startswith("T") and line in tools:
                current_tool = line
                current_dia = tools.get(current_tool, 0.8)
                continue

            x_m = re.search(r"X([+-]?\d+)", line)
            y_m = re.search(r"Y([+-]?\d+)", line)

            if x_m and y_m:
                x = (float(x_m.group(1)) / divisor) * unit_scale
                y = (float(y_m.group(1)) / divisor) * unit_scale
                holes.append({
                    "x": round(x, 3),
                    "y": round(y, 3),
                    "diameter_mm": current_dia,
                })

        return {
            "holes": holes,
            "hole_count": len(holes),
            "tools": tools,
        }

    @staticmethod
    def analyze_pcb_package(
        files: Dict[str, Tuple[str, str]],
        rate_per_cm2_lkr: Decimal = Decimal("15.00"),
        pcb_thickness_mm: float = 1.6,
    ) -> Dict[str, Any]:
        """
        Full PCB Gerber Package Analysis:
        - Calculates exact Width & Length from outline or copper bounding box
        - Computes Board Area (cm2)
        - Computes Price at specified LKR / cm2 rate
        - Extracts drills and copper pads for top and bottom visualization
        """
        outline_data = None
        if "outline" in files:
            outline_data = GerberEngine.parse_gerber_layer(files["outline"][1])

        top_copper_data = None
        if "top_copper" in files:
            top_copper_data = GerberEngine.parse_gerber_layer(files["top_copper"][1])

        bottom_copper_data = None
        if "bottom_copper" in files:
            bottom_copper_data = GerberEngine.parse_gerber_layer(files["bottom_copper"][1])

        drill_data = None
        if "drill" in files:
            drill_data = GerberEngine.parse_excellon_drill(files["drill"][1])

        # Determine dimensions (prefer outline, fallback to copper bounding box)
        primary = outline_data or top_copper_data or bottom_copper_data
        if not primary or (primary["width_mm"] <= 0 and primary["length_mm"] <= 0):
            # Fallback to standard 50x50 mm if unconstrained
            width_mm = 50.0
            length_mm = 50.0
            min_x, max_x = 0.0, 50.0
            min_y, max_y = 0.0, 50.0
        else:
            width_mm = max(10.0, primary["width_mm"])
            length_mm = max(10.0, primary["length_mm"])
            min_x, max_x = primary["min_x"], primary["max_x"]
            min_y, max_y = primary["min_y"], primary["max_y"]

        # Calculate Area in cm2: (W_mm * L_mm) / 100
        area_cm2 = round((width_mm * length_mm) / 100.0, 2)
        area_cm2 = max(1.0, area_cm2)

        # Layer Count Detection
        layer_count = 1
        if "top_copper" in files and "bottom_copper" in files:
            layer_count = 2
        elif "bottom_copper" in files:
            layer_count = 2

        # Pricing Calculation based on Area:
        # Minimum prototype base charge = 500 LKR
        # Total Price = max(500, Area_cm2 * Rate_per_cm2 * Layer_factor)
        layer_factor = Decimal("1.0") if layer_count == 1 else Decimal("1.25")
        calc_price = Decimal(str(area_cm2)) * rate_per_cm2_lkr * layer_factor
        minimum_order_lkr = Decimal("500.00")
        final_price_lkr = max(minimum_order_lkr, calc_price).quantize(Decimal("0.01"))

        # Consolidate pads & drill holes normalized to center (0,0)
        center_x = (min_x + max_x) / 2.0
        center_y = (min_y + max_y) / 2.0

        normalized_drills = []
        if drill_data:
            for h in drill_data["holes"][:300]:  # limit for WebGL performance
                normalized_drills.append({
                    "x": round(h["x"] - center_x, 2),
                    "y": round(h["y"] - center_y, 2),
                    "diameter_mm": h["diameter_mm"],
                })

        normalized_top_pads = []
        if top_copper_data:
            for p in top_copper_data["pads"][:500]:
                normalized_top_pads.append({
                    "x": round(p["x"] - center_x, 2),
                    "y": round(p["y"] - center_y, 2),
                    "shape": p["shape"],
                    "size_x": p["size_x"],
                    "size_y": p["size_y"],
                })

        normalized_bottom_pads = []
        if bottom_copper_data:
            for p in bottom_copper_data["pads"][:500]:
                normalized_bottom_pads.append({
                    "x": round(p["x"] - center_x, 2),
                    "y": round(p["y"] - center_y, 2),
                    "shape": p["shape"],
                    "size_x": p["size_x"],
                    "size_y": p["size_y"],
                })

        return {
            "width_mm": round(width_mm, 2),
            "length_mm": round(length_mm, 2),
            "thickness_mm": pcb_thickness_mm,
            "area_cm2": area_cm2,
            "layer_count": layer_count,
            "hole_count": drill_data["hole_count"] if drill_data else len(normalized_drills),
            "top_pad_count": top_copper_data["pad_count"] if top_copper_data else 0,
            "bottom_pad_count": bottom_copper_data["pad_count"] if bottom_copper_data else 0,
            "rate_per_cm2_lkr": rate_per_cm2_lkr,
            "calculated_price_lkr": final_price_lkr,
            "formula_applied": f"{area_cm2} cm² × {rate_per_cm2_lkr} LKR/cm² (Layer factor: {layer_factor}x)",
            "identified_layers": {k: v[0] for k, v in files.items()},
            "drills": normalized_drills,
            "top_pads": normalized_top_pads,
            "bottom_pads": normalized_bottom_pads,
        }

    @staticmethod
    def generate_sample_pcb_package() -> bytes:
        """
        Generates an in-memory ZIP package containing standard 50x50mm 2-layer benchmark
        Gerber files (.gm1 outline, .gtl top copper, .gbl bottom copper, .drl drills).
        """
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
            # 1. Outline: 50mm x 50mm box (.gm1)
            outline_content = (
                "G04 Outline 50x50mm*\n"
                "%FSLAX24Y24*%\n"
                "%MOMM*%\n"
                "%ADD10C,0.2000*%\n"
                "D10*\n"
                "X0Y0D02*\n"
                "X500000Y0D01*\n"
                "X500000Y500000D01*\n"
                "X0Y500000D01*\n"
                "X0Y0D01*\n"
                "M02*\n"
            )
            z.writestr("Benchmark_PCB-Edge_Cuts.gm1", outline_content)

            # 2. Excellon Drill file (.drl) - 4 corner mounting holes (3.2mm) + dual-row header (1.0mm)
            drill_content = (
                "M48\n"
                "METRIC,LZ\n"
                "T01C3.200\n"
                "T02C1.000\n"
                "%\n"
                "T01\n"
                "X3500Y3500\n"
                "X46500Y3500\n"
                "X46500Y46500\n"
                "X3500Y46500\n"
                "T02\n"
            )
            for i in range(10):
                drill_content += f"X{10000 + i * 2540}Y20000\n"
                drill_content += f"X{10000 + i * 2540}Y22540\n"
            drill_content += "M30\n"
            z.writestr("Benchmark_PCB.drl", drill_content)

            # 3. Top Copper (.gtl) - Circular & Rectangular IC pads + routing traces
            top_content = (
                "G04 Top Copper*\n"
                "%FSLAX24Y24*%\n"
                "%MOMM*%\n"
                "%ADD10C,1.6000*%\n"
                "%ADD11R,2.0000X1.2000*%\n"
                "%ADD12C,0.3000*%\n"
                "D10*\n"
            )
            for i in range(10):
                top_content += f"X{10000 + i * 2540}Y20000D03*\n"
                top_content += f"X{10000 + i * 2540}Y22540D03*\n"
            # Add some SMD pads and traces
            top_content += "D11*\n"
            for j in range(6):
                top_content += f"X{20000 + j * 1800}Y35000D03*\n"
                top_content += f"X{20000 + j * 1800}Y40000D03*\n"
            top_content += "D12*\nX10000Y20000D02*\nX10000Y10000D01*\nX40000Y10000D01*\nM02*\n"
            z.writestr("Benchmark_PCB-F_Cu.gtl", top_content)

            # 4. Bottom Copper (.gbl) - Ground plane & bottom routing
            bot_content = (
                "G04 Bottom Copper*\n"
                "%FSLAX24Y24*%\n"
                "%MOMM*%\n"
                "%ADD10C,1.6000*%\n"
                "%ADD12C,0.4000*%\n"
                "D10*\n"
            )
            for i in range(10):
                bot_content += f"X{10000 + i * 2540}Y20000D03*\n"
            bot_content += "D12*\nX30000Y20000D02*\nX30000Y30000D01*\nM02*\n"
            z.writestr("Benchmark_PCB-B_Cu.gbl", bot_content)

        return buf.getvalue()

    @staticmethod
    def generate_pcb_stl(
        width_mm: float,
        length_mm: float,
        thickness_mm: float = 1.6,
        drills: List[Dict[str, Any]] = None,
        pads: List[Dict[str, Any]] = None,
    ) -> bytes:
        """
        Generates a valid binary STL representing the 3D solid PCB board with raised pads.
        """
        w2 = width_mm / 2.0
        l2 = length_mm / 2.0
        t2 = thickness_mm / 2.0

        # Create base substrate box triangles (12 triangles)
        triangles: List[Tuple[Tuple[float, float, float], Tuple[float, float, float], Tuple[float, float, float]]] = [
            # Top face (+Z)
            ((-w2, -l2, t2), (w2, -l2, t2), (w2, l2, t2)),
            ((-w2, -l2, t2), (w2, l2, t2), (-w2, l2, t2)),
            # Bottom face (-Z)
            ((-w2, -l2, -t2), (w2, l2, -t2), (w2, -l2, -t2)),
            ((-w2, -l2, -t2), (-w2, l2, -t2), (w2, l2, -t2)),
            # Front (+Y)
            ((-w2, l2, -t2), (w2, l2, -t2), (w2, l2, t2)),
            ((-w2, l2, -t2), (w2, l2, t2), (-w2, l2, t2)),
            # Back (-Y)
            ((-w2, -l2, -t2), (w2, -l2, t2), (w2, -l2, -t2)),
            ((-w2, -l2, -t2), (-w2, -l2, t2), (w2, -l2, t2)),
            # Right (+X)
            ((w2, -l2, -t2), (w2, l2, -t2), (w2, l2, t2)),
            ((w2, -l2, -t2), (w2, l2, t2), (w2, -l2, t2)),
            # Left (-X)
            ((-w2, -l2, -t2), (-w2, -l2, t2), (-w2, l2, t2)),
            ((-w2, -l2, -t2), (-w2, l2, t2), (-w2, l2, -t2)),
        ]

        # Add raised pads on top surface (small rectangular or circular prism boxes)
        pad_elevation = t2 + 0.05
        if pads:
            for p in pads[:120]:  # limit to prevent huge STL files
                px = p["x"]
                py = p["y"]
                sx = p.get("size_x", 1.2) / 2.0
                sy = p.get("size_y", 1.2) / 2.0
                # Pad top face
                triangles.append(((px - sx, py - sy, pad_elevation), (px + sx, py - sy, pad_elevation), (px + sx, py + sy, pad_elevation)))
                triangles.append(((px - sx, py - sy, pad_elevation), (px + sx, py + sy, pad_elevation), (px - sx, py + sy, pad_elevation)))

        # Pack into binary STL format
        raw = bytearray(b"\x00" * 80)  # 80-byte header
        raw.extend(struct.pack("<I", len(triangles)))
        for v1, v2, v3 in triangles:
            # Normal (0,0,0)
            raw.extend(struct.pack("<3f", 0.0, 0.0, 0.0))
            raw.extend(struct.pack("<3f", *v1))
            raw.extend(struct.pack("<3f", *v2))
            raw.extend(struct.pack("<3f", *v3))
            raw.extend(struct.pack("<H", 0))

        return bytes(raw)

