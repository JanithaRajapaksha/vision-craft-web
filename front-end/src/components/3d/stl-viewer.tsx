"use client";

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { Maximize2, Minimize2, RotateCcw, Eye } from "lucide-react";

interface STLViewerProps {
  file?: File | null;
  modelUrl?: string | null;
  color?: string;
  className?: string;
}

export function STLViewer({
  file,
  modelUrl,
  color = "#3b82f6", // VisionCraft blue
  className = "w-full h-full min-h-[500px]",
}: STLViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [wireframe, setWireframe] = useState(false);
  const [loading, setLoading] = useState(false);

  // References to Three.js objects
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const meshRef = useRef<THREE.Mesh | null>(null);
  const animationFrameId = useRef<number | null>(null);

  // Orbit controls state
  const isDragging = useRef(false);
  const previousMousePosition = useRef({ x: 0, y: 0 });
  const cameraDistance = useRef(150);
  const cameraAngles = useRef({ theta: Math.PI / 4, phi: Math.PI / 3 });

  // Initialize Three.js Scene
  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f172a); // Slate-900 dark backdrop
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(100, 100, 100);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    container.innerHTML = "";
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight1.position.set(150, 200, 150);
    dirLight1.castShadow = true;
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x93c5fd, 0.6); // Soft blue rim light
    dirLight2.position.set(-150, 100, -150);
    scene.add(dirLight2);

    // Build Plate Grid (220 x 220 mm FDM Bed)
    const bedSize = 220;
    const gridHelper = new THREE.GridHelper(bedSize, 22, 0x3b82f6, 0x334155);
    gridHelper.position.y = -0.1;
    scene.add(gridHelper);

    // Bed Border
    const bedGeom = new THREE.BoxGeometry(bedSize, 1, bedSize);
    const bedMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.8,
      metalness: 0.2,
    });
    const bedMesh = new THREE.Mesh(bedGeom, bedMat);
    bedMesh.position.y = -0.5;
    scene.add(bedMesh);

    // Render loop
    const render = () => {
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
      animationFrameId.current = requestAnimationFrame(render);
    };
    render();

    // Mouse Interaction for Orbiting
    const onMouseDown = (e: MouseEvent) => {
      isDragging.current = true;
      previousMousePosition.current = { x: e.clientX, y: e.clientY };
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const deltaX = e.clientX - previousMousePosition.current.x;
      const deltaY = e.clientY - previousMousePosition.current.y;
      previousMousePosition.current = { x: e.clientX, y: e.clientY };

      cameraAngles.current.theta -= deltaX * 0.01;
      cameraAngles.current.phi = Math.max(
        0.1,
        Math.min(Math.PI / 2 - 0.05, cameraAngles.current.phi - deltaY * 0.01)
      );

      updateCameraPosition();
    };

    const onMouseUp = () => {
      isDragging.current = false;
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      cameraDistance.current = Math.max(
        20,
        Math.min(500, cameraDistance.current + e.deltaY * 0.2)
      );
      updateCameraPosition();
    };

    const updateCameraPosition = () => {
      if (!cameraRef.current) return;
      const { theta, phi } = cameraAngles.current;
      const dist = cameraDistance.current;

      const x = dist * Math.sin(phi) * Math.sin(theta);
      const y = dist * Math.cos(phi);
      const z = dist * Math.sin(phi) * Math.cos(theta);

      cameraRef.current.position.set(x, y, z);
      cameraRef.current.lookAt(0, 10, 0);
    };

    updateCameraPosition();

    const domElement = renderer.domElement;
    domElement.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    domElement.addEventListener("wheel", onWheel, { passive: false });

    // Resize handler
    const handleResize = () => {
      if (!containerRef.current || !rendererRef.current || !cameraRef.current) return;
      const newWidth = containerRef.current.clientWidth;
      const newHeight = containerRef.current.clientHeight;
      if (newWidth === 0 || newHeight === 0) return;
      cameraRef.current.aspect = newWidth / newHeight;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(newWidth, newHeight);
    };
    window.addEventListener("resize", handleResize);

    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    resizeObserver.observe(container);

    return () => {
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
      resizeObserver.disconnect();
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      domElement.removeEventListener("mousedown", onMouseDown);
      domElement.removeEventListener("wheel", onWheel);
      renderer.dispose();
    };
  }, []);

  // Parse and display STL Mesh when file or modelUrl changes
  useEffect(() => {
    if (!sceneRef.current) return;

    const loadSTL = async () => {
      setLoading(true);
      let buffer: ArrayBuffer | null = null;

      try {
        if (file) {
          buffer = await file.arrayBuffer();
        } else if (modelUrl) {
          const res = await fetch(modelUrl);
          if (res.ok) {
            buffer = await res.arrayBuffer();
          }
        }

        if (!buffer || !sceneRef.current) return;

        // Remove previous mesh
        if (meshRef.current) {
          sceneRef.current.remove(meshRef.current);
          meshRef.current.geometry.dispose();
          meshRef.current = null;
        }

        // Parse STL Buffer into Three.js BufferGeometry
        const geometry = parseSTLBuffer(buffer);
        geometry.computeVertexNormals();

        // Center on FDM Bed
        geometry.computeBoundingBox();
        const bbox = geometry.boundingBox!;
        const centerX = (bbox.max.x + bbox.min.x) / 2;
        const centerY = (bbox.max.y + bbox.min.y) / 2;
        const minZ = bbox.min.z;

        // Reposition geometry so bottom sits on Z=0 bed
        geometry.translate(-centerX, -centerY, -minZ);

        // PLA+ Filament Material
        const material = new THREE.MeshStandardMaterial({
          color: new THREE.Color(color),
          roughness: 0.35,
          metalness: 0.1,
          wireframe: wireframe,
        });

        // Rotate so Z is up (STL default is Z up, Three.js is Y up)
        const mesh = new THREE.Mesh(geometry, material);
        mesh.rotation.x = -Math.PI / 2;
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        sceneRef.current.add(mesh);
        meshRef.current = mesh;

        // Auto-frame camera based on model size
        const size = new THREE.Vector3();
        bbox.getSize(size);
        const maxDim = Math.max(size.x, size.y, size.z, 20);
        cameraDistance.current = maxDim * 2.5;

        // Trigger camera update
        if (cameraRef.current) {
          const { theta, phi } = cameraAngles.current;
          const dist = cameraDistance.current;
          cameraRef.current.position.set(
            dist * Math.sin(phi) * Math.sin(theta),
            dist * Math.cos(phi),
            dist * Math.sin(phi) * Math.cos(theta)
          );
          cameraRef.current.lookAt(0, maxDim * 0.3, 0);
        }
      } catch (err) {
        console.error("Failed to render STL in 3D:", err);
      } finally {
        setLoading(false);
      }
    };

    loadSTL();
  }, [file, modelUrl, color]);

  // Update wireframe mode
  useEffect(() => {
    if (meshRef.current) {
      (meshRef.current.material as THREE.MeshStandardMaterial).wireframe = wireframe;
    }
  }, [wireframe]);

  // Reset Camera View
  const handleResetCamera = () => {
    cameraAngles.current = { theta: Math.PI / 4, phi: Math.PI / 3 };
    if (meshRef.current) {
      meshRef.current.geometry.computeBoundingBox();
      const size = new THREE.Vector3();
      meshRef.current.geometry.boundingBox?.getSize(size);
      const maxDim = Math.max(size.x, size.y, size.z, 20);
      cameraDistance.current = maxDim * 2.5;
    } else {
      cameraDistance.current = 150;
    }
    if (cameraRef.current) {
      const { theta, phi } = cameraAngles.current;
      const dist = cameraDistance.current;
      cameraRef.current.position.set(
        dist * Math.sin(phi) * Math.sin(theta),
        dist * Math.cos(phi),
        dist * Math.sin(phi) * Math.cos(theta)
      );
      cameraRef.current.lookAt(0, 10, 0);
    }
  };

  return (
    <div className={`relative rounded-xl overflow-hidden border border-slate-800 bg-slate-900 ${className}`}>
      {/* 3D Canvas Mount Point */}
      <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Floating 3D Controls */}
      <div className="absolute top-3 right-3 flex items-center space-x-1.5 bg-slate-800/80 backdrop-blur-sm p-1 rounded-lg border border-slate-700/60 text-slate-200">
        <button
          type="button"
          onClick={() => setWireframe(!wireframe)}
          title="Toggle Wireframe"
          className={`p-1.5 rounded hover:bg-slate-700 transition-colors cursor-pointer ${
            wireframe ? "text-blue-400 bg-slate-700 font-bold" : "text-slate-300"
          }`}
        >
          <Eye className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={handleResetCamera}
          title="Reset View"
          className="p-1.5 rounded hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      {/* 3D Bed Legend */}
      <div className="absolute bottom-3 left-3 bg-slate-800/80 backdrop-blur-sm px-2.5 py-1 rounded-md border border-slate-700/60 text-[10px] text-slate-300 flex items-center space-x-2">
        <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
        <span>Interactive 3D Bed (220×220mm) • Left Drag: Rotate • Scroll: Zoom</span>
      </div>

      {loading && (
        <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center text-white text-xs font-semibold">
          Rendering 3D Model...
        </div>
      )}
    </div>
  );
}

