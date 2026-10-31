"use client";

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import {
  RotateCcw,
  Eye,
  Layers,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  FlipHorizontal,
} from "lucide-react";

export interface DrillHoleData {
  x: number;
  y: number;
  diameter_mm: number;
}

export interface PadData {
  x: number;
  y: number;
  shape: string;
  size_x: number;
  size_y: number;
}

interface PCBViewerProps {
  width_mm: number;
  length_mm: number;
  thickness_mm?: number;
  solderMaskColor?: string;
  padFinish?: "ENIG" | "HASL";
  drills?: DrillHoleData[];
  topPads?: PadData[];
  bottomPads?: PadData[];
  stlBlob?: Blob | null;
  className?: string;
}

export function PCBViewer({
  width_mm = 50,
  length_mm = 50,
  thickness_mm = 1.6,
  solderMaskColor = "#166534", // Classic FR-4 Green
  padFinish = "ENIG",
  drills = [],
  topPads = [],
  bottomPads = [],
  stlBlob = null,
  className = "w-full h-full min-h-[500px]",
}: PCBViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [wireframe, setWireframe] = useState(false);
  const [showTopCopper, setShowTopCopper] = useState(true);
  const [showBottomCopper, setShowBottomCopper] = useState(true);
  const [showDrills, setShowDrills] = useState(true);
  const [activeSide, setActiveSide] = useState<"top" | "bottom" | "3d">("3d");

  // Three.js References
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const boardGroupRef = useRef<THREE.Group | null>(null);
  const topCopperGroupRef = useRef<THREE.Group | null>(null);
  const bottomCopperGroupRef = useRef<THREE.Group | null>(null);
  const drillGroupRef = useRef<THREE.Group | null>(null);
  const animationFrameId = useRef<number | null>(null);

  // Camera Orbit State
  const isDragging = useRef(false);
  const previousMousePosition = useRef({ x: 0, y: 0 });
  const cameraDistance = useRef(Math.max(width_mm, length_mm) * 2.2);
  const cameraAngles = useRef({ theta: Math.PI / 4, phi: Math.PI / 3 });

  // Solder Mask Colors Palette
  const maskColorHex = {
    Green: 0x166534,
    "Matte Black": 0x18181b,
    "Royal Blue": 0x1d4ed8,
    "Signal Red": 0xb91c1c,
    White: 0xf1f5f9,
    Purple: 0x6b21a8,
  }[solderMaskColor] ?? 0x166534;

  const padColorHex = padFinish === "ENIG" ? 0xf59e0b : 0x94a3b8;

  // Initialize Three.js Scene
  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x090d16); // Deep slate dark studio
    sceneRef.current = scene;

    // Camera setup
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.5, 2000);
    cameraRef.current = camera;

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    container.innerHTML = "";
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Studio Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.4);
    keyLight.position.set(120, 180, 100);
    keyLight.castShadow = true;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x93c5fd, 0.8);
    fillLight.position.set(-120, -100, -100);
    scene.add(fillLight);

    const underLight = new THREE.DirectionalLight(0xffedd5, 0.6);
    underLight.position.set(0, -150, 0);
    scene.add(underLight);

    // Grid Floor
    const gridDim = Math.max(width_mm, length_mm, 100) * 2;
    const gridHelper = new THREE.GridHelper(gridDim, 20, 0x3b82f6, 0x1e293b);
    gridHelper.position.y = -thickness_mm / 2 - 2;
    scene.add(gridHelper);

    // Board Main Group
    const boardGroup = new THREE.Group();
    scene.add(boardGroup);
    boardGroupRef.current = boardGroup;

    // Groups for toggleable layers
    const topGroup = new THREE.Group();
    const bottomGroup = new THREE.Group();
    const drGroup = new THREE.Group();
    boardGroup.add(topGroup);
    boardGroup.add(bottomGroup);
    boardGroup.add(drGroup);
    topCopperGroupRef.current = topGroup;
    bottomCopperGroupRef.current = bottomGroup;
    drillGroupRef.current = drGroup;

    // Build the 3D PCB geometry
    rebuildPCB();

    // Render loop
    const render = () => {
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
      animationFrameId.current = requestAnimationFrame(render);
    };
    render();

    // Resize Handler
    const handleResize = () => {
      if (!containerRef.current || !rendererRef.current || !cameraRef.current) return;
      const newWidth = containerRef.current.clientWidth;
      const newHeight = containerRef.current.clientHeight;
      cameraRef.current.aspect = newWidth / newHeight;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(newWidth, newHeight);
    };
    window.addEventListener("resize", handleResize);

    // Initial camera position
    updateCameraPosition();

    return () => {
      window.removeEventListener("resize", handleResize);
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
      renderer.dispose();
    };
  }, []);

  // Update Camera Orbit calculation
  const updateCameraPosition = () => {
    if (!cameraRef.current) return;
    const dist = cameraDistance.current;
    const { theta, phi } = cameraAngles.current;

    cameraRef.current.position.x = dist * Math.sin(phi) * Math.sin(theta);
    cameraRef.current.position.y = dist * Math.cos(phi);
    cameraRef.current.position.z = dist * Math.sin(phi) * Math.cos(theta);
    cameraRef.current.lookAt(0, 0, 0);
  };

  // Rebuild 3D PCB Board Geometry when specs change
  const rebuildPCB = () => {
    if (!boardGroupRef.current || !topCopperGroupRef.current || !bottomCopperGroupRef.current || !drillGroupRef.current) return;

    // Clear existing children from layer groups
    while (topCopperGroupRef.current.children.length > 0) {
      topCopperGroupRef.current.remove(topCopperGroupRef.current.children[0]);
    }
    while (bottomCopperGroupRef.current.children.length > 0) {
      bottomCopperGroupRef.current.remove(bottomCopperGroupRef.current.children[0]);
    }
    while (drillGroupRef.current.children.length > 0) {
      drillGroupRef.current.remove(drillGroupRef.current.children[0]);
    }

    // Remove any previous base substrate mesh from boardGroup
    const nonLayerChildren = boardGroupRef.current.children.filter(
      (c) => c !== topCopperGroupRef.current && c !== bottomCopperGroupRef.current && c !== drillGroupRef.current
    );
    nonLayerChildren.forEach((child) => boardGroupRef.current?.remove(child));

    const w = Math.max(10, width_mm);
    const l = Math.max(10, length_mm);
    const t = Math.max(0.6, thickness_mm);

    // 1. FR4 Core Substrate Box
    const substrateGeom = new THREE.BoxGeometry(w, t, l);
    const substrateMat = new THREE.MeshPhysicalMaterial({
      color: maskColorHex,
      roughness: 0.35,
      metalness: 0.1,
      clearcoat: 0.3,
      clearcoatRoughness: 0.25,
      wireframe: wireframe,
    });
    const substrateMesh = new THREE.Mesh(substrateGeom, substrateMat);
    substrateMesh.castShadow = true;
    substrateMesh.receiveShadow = true;
    boardGroupRef.current.add(substrateMesh);

    // 2. Copper Pads Material
    const padMat = new THREE.MeshStandardMaterial({
      color: padColorHex,
      metalness: 0.95,
      roughness: 0.2,
      wireframe: wireframe,
    });

    const halfT = t / 2;

    // Top Pads (+Y surface)
    topPads.forEach((p) => {
      const sx = Math.max(0.4, p.size_x || 1.2);
      const sy = Math.max(0.4, p.size_y || 1.2);
      let geom: THREE.BufferGeometry;
      if (p.shape === "C" || p.shape === "O") {
        geom = new THREE.CylinderGeometry(sx / 2, sx / 2, 0.04, 16);
      } else {
        geom = new THREE.BoxGeometry(sx, 0.04, sy);
      }
      const m = new THREE.Mesh(geom, padMat);
      m.position.set(p.x, halfT + 0.02, -p.y);
      topCopperGroupRef.current?.add(m);
    });

    // Bottom Pads (-Y surface)
    bottomPads.forEach((p) => {
      const sx = Math.max(0.4, p.size_x || 1.2);
      const sy = Math.max(0.4, p.size_y || 1.2);
      let geom: THREE.BufferGeometry;
      if (p.shape === "C" || p.shape === "O") {
        geom = new THREE.CylinderGeometry(sx / 2, sx / 2, 0.04, 16);
      } else {
        geom = new THREE.BoxGeometry(sx, 0.04, sy);
      }
      const m = new THREE.Mesh(geom, padMat);
      m.position.set(p.x, -halfT - 0.02, -p.y);
      bottomCopperGroupRef.current?.add(m);
    });

    // 3. Drill Hole Markers (Dark plated cutouts through the board)
    const drillMat = new THREE.MeshBasicMaterial({
      color: 0x050810,
    });
    drills.forEach((d) => {
      const dia = Math.max(0.5, d.diameter_mm || 0.8);
      const dGeom = new THREE.CylinderGeometry(dia / 2, dia / 2, t + 0.08, 16);
      const dMesh = new THREE.Mesh(dGeom, drillMat);
      dMesh.position.set(d.x, 0, -d.y);
      drillGroupRef.current?.add(dMesh);

      // Gold Annular Ring around drill hole on top surface
      const ringGeom = new THREE.RingGeometry(dia / 2, dia / 2 + 0.35, 16);
      const ringMat = new THREE.MeshStandardMaterial({
        color: padColorHex,
        metalness: 0.95,
        roughness: 0.2,
        side: THREE.DoubleSide,
      });
      const ringMeshTop = new THREE.Mesh(ringGeom, ringMat);
      ringMeshTop.rotation.x = -Math.PI / 2;
      ringMeshTop.position.set(d.x, halfT + 0.025, -d.y);
      drillGroupRef.current?.add(ringMeshTop);

      // Bottom ring
      const ringMeshBot = new THREE.Mesh(ringGeom, ringMat);
      ringMeshBot.rotation.x = Math.PI / 2;
      ringMeshBot.position.set(d.x, -halfT - 0.025, -d.y);
      drillGroupRef.current?.add(ringMeshBot);
    });

    // Update camera distance to frame the board nicely
    cameraDistance.current = Math.max(w, l) * 2.0;
    updateCameraPosition();
  };

  // Re-run geometry rebuild when board attributes change
  useEffect(() => {
    rebuildPCB();
  }, [width_mm, length_mm, thickness_mm, solderMaskColor, padFinish, drills, topPads, bottomPads, wireframe]);

  // Update layer visibility
  useEffect(() => {
    if (topCopperGroupRef.current) topCopperGroupRef.current.visible = showTopCopper;
    if (bottomCopperGroupRef.current) bottomCopperGroupRef.current.visible = showBottomCopper;
    if (drillGroupRef.current) drillGroupRef.current.visible = showDrills;
  }, [showTopCopper, showBottomCopper, showDrills]);

  // Mouse Orbit Event Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    previousMousePosition.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current) return;
    const deltaX = e.clientX - previousMousePosition.current.x;
    const deltaY = e.clientY - previousMousePosition.current.y;

    cameraAngles.current.theta += deltaX * 0.01;
    cameraAngles.current.phi = Math.max(
      0.05,
      Math.min(Math.PI - 0.05, cameraAngles.current.phi - deltaY * 0.01)
    );

    previousMousePosition.current = { x: e.clientX, y: e.clientY };
    updateCameraPosition();
  };

  const handleMouseUp = () => {
    isDragging.current = false;
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    cameraDistance.current = Math.max(
      15,
      Math.min(1000, cameraDistance.current + e.deltaY * 0.25)
    );
    updateCameraPosition();
  };

  // Preset Camera Angles
  const setTopView = () => {
    setActiveSide("top");
    cameraAngles.current = { theta: 0, phi: 0.05 };
    updateCameraPosition();
  };

  const setBottomView = () => {
    setActiveSide("bottom");
    cameraAngles.current = { theta: 0, phi: Math.PI - 0.05 };
    updateCameraPosition();
  };

  const setIsometricView = () => {
    setActiveSide("3d");
    cameraAngles.current = { theta: Math.PI / 4, phi: Math.PI / 3 };
    updateCameraPosition();
  };

  const handleZoom = (inOut: "in" | "out") => {
    const factor = inOut === "in" ? -15 : 15;
    cameraDistance.current = Math.max(15, Math.min(1000, cameraDistance.current + factor));
    updateCameraPosition();
  };

  return (
    <div className={`relative rounded-xl overflow-hidden bg-slate-950 border border-slate-800 shadow-inner ${className}`}>
      {/* Three.js Canvas Container */}
      <div
        ref={containerRef}
        className="w-full h-full cursor-grab active:cursor-grabbing select-none"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      />

      {/* Floating HUD: View Mode Controls */}
      <div className="absolute top-3 left-3 flex flex-wrap items-center gap-1.5 bg-slate-900/90 backdrop-blur-md p-1.5 rounded-lg border border-slate-700/60 shadow-lg text-xs z-10">
        <button
          type="button"
          onClick={setTopView}
          className={`px-2.5 py-1 rounded font-semibold transition-all ${
            activeSide === "top"
              ? "bg-blue-600 text-white shadow-sm"
              : "text-slate-300 hover:text-white hover:bg-slate-800"
          }`}
        >
          Top Layer
        </button>
        <button
          type="button"
          onClick={setBottomView}
          className={`px-2.5 py-1 rounded font-semibold transition-all ${
            activeSide === "bottom"
              ? "bg-blue-600 text-white shadow-sm"
              : "text-slate-300 hover:text-white hover:bg-slate-800"
          }`}
        >
          Bottom Layer
        </button>
        <button
          type="button"
          onClick={setIsometricView}
          className={`px-2.5 py-1 rounded font-semibold transition-all ${
            activeSide === "3d"
              ? "bg-blue-600 text-white shadow-sm"
              : "text-slate-300 hover:text-white hover:bg-slate-800"
          }`}
        >
          3D Solid
        </button>
      </div>

      {/* Floating Layer Visibility Toggles */}
      <div className="absolute top-3 right-3 flex items-center space-x-1.5 bg-slate-900/90 backdrop-blur-md p-1.5 rounded-lg border border-slate-700/60 shadow-lg text-xs z-10">
        <button
          type="button"
          title="Toggle Top Copper"
          onClick={() => setShowTopCopper(!showTopCopper)}
          className={`px-2 py-1 rounded text-[11px] font-bold transition-all ${
            showTopCopper
              ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
              : "text-slate-500 hover:bg-slate-800"
          }`}
        >
          Top Pads ({topPads.length})
        </button>
        <button
          type="button"
          title="Toggle Bottom Copper"
          onClick={() => setShowBottomCopper(!showBottomCopper)}
          className={`px-2 py-1 rounded text-[11px] font-bold transition-all ${
            showBottomCopper
              ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
              : "text-slate-500 hover:bg-slate-800"
          }`}
        >
          Bottom Pads ({bottomPads.length})
        </button>
        <button
          type="button"
          title="Toggle Plated Drills"
          onClick={() => setShowDrills(!showDrills)}
          className={`px-2 py-1 rounded text-[11px] font-bold transition-all ${
            showDrills
              ? "bg-blue-500/20 text-blue-300 border border-blue-500/40"
              : "text-slate-500 hover:bg-slate-800"
          }`}
        >
          Drills ({drills.length})
        </button>
      </div>

      {/* Bottom Floating Telemetry & Zoom Toolbar */}
      <div className="absolute bottom-3 inset-x-3 flex items-center justify-between pointer-events-none z-10">
        <div className="pointer-events-auto bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-700/60 shadow-lg text-[11px] font-mono text-slate-300 flex items-center space-x-3">
          <span className="text-blue-400 font-bold">
            {width_mm.toFixed(1)} × {length_mm.toFixed(1)} mm
          </span>
          <span className="text-slate-500">|</span>
          <span className="text-emerald-400 font-bold">
            {((width_mm * length_mm) / 100).toFixed(1)} cm²
          </span>
          <span className="text-slate-500">|</span>
          <span className="text-slate-400">
            FR-4 {thickness_mm}mm
          </span>
        </div>

        <div className="pointer-events-auto flex items-center space-x-1.5 bg-slate-900/90 backdrop-blur-md p-1 rounded-lg border border-slate-700/60 shadow-lg">
          <button
            type="button"
            onClick={() => handleZoom("in")}
            className="p-1.5 rounded text-slate-300 hover:text-white hover:bg-slate-800 transition-all"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => handleZoom("out")}
            className="p-1.5 rounded text-slate-300 hover:text-white hover:bg-slate-800 transition-all"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setWireframe(!wireframe)}
            className={`p-1.5 rounded transition-all ${
              wireframe ? "bg-blue-600 text-white" : "text-slate-300 hover:text-white hover:bg-slate-800"
            }`}
            title="Toggle Wireframe"
          >
            <Layers className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={setIsometricView}
            className="p-1.5 rounded text-slate-300 hover:text-white hover:bg-slate-800 transition-all"
            title="Reset Camera"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

