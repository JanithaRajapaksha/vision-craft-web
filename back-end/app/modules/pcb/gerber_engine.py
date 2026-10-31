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
        lower = name.lower()
        # Outline / Edge cuts / Mechanical
        if any(ext in lower for ext in [".gm1", ".gm2", ".gko", ".outline", "edge_cuts", "edge.cuts", "edge-cuts", "profile", "boardoutline"]):
            return "outline"
        # Drill / Excellon
        if any(ext in lower for ext in [".drl", ".xln", ".exc", "-pth.drl", "-npth.drl", "drill"]) or "M48" in content[:200]:
            return "drill"
        # Drill Drawing
        if any(ext in lower for ext in [".gdd", "drilldrawing", "drill_drawing", "drill-drawing"]):
            return "drill_drawing"
        # Top Copper
        if any(ext in lower for ext in [".gtl", ".top", ".cmp", "f_cu", "f.cu", "f-cu", "toplayer", "copper_top"]):
            return "top_copper"
        # Bottom Copper
        if any(ext in lower for ext in [".gbl", ".bot", ".sol", "b_cu", "b.cu", "b-cu", "bottomlayer", "copper_bot"]):
            return "bottom_copper"
        # Solder Mask
        if any(ext in lower for ext in [".gts", "f_mask", "f.mask", "f-mask"]):
            return "top_mask"
        if any(ext in lower for ext in [".gbs", "b_mask", "b.mask", "b-mask"]):
            return "bottom_mask"
        # Silkscreen
        if any(ext in lower for ext in [".gto", "f_silk", "f.silk", "f-silk"]):
            return "top_silk"
        if any(ext in lower for ext in [".gbo", "b_silk", "b.silk", "b-silk"]):
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

            # Coordinates: X12345Y67890D01 or with explicit decimals X12.345Y67.890
            x_match = re.search(r"X([+-]?[\d.]+)", line)
            y_match = re.search(r"Y([+-]?[\d.]+)", line)

            if x_match:
                raw_x = x_match.group(1)
                if "." in raw_x:
                    current_x = float(raw_x) * unit_scale
                else:
                    current_x = (float(raw_x) / coord_divisor) * unit_scale
            if y_match:
                raw_y = y_match.group(1)
                if "." in raw_y:
                    current_y = float(raw_y) * unit_scale
                else:
                    current_y = (float(raw_y) / coord_divisor) * unit_scale

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

        center_min_x = min(all_x) if all_x else 0.0
        center_max_x = max(all_x) if all_x else 0.0
        center_min_y = min(all_y) if all_y else 0.0
        center_max_y = max(all_y) if all_y else 0.0

        min_x = center_min_x
        max_x = center_max_x
        min_y = center_min_y
        max_y = center_max_y

        # If centerline is unconstrained, check pygerber
        if max_x - min_x <= 0.0:
            try:
                from pygerber.gerberx3.api import Rasterized2DLayer, Rasterized2DLayerParams, ColorScheme
                layer = Rasterized2DLayer(
                    options=Rasterized2DLayerParams(
                        source_code=content,
                        colors=ColorScheme.COPPER_ALPHA,
                    )
                )
                res = layer.render()
                bbox = res.get_properties().target_bounding_box
                pg_min_x = float(bbox.min_x.as_millimeters())
                pg_max_x = float(bbox.max_x.as_millimeters())
                pg_min_y = float(bbox.min_y.as_millimeters())
                pg_max_y = float(bbox.max_y.as_millimeters())
                if pg_max_x > pg_min_x and pg_max_y > pg_min_y:
                    min_x = pg_min_x
                    max_x = pg_max_x
                    min_y = pg_min_y
                    max_y = pg_max_y
            except Exception:
                pass

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
        Parses an Excellon (.drl / .nc / .xln) drill file.
        Extracts tool definitions (diameters), drill hits (X, Y), and routed slots (G85).
        Handles metric (mm) and inch coordinates with scale conversion to mm.
        """
        lines = content.splitlines()
        tools: Dict[int, float] = {}
        is_inch = "INCH" in content.upper() or "G20" in content.upper()
        scale = 25.4 if is_inch else 1.0
        divisor = 10000.0 if is_inch else 1000.0
        current_tool: Optional[int] = None
        hits: List[Tuple[int, float, float]] = []
        slots: List[Tuple[int, float, float, float, float]] = []
        cur_x, cur_y = 0.0, 0.0

        def parse_coord(raw: Optional[str], fallback: float) -> float:
            if not raw:
                return fallback
            if "." in raw:
                return float(raw) * scale
            return (float(raw) / divisor) * scale

        for line in lines:
            line = line.strip()
            if not line or line.startswith(";"):
                continue

            # Header unit declarations
            if "METRIC" in line or line == "G21":
                scale = 1.0
                divisor = 1000.0
                continue
            elif "INCH" in line or line == "G20":
                scale = 25.4
                divisor = 10000.0
                continue

            # Tool definition, e.g. T01C0.90002 or T1C0.0354
            m_tool = re.search(r"T(\d+)[^C]*C([\d.]+)", line)
            if m_tool:
                t_num = int(m_tool.group(1))
                dia = float(m_tool.group(2)) * scale
                tools[t_num] = round(dia, 4)
                continue

            # Tool selection, e.g. T01 or T1
            m_tchange = re.match(r"^T(\d+)$", line)
            if m_tchange:
                current_tool = int(m_tchange.group(1))
                continue

            # Slot routing: X...Y...G85X...Y...
            if "G85" in line:
                parts = line.split("G85")
                mx1 = re.search(r"X([+-]?[\d.]+)", parts[0])
                my1 = re.search(r"Y([+-]?[\d.]+)", parts[0])
                mx2 = re.search(r"X([+-]?[\d.]+)", parts[1])
                my2 = re.search(r"Y([+-]?[\d.]+)", parts[1])
                x1 = parse_coord(mx1.group(1) if mx1 else None, cur_x)
                y1 = parse_coord(my1.group(1) if my1 else None, cur_y)
                x2 = parse_coord(mx2.group(1) if mx2 else None, x1)
                y2 = parse_coord(my2.group(1) if my2 else None, y1)
                cur_x, cur_y = x2, y2
                t = current_tool if current_tool is not None else (list(tools.keys())[0] if tools else 1)
                slots.append((t, round(x1, 4), round(y1, 4), round(x2, 4), round(y2, 4)))
                continue

            # Drill hit: X...Y...
            mx = re.search(r"X([+-]?[\d.]+)", line)
            my = re.search(r"Y([+-]?[\d.]+)", line)
            if mx or my:
                if mx:
                    cur_x = parse_coord(mx.group(1), cur_x)
                if my:
                    cur_y = parse_coord(my.group(1), cur_y)
                t = current_tool if current_tool is not None else (list(tools.keys())[0] if tools else 1)
                hits.append((t, round(cur_x, 4), round(cur_y, 4)))

        # Consolidated holes list for legacy coordinate queries
        holes = []
        for t, x, y in hits:
            dia = tools.get(t, 0.8)
            holes.append({"x": x, "y": y, "diameter_mm": dia, "tool": t})

        slots_data = []
        for t, x1, y1, x2, y2 in slots:
            dia = tools.get(t, 0.8)
            slots_data.append({
                "x1": x1,
                "y1": y1,
                "x2": x2,
                "y2": y2,
                "diameter_mm": dia,
                "tool": t,
            })

        # Generate standard RS-274X Gerber representation for hits and routed slots
        gerber_code = GerberEngine.excellon_to_gerber_rs274x(tools, hits, slots)

        return {
            "tools": {f"T{k:02d}": v for k, v in tools.items()},
            "raw_tools": tools,
            "hits": hits,
            "slots": slots,
            "holes": holes,
            "slots_data": slots_data,
            "hit_count": len(hits),
            "slot_count": len(slots),
            "hole_count": len(hits) + len(slots),
            "gerber_rs274x": gerber_code,
        }

    @staticmethod
    def excellon_to_gerber_rs274x(
        tools: Dict[int, float],
        hits: List[Tuple[int, float, float]],
        slots: List[Tuple[int, float, float, float, float]],
    ) -> str:
        """
        Converts Excellon drill coordinates and routed G85 slots into standard Gerber RS-274X
        format for exact vector aperture interpolation and rounded pill slot rendering.
        """
        lines = [
            "%FSLAX45Y45*%",
            "%MOMM*%",
            "%LPD*%",
        ]

        tool_aperture: Dict[int, int] = {}
        for idx, (t_num, dia) in enumerate(sorted(tools.items()), start=10):
            tool_aperture[t_num] = idx
            lines.append(f"%ADD{idx}C,{dia:.5f}*%")

        cur_tool = None
        for t, x, y in hits:
            if t not in tool_aperture:
                continue
            if t != cur_tool:
                lines.append(f"D{tool_aperture[t]}*")
                cur_tool = t
            ix = int(round(x * 100000))
            iy = int(round(y * 100000))
            lines.append(f"X{ix}Y{iy}D03*")

        for t, x1, y1, x2, y2 in slots:
            if t not in tool_aperture:
                continue
            if t != cur_tool:
                lines.append(f"D{tool_aperture[t]}*")
                cur_tool = t
            ix1 = int(round(x1 * 100000))
            iy1 = int(round(y1 * 100000))
            ix2 = int(round(x2 * 100000))
            iy2 = int(round(y2 * 100000))
            lines.append(f"G01*X{ix1}Y{iy1}D02*X{ix2}Y{iy2}D01*")

        lines.append("M02*")
        return "\n".join(lines)

    @staticmethod
    def render_layer_png_base64(gerber_text: str, dpi: int = 250) -> Optional[str]:
        """Renders an RS-274X Gerber layer to a transparent base64 PNG using pygerber with clean alpha."""
        try:
            import io
            import base64
            import PIL.Image
            if not hasattr(PIL.Image, "Transpose"):
                PIL.Image.Transpose = PIL.Image

            from pygerber.common.rgba import RGBA
            from pygerber.gerberx3.api.v2 import GerberFile, FileTypeEnum, ColorScheme
            from pygerber.gerberx3.renderer2.raster import RasterRenderer2, RasterRenderer2Hooks

            clean_copper = ColorScheme.COPPER_ALPHA.model_copy(
                update={
                    "background_color": RGBA(r=0, g=0, b=0, a=0),
                    "solid_color": RGBA(r=217, g=119, b=6, a=255),
                    "clear_color": RGBA(r=0, g=0, b=0, a=0),
                    "solid_region_color": RGBA(r=245, g=158, b=11, a=240),
                    "clear_region_color": RGBA(r=0, g=0, b=0, a=0),
                }
            )

            gfile = GerberFile.from_str(gerber_text, FileTypeEnum.COPPER)
            parsed = gfile.parse()
            dpmm = max(10, int(round(dpi / 25.4)))
            img_ref = RasterRenderer2(RasterRenderer2Hooks(color_scheme=clean_copper, dpmm=dpmm)).render(parsed._command_buffer)

            buf = io.BytesIO()
            img_ref.image.save(buf, format="PNG")
            return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode("utf-8")
        except Exception:
            return None

    @staticmethod
    def render_pcb_layers_base64(
        files: Dict[str, Tuple[str, str]],
        drill_data: Optional[Dict[str, Any]] = None,
        dpmm: int = 20,
    ) -> Dict[str, Optional[str]]:
        """
        Renders all available PCB layers (bottom copper, top copper, outline, drill hits & slots, drill drawing)
        to transparent high-resolution base64 PNGs.
        Uses pygerber v2 Project compositing engine to ensure exact vector interpolation and
        1:1 aligned canvas offsets across all layers.
        """
        try:
            import io
            import base64
            import site
            import sys
            user_site = site.getusersitepackages()
            if user_site and user_site not in sys.path:
                sys.path.insert(0, user_site)

            import PIL.Image
            if not hasattr(PIL.Image, "Transpose"):
                PIL.Image.Transpose = PIL.Image

            from pygerber.gerberx3.api.v2 import (
                GerberFile,
                Project,
                FileTypeEnum,
                ColorScheme,
            )
            from pygerber.gerberx3.renderer2.raster import RasterRenderer2, RasterRenderer2Hooks
            from pygerber.common.rgba import RGBA

            project_items: List[Tuple[str, Any, ColorScheme]] = []

            # 1. Outline Layer
            if "outline" in files:
                outline_scheme = ColorScheme.COPPER_ALPHA.model_copy(
                    update={
                        "background_color": RGBA(r=0, g=0, b=0, a=0),
                        "solid_color": RGBA(r=168, g=85, b=247, a=255),  # High-contrast purple
                        "clear_color": RGBA(r=0, g=0, b=0, a=0),
                        "solid_region_color": RGBA(r=168, g=85, b=247, a=200),
                        "clear_region_color": RGBA(r=0, g=0, b=0, a=0),
                    }
                )
                gfile = GerberFile.from_str(files["outline"][1], FileTypeEnum.EDGE)
                project_items.append(("outline", gfile, outline_scheme))

            # 2. Bottom Copper Layer
            if "bottom_copper" in files:
                bottom_scheme = ColorScheme.COPPER_ALPHA.model_copy(
                    update={
                        "background_color": RGBA(r=0, g=0, b=0, a=0),
                        "solid_color": RGBA(r=217, g=119, b=6, a=255),   # Golden amber copper
                        "clear_color": RGBA(r=0, g=0, b=0, a=0),         # 100% clean transparent clearance
                        "solid_region_color": RGBA(r=245, g=158, b=11, a=240),
                        "clear_region_color": RGBA(r=0, g=0, b=0, a=0),
                    }
                )
                gfile = GerberFile.from_str(files["bottom_copper"][1], FileTypeEnum.COPPER)
                project_items.append(("bottom_copper", gfile, bottom_scheme))

            # 3. Top Copper Layer
            if "top_copper" in files:
                top_scheme = ColorScheme.COPPER_ALPHA.model_copy(
                    update={
                        "background_color": RGBA(r=0, g=0, b=0, a=0),
                        "solid_color": RGBA(r=234, g=88, b=12, a=255),   # Rich copper orange
                        "clear_color": RGBA(r=0, g=0, b=0, a=0),
                        "solid_region_color": RGBA(r=251, g=146, b=60, a=240),
                        "clear_region_color": RGBA(r=0, g=0, b=0, a=0),
                    }
                )
                gfile = GerberFile.from_str(files["top_copper"][1], FileTypeEnum.COPPER)
                project_items.append(("top_copper", gfile, top_scheme))

            # 4. Plated Drill Layer (Hits + G85 Slots converted to RS-274X)
            drl_gerber = drill_data.get("gerber_rs274x") if drill_data else None
            if not drl_gerber and "drill" in files:
                parsed_drl = GerberEngine.parse_excellon_drill(files["drill"][1])
                drl_gerber = parsed_drl.get("gerber_rs274x")

            if drl_gerber:
                drill_scheme = ColorScheme.COPPER_ALPHA.model_copy(
                    update={
                        "background_color": RGBA(r=0, g=0, b=0, a=0),
                        "solid_color": RGBA(r=255, g=230, b=120, a=255),  # High-contrast bright gold drill/slot hits
                        "clear_color": RGBA(r=255, g=230, b=120, a=255),
                        "solid_region_color": RGBA(r=255, g=230, b=120, a=255),
                        "clear_region_color": RGBA(r=255, g=230, b=120, a=255),
                    }
                )
                gfile = GerberFile.from_str(drl_gerber, FileTypeEnum.PLATED)
                project_items.append(("drill", gfile, drill_scheme))

            # 5. Gerber Drill Drawing Layer
            if "drill_drawing" in files:
                drawing_scheme = ColorScheme.COPPER_ALPHA.model_copy(
                    update={
                        "background_color": RGBA(r=0, g=0, b=0, a=0),
                        "solid_color": RGBA(r=56, g=189, b=248, a=255),   # Sky blue
                        "clear_color": RGBA(r=0, g=0, b=0, a=0),
                        "solid_region_color": RGBA(r=56, g=189, b=248, a=200),
                        "clear_region_color": RGBA(r=0, g=0, b=0, a=0),
                    }
                )
                gfile = GerberFile.from_str(files["drill_drawing"][1], FileTypeEnum.OTHER)
                project_items.append(("drill_drawing", gfile, drawing_scheme))

            if not project_items:
                return {}

            # Parse composite project to get unified bounding box
            proj = Project([item[1] for item in project_items])
            parsed_proj = proj.parse()

            min_x_mm = min(f.get_info().min_x_mm for f in parsed_proj.files)
            min_y_mm = min(f.get_info().min_y_mm for f in parsed_proj.files)
            max_x_mm = max(f.get_info().max_x_mm for f in parsed_proj.files)
            max_y_mm = max(f.get_info().max_y_mm for f in parsed_proj.files)

            width_mm = float(max_x_mm - min_x_mm)
            height_mm = float(max_y_mm - min_y_mm)

            total_w = max(100, min(3000, int(width_mm * dpmm)))
            total_h = max(100, min(3000, int(height_mm * dpmm)))

            results: Dict[str, Optional[str]] = {}

            # Render each layer on the common canvas
            for (key, _, scheme), p_file in zip(project_items, parsed_proj.files):
                try:
                    img_ref = RasterRenderer2(
                        RasterRenderer2Hooks(color_scheme=scheme, dpmm=dpmm)
                    ).render(p_file._command_buffer)

                    offset_x = int(abs(min_x_mm - p_file.get_info().min_x_mm) * dpmm)
                    offset_y = int(abs(max_y_mm - p_file.get_info().max_y_mm) * dpmm)

                    canvas = PIL.Image.new("RGBA", (total_w, total_h), (0, 0, 0, 0))
                    canvas.paste(img_ref.image, (offset_x, offset_y), img_ref.image)

                    buf = io.BytesIO()
                    canvas.save(buf, format="PNG")
                    results[key] = "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode("utf-8")
                except Exception:
                    results[key] = None

            return results
        except Exception:
            return {}

            return results
        except Exception:
            return {}

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

        # Render 2D Gerber Layer Images via pygerber on a unified canvas
        rendered_layers = GerberEngine.render_pcb_layers_base64(
            files=files,
            drill_data=drill_data,
            dpmm=20,
        )

        slot_count = drill_data.get("slot_count", 0) if drill_data else 0

        return {
            "width_mm": round(width_mm, 2),
            "length_mm": round(length_mm, 2),
            "thickness_mm": pcb_thickness_mm,
            "area_cm2": area_cm2,
            "layer_count": layer_count,
            "hole_count": drill_data["hole_count"] if drill_data else len(normalized_drills),
            "slot_count": slot_count,
            "top_pad_count": top_copper_data["pad_count"] if top_copper_data else 0,
            "bottom_pad_count": bottom_copper_data["pad_count"] if bottom_copper_data else 0,
            "rate_per_cm2_lkr": rate_per_cm2_lkr,
            "calculated_price_lkr": final_price_lkr,
            "formula_applied": f"{area_cm2} cm² × {rate_per_cm2_lkr} LKR/cm² (Layer factor: {layer_factor}x)",
            "identified_layers": {k: v[0] for k, v in files.items()},
            "drills": normalized_drills,
            "top_pads": normalized_top_pads,
            "bottom_pads": normalized_bottom_pads,
            "top_layer_image_base64": rendered_layers.get("top_copper"),
            "bottom_layer_image_base64": rendered_layers.get("bottom_copper"),
            "outline_layer_image_base64": rendered_layers.get("outline"),
            "drill_layer_image_base64": rendered_layers.get("drill"),
            "drill_drawing_layer_image_base64": rendered_layers.get("drill_drawing"),
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