// In-browser Binary & ASCII STL Parser for Three.js BufferGeometry
function parseSTLBuffer(buffer: ArrayBuffer): THREE.BufferGeometry {
  const reader = new DataView(buffer);
  
  if (buffer.byteLength < 84) {
    return new THREE.BufferGeometry();
  }

  const triangleCount = reader.getUint32(80, true);
  const expectedBinaryLength = 84 + triangleCount * 50;

  // Determine if binary:
  // 1. If length matches expected binary length (or buffer has trailing bytes >= expected)
  // 2. And triangle count is positive and reasonable (< 50,000,000)
  let isBinary = false;
  if (triangleCount > 0 && buffer.byteLength >= expectedBinaryLength && triangleCount < 50000000) {
    // Check if it's binary by testing if bytes after header are valid floats or by checking ASCII markers
    isBinary = true;
  }

  // Double check if file is purely ASCII:
  // An ASCII STL has 'solid' and contains 'facet' in the first 500 bytes
  if (isBinary) {
    try {
      const headerSample = new TextDecoder().decode(new Uint8Array(buffer, 0, Math.min(500, buffer.byteLength)));
      if (headerSample.trim().startsWith("solid") && headerSample.includes("facet normal")) {
        isBinary = false;
      }
    } catch {
      isBinary = true;
    }
  }

  if (isBinary) {
    try {
      const vertices = new Float32Array(triangleCount * 9);
      let offset = 84;
      let vIndex = 0;

      for (let i = 0; i < triangleCount; i++) {
        if (offset + 50 > buffer.byteLength) break;
        offset += 12; // skip normal
        for (let j = 0; j < 3; j++) {
          vertices[vIndex++] = reader.getFloat32(offset, true);
          vertices[vIndex++] = reader.getFloat32(offset + 4, true);
          vertices[vIndex++] = reader.getFloat32(offset + 8, true);
          offset += 12;
        }
        offset += 2; // skip attribute byte count
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(vertices.subarray(0, vIndex), 3));
      return geometry;
    } catch (err) {
      console.warn("Binary STL parse error, attempting ASCII fallback", err);
    }
  }

  // Fallback to ASCII STL Parser
  try {
    const text = new TextDecoder().decode(buffer);
    const lines = text.split("\n");
    const vertexList: number[] = [];

    for (let line of lines) {
      line = line.trim();
      if (line.toLowerCase().startsWith("vertex")) {
        const parts = line.split(/\s+/);
        if (parts.length >= 4) {
          const x = parseFloat(parts[1]);
          const y = parseFloat(parts[2]);
          const z = parseFloat(parts[3]);
          if (!isNaN(x) && !isNaN(y) && !isNaN(z)) {
            vertexList.push(x, y, z);
          }
        }
      }
    }

    const geometry = new THREE.BufferGeometry();
    if (vertexList.length > 0) {
      geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(vertexList), 3));
    }
    return geometry;
  } catch (err) {
    console.error("Failed to parse STL as ASCII:", err);
    return new THREE.BufferGeometry();
  }
}

