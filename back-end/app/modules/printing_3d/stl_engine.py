"""High-Precision STL Analysis and Slicing Engine for FDM 3D Printing."""
import struct
import math
import os
from decimal import Decimal
from typing import Tuple, Dict, Any

MATERIAL_DENSITIES = {
    "PLA+": 1.24,  # g/cm³ - VisionCraft Primary Material
    "PLA": 1.24,   # g/cm³
}


class STLEngine:
    @staticmethod
    def parse_stl(file_bytes: bytes) -> Dict[str, Any]:
        """
        Parse binary or ASCII STL and extract exact bounding box, volume, and surface area.
        Uses the Divergence Theorem for mathematically exact watertight mesh volume.
        """
        # Determine if binary or ASCII
        is_ascii = False
        try:
            head = file_bytes[:512].decode("ascii", errors="ignore").strip().lower()
            if head.startswith("solid") and "facet normal" in head:
                is_ascii = True
        except Exception:
            is_ascii = False

        if is_ascii:
            return STLEngine._parse_ascii_stl(file_bytes)
        else:
            return STLEngine._parse_binary_stl(file_bytes)

    @staticmethod
    def _parse_binary_stl(file_bytes: bytes) -> Dict[str, Any]:
        if len(file_bytes) < 84:
            raise ValueError("Invalid binary STL: file size is smaller than header.")

        triangle_count = struct.unpack("<I", file_bytes[80:84])[0]
        offset = 84

        min_x, max_x = float("inf"), float("-inf")
        min_y, max_y = float("inf"), float("-inf")
        min_z, max_z = float("inf"), float("-inf")
        total_volume_mm3 = 0.0
        total_area_mm2 = 0.0

        for _ in range(triangle_count):
            if offset + 50 > len(file_bytes):
                break

            # normal = struct.unpack("<3f", file_bytes[offset:offset+12])
            x1, y1, z1 = struct.unpack("<3f", file_bytes[offset+12:offset+24])
            x2, y2, z2 = struct.unpack("<3f", file_bytes[offset+24:offset+36])
            x3, y3, z3 = struct.unpack("<3f", file_bytes[offset+36:offset+48])
            offset += 50

            for x, y, z in [(x1, y1, z1), (x2, y2, z2), (x3, y3, z3)]:
                if x < min_x: min_x = x
                if x > max_x: max_x = x
                if y < min_y: min_y = y
                if y > max_y: max_y = y
                if z < min_z: min_z = z
                if z > max_z: max_z = z

            # Divergence theorem volume of tetrahedron formed by triangle and origin (0,0,0)
            v = (-x3 * y2 * z1 + x2 * y3 * z1 + x3 * y1 * z2 - x1 * y3 * z2 - x2 * y1 * z3 + x1 * y2 * z3) / 6.0
            total_volume_mm3 += v

            # Triangle surface area using cross product
            ax, ay, az = x2 - x1, y2 - y1, z2 - z1
            bx, by, bz = x3 - x1, y3 - y1, z3 - z1
            cx = ay * bz - az * by
            cy = az * bx - ax * bz
            cz = ax * by - ay * bx
            area = 0.5 * math.sqrt(cx * cx + cy * cy + cz * cz)
            total_area_mm2 += area

        volume_cm3 = abs(total_volume_mm3) / 1000.0
        surface_area_cm2 = total_area_mm2 / 100.0

        dim_x = max(0.0, max_x - min_x)
        dim_y = max(0.0, max_y - min_y)
        dim_z = max(0.0, max_z - min_z)

        # Automatic FDM Overhang & Support Detection
        # Downward facets steeper than 45° (nz < -0.25) elevated above the print bed require scaffolding
        support_volume_mm3 = 0.0
        overhang_facets = 0
        offset = 84
        for _ in range(triangle_count):
            if offset + 50 > len(file_bytes):
                break
            x1, y1, z1 = struct.unpack("<3f", file_bytes[offset+12:offset+24])
            x2, y2, z2 = struct.unpack("<3f", file_bytes[offset+24:offset+36])
            x3, y3, z3 = struct.unpack("<3f", file_bytes[offset+36:offset+48])
            offset += 50

            ax, ay, az = x2 - x1, y2 - y1, z2 - z1
            bx, by, bz = x3 - x1, y3 - y1, z3 - z1
            cx = ay * bz - az * by
            cy = az * bx - ax * bz
            cz = ax * by - ay * bx
            length = math.sqrt(cx * cx + cy * cy + cz * cz)

            if length > 1e-6:
                nz = cz / length
                z_avg = (z1 + z2 + z3) / 3.0
                if nz < -0.25 and z_avg > (min_z + 0.6):
                    overhang_facets += 1
                    a_xy = 0.5 * abs(cz)
                    h_column = z_avg - min_z
                    # FDM sparse support density: 15% infill + interface layers
                    support_volume_mm3 += a_xy * h_column * 0.15

        support_volume_cm3 = support_volume_mm3 / 1000.0
        has_supports = support_volume_cm3 > 0.02

        return {
            "triangle_count": triangle_count,
            "dim_x_mm": round(dim_x, 2),
            "dim_y_mm": round(dim_y, 2),
            "dim_z_mm": round(dim_z, 2),
            "volume_cm3": round(volume_cm3, 3),
            "surface_area_cm2": round(surface_area_cm2, 2),
            "support_volume_cm3": round(support_volume_cm3, 3),
            "has_supports": has_supports,
            "overhang_facets": overhang_facets,
        }

    @staticmethod
    def _parse_ascii_stl(file_bytes: bytes) -> Dict[str, Any]:
        text = file_bytes.decode("ascii", errors="ignore")
        lines = text.splitlines()

        min_x, max_x = float("inf"), float("-inf")
        min_y, max_y = float("inf"), float("-inf")
        min_z, max_z = float("inf"), float("-inf")
        total_volume_mm3 = 0.0
        total_area_mm2 = 0.0
        triangle_count = 0

        vertices = []
        for line in lines:
            line_str = line.strip().lower()
            if line_str.startswith("vertex"):
                parts = line_str.split()
                if len(parts) >= 4:
                    x, y, z = float(parts[1]), float(parts[2]), float(parts[3])
                    vertices.append((x, y, z))
                    if x < min_x: min_x = x
                    if x > max_x: max_x = x
                    if y < min_y: min_y = y
                    if y > max_y: max_y = y
                    if z < min_z: min_z = z
                    if z > max_z: max_z = z

            elif line_str.startswith("endfacet"):
                if len(vertices) == 3:
                    (x1, y1, z1), (x2, y2, z2), (x3, y3, z3) = vertices
                    v = (-x3 * y2 * z1 + x2 * y3 * z1 + x3 * y1 * z2 - x1 * y3 * z2 - x2 * y1 * z3 + x1 * y2 * z3) / 6.0
                    total_volume_mm3 += v

                    ax, ay, az = x2 - x1, y2 - y1, z2 - z1
                    bx, by, bz = x3 - x1, y3 - y1, z3 - z1
                    cx = ay * bz - az * by
                    cy = az * bx - ax * bz
                    cz = ax * by - ay * bx
                    total_area_mm2 += 0.5 * math.sqrt(cx * cx + cy * cy + cz * cz)
                    triangle_count += 1
                vertices = []

        volume_cm3 = abs(total_volume_mm3) / 1000.0
        surface_area_cm2 = total_area_mm2 / 100.0

        # Automatic Overhang calculation for ASCII
        support_volume_mm3 = 0.0
        overhang_facets = 0
        current_tri = []
        for line in lines:
            line_str = line.strip().lower()
            if line_str.startswith("vertex"):
                parts = line_str.split()
                if len(parts) >= 4:
                    current_tri.append((float(parts[1]), float(parts[2]), float(parts[3])))
            elif line_str.startswith("endfacet"):
                if len(current_tri) == 3:
                    (x1, y1, z1), (x2, y2, z2), (x3, y3, z3) = current_tri
                    ax, ay, az = x2 - x1, y2 - y1, z2 - z1
                    bx, by, bz = x3 - x1, y3 - y1, z3 - z1
                    cx, cy, cz = ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx
                    length = math.sqrt(cx * cx + cy * cy + cz * cz)
                    if length > 1e-6:
                        nz = cz / length
                        z_avg = (z1 + z2 + z3) / 3.0
                        if nz < -0.25 and z_avg > (min_z + 0.6):
                            overhang_facets += 1
                            a_xy = 0.5 * abs(cz)
                            h_column = z_avg - min_z
                            support_volume_mm3 += a_xy * h_column * 0.15
                current_tri = []

        support_volume_cm3 = support_volume_mm3 / 1000.0
        has_supports = support_volume_cm3 > 0.02

        return {
            "triangle_count": triangle_count,
            "dim_x_mm": round(max_x - min_x, 2) if triangle_count > 0 else 0.0,
            "dim_y_mm": round(max_y - min_y, 2) if triangle_count > 0 else 0.0,
            "dim_z_mm": round(max_z - min_z, 2) if triangle_count > 0 else 0.0,
            "volume_cm3": round(volume_cm3, 3),
            "surface_area_cm2": round(surface_area_cm2, 2),
            "support_volume_cm3": round(support_volume_cm3, 3),
            "has_supports": has_supports,
            "overhang_facets": overhang_facets,
        }

    @staticmethod
    def slice_model(
        mesh_meta: Dict[str, Any],
        layer_height_mm: float = 0.20,
        infill_percentage: int = 20,
        material: str = "PLA+",
        support_enabled: bool = True,
    ) -> Dict[str, Any]:
        """
        Simulate industrial FDM slicing parameters for VisionCraft:
        - Material: PLA+ (1.24 g/cm³)
        - Layer Heights: Only 0.2mm (Standard) or 0.1mm (Fine Detail)
        - Automatically detects and calculates required support structures without manual toggles.
        """
        # Constrain layer height to 0.2mm or 0.1mm
        lh = 0.10 if abs(float(layer_height_mm) - 0.10) < 0.05 else 0.20

        volume_cm3 = mesh_meta["volume_cm3"]
        surface_area_cm2 = mesh_meta["surface_area_cm2"]
        dim_z = mesh_meta["dim_z_mm"]

        density = MATERIAL_DENSITIES.get(material.upper(), 1.24)

        # Layer Count based on chosen layer height (0.1mm or 0.2mm)
        layer_count = max(1, int(math.ceil(dim_z / lh)))

        # Shell volume calculation: 2 perimeters @ 0.4mm nozzle = 0.8mm = 0.08cm wall thickness
        wall_thickness_cm = 0.08
        shell_volume_cm3 = min(volume_cm3, surface_area_cm2 * wall_thickness_cm * 0.75)
        core_volume_cm3 = max(0.0, volume_cm3 - shell_volume_cm3)

        # Infill volume
        infill_factor = max(0.05, min(1.0, infill_percentage / 100.0))
        infill_volume_cm3 = core_volume_cm3 * infill_factor

        # Automatic Support calculation directly from mesh overhangs
        auto_support_cm3 = mesh_meta.get("support_volume_cm3", 0.0)
        has_supports = mesh_meta.get("has_supports", auto_support_cm3 > 0.02)
        support_grams = round(auto_support_cm3 * density, 2)

        # Total printed plastic volume in cm3 (includes 4% purge/skin overlap)
        total_plastic_cm3 = (shell_volume_cm3 + infill_volume_cm3 + auto_support_cm3) * 1.04

        # Total mass in grams (Model + Auto-calculated Supports)
        filament_grams = round(total_plastic_cm3 * density, 2)
        filament_grams = max(1.0, filament_grams)

        # Filament length (1.75mm diameter filament: cross-section area = pi * (1.75/2)^2 = 2.405 mm2)
        filament_length_mm = round((total_plastic_cm3 * 1000.0) / 2.405, 1)

        # Print Duration Estimation based on FDM kinematics:
        volumetric_flow_rate = 9.5  # mm3/s
        extrusion_time_sec = (total_plastic_cm3 * 1000.0) / volumetric_flow_rate
        layer_travel_sec = layer_count * 0.45
        heating_sec = 150.0

        total_duration_sec = int(extrusion_time_sec + layer_travel_sec + heating_sec)

        return {
            "layer_count": layer_count,
            "layer_height_mm": lh,
            "infill_percentage": infill_percentage,
            "material": "PLA+",
            "filament_grams": Decimal(str(filament_grams)),
            "filament_length_mm": Decimal(str(filament_length_mm)),
            "estimated_duration_seconds": total_duration_sec,
            "plastic_volume_cm3": round(total_plastic_cm3, 3),
            "support_volume_cm3": round(auto_support_cm3, 3),
            "support_grams": Decimal(str(support_grams)),
            "has_supports": has_supports,
        }

    @staticmethod
    def generate_gcode_preview(
        filename: str,
        telemetry: Dict[str, Any],
        dimensions: Dict[str, Any],
    ) -> str:
        """Generate a valid G-code file with header metadata comments and standard startup sequence."""
        hours = telemetry["estimated_duration_seconds"] // 3600
        mins = (telemetry["estimated_duration_seconds"] % 3600) // 60
        secs = telemetry["estimated_duration_seconds"] % 60

        gcode_content = f"""; ==============================================================================
; Generated by VisionCraft FDM Slicer Engine v1.0
; Source Model: {filename}
; Target Material: {telemetry['material']}
; Layer Height: {telemetry['layer_height_mm']} mm
; Infill: {telemetry['infill_percentage']}%
; Bounding Box: {dimensions['dim_x_mm']} x {dimensions['dim_y_mm']} x {dimensions['dim_z_mm']} mm
;
; --- Slicer Metadata & Telemetry ---
; filament used [g] = {telemetry['filament_grams']}
; filament used [mm] = {telemetry['filament_length_mm']}
; estimated printing time (normal mode) = {hours}h {mins}m {secs}s
; total layers count = {telemetry['layer_count']}
; ==============================================================================

M73 P0 R{int(telemetry['estimated_duration_seconds'] / 60)}
M201 X1000 Y1000 Z200 E5000
M203 X200 Y200 Z12 E120
M204 P1000 R1500 T1500
M205 X8.00 Y8.00 Z0.40 E5.00

; Pre-heat Bed and Nozzle
M140 S60 ; Set Bed Temp
M104 S210 ; Set Extruder Temp
M190 S60 ; Wait for Bed Temp
M109 S210 ; Wait for Extruder Temp

G28 ; Home all axes
G29 ; Auto bed level mesh
G92 E0 ; Reset Extruder
G1 Z2.0 F3000 ; Move Z Axis up
G1 X10.1 Y20 Z0.28 F5000.0 ; Move to start position
G1 X10.1 Y200.0 Z0.28 F1500.0 E15 ; Draw the first prime line
G1 X10.4 Y200.0 Z0.28 F5000.0 ; Move to side
G1 X10.4 Y20 Z0.28 F1500.0 E30 ; Draw the second prime line
G92 E0 ; Reset Extruder
G1 Z2.0 F3000 ; Move Z Axis up

; --- Printing Layer 1 of {telemetry['layer_count']} ---
G1 Z{telemetry['layer_height_mm']} F600
; [Extrusion Toolpaths Simulated for {telemetry['filament_grams']}g]

; --- End of Job Routine ---
M104 S0 ; Turn off extruder
M140 S0 ; Turn off bed
G91 ; Relative positioning
G1 E-2 F2700 ; Retract filament
G1 Z10 F2400 ; Lift nozzle
G90 ; Absolute positioning
G1 X0 Y200 F3000 ; Present finished print
M84 ; Disable motors
"""
        return gcode_content

