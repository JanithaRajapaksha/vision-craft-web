"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Layers,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Move,
  Info,
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
  topLayerImageBase64?: string;
  bottomLayerImageBase64?: string;
  outlineLayerImageBase64?: string;
  drillLayerImageBase64?: string;
  drillDrawingLayerImageBase64?: string;
  slotCount?: number;
  className?: string;
}

interface UploadedLayer {
  id: "bottom" | "top" | "outline" | "drill" | "drill_drawing";
  name: string;
  ext: string;
  color: string;
  order: number;
  imageBase64?: string;
}

export function PCBViewer({
  width_mm = 50,
  length_mm = 50,
  thickness_mm = 1.6,
  solderMaskColor = "Green",
  padFinish = "ENIG",
  drills = [],
  topPads = [],
  bottomPads = [],
  topLayerImageBase64,
  bottomLayerImageBase64,
  outlineLayerImageBase64,
  drillLayerImageBase64,
  drillDrawingLayerImageBase64,
  slotCount = 0,
  className = "w-full h-full min-h-[500px]",
}: PCBViewerProps) {
  // Dynamically compile ONLY layers that were actually uploaded
  const uploadedLayers: UploadedLayer[] = [];

  if (outlineLayerImageBase64) {
    uploadedLayers.push({
      id: "outline",
      name: "Board Outline",
      ext: ".GKO / .GM1",
      color: "#a855f7", // Purple
      order: 1,
      imageBase64: outlineLayerImageBase64,
    });
  }

  if (bottomLayerImageBase64) {
    uploadedLayers.push({
      id: "bottom",
      name: "Bottom Copper",
      ext: ".GBL",
      color: "#f59e0b", // Amber / Copper
      order: 2,
      imageBase64: bottomLayerImageBase64,
    });
  }

  if (topLayerImageBase64) {
    uploadedLayers.push({
      id: "top",
      name: "Top Copper",
      ext: ".GTL",
      color: "#ea580c", // Rich Copper
      order: 3,
      imageBase64: topLayerImageBase64,
    });
  }

  if (drillLayerImageBase64) {
    uploadedLayers.push({
      id: "drill",
      name: slotCount > 0 ? `Drill & Slots (${slotCount} slots)` : "Drill Holes (Excellon)",
      ext: ".DRL / .XLN",
      color: "#facc15", // High-contrast gold matching PyGerber v2 drill & slot routing
      order: 4,
      imageBase64: drillLayerImageBase64,
    });
  }

  if (drillDrawingLayerImageBase64) {
    uploadedLayers.push({
      id: "drill_drawing",
      name: "Drill Drawing",
      ext: ".GDD",
      color: "#38bdf8", // Sky blue
      order: 5,
      imageBase64: drillDrawingLayerImageBase64,
    });
  }

  // Sort by rendering stack order: outline -> bottom -> top -> drill -> drill_drawing
  uploadedLayers.sort((a, b) => a.order - b.order);

  // Independent Layer Visibility State (all visible by default)
  const [visibleLayers, setVisibleLayers] = useState<Record<string, boolean>>({
    outline: true,
    bottom: true,
    top: true,
    drill: true,
    drill_drawing: true,
  });

  const toggleLayer = (id: string) => {
    setVisibleLayers((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const setAllLayers = (visible: boolean) => {
    setVisibleLayers({
      outline: visible,
      bottom: visible,
      top: visible,
      drill: visible,
    });
  };

  // Pan & Zoom State (Natural 2D direct manipulation)
  const [zoom, setZoom] = useState(1.0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const handleResetView = () => {
    setZoom(1.0);
    setPan({ x: 0, y: 0 });
  };

  const handleZoom = (factor: number) => {
    setZoom((prev) => Math.max(0.25, Math.min(8.0, prev * factor)));
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
    setZoom((prev) => Math.max(0.25, Math.min(8.0, prev * zoomFactor)));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Left click only
    setIsDragging(true);
    dragStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Active images to render on composite canvas
  const activeImages = uploadedLayers.filter(
    (l) => visibleLayers[l.id] && Boolean(l.imageBase64)
  );

  const activeCount = uploadedLayers.filter((l) => visibleLayers[l.id]).length;

  return (
    <div
      ref={containerRef}
      className={`relative rounded-xl overflow-hidden bg-slate-950 border border-slate-800 shadow-inner select-none flex flex-col justify-between ${className}`}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Background Engineering Coordinate Grid */}
      <div
        className="absolute inset-0 opacity-20 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(to right, #3b82f6 1px, transparent 1px),
            linear-gradient(to bottom, #3b82f6 1px, transparent 1px)
          `,
          backgroundSize: "20px 20px",
        }}
      />

      {/* FLOATING LAYER LEGEND & VISIBILITY MANAGER (TOP-LEFT) */}
      {uploadedLayers.length > 0 && (
        <div
          className="absolute top-3 left-3 z-20 min-w-[210px] max-w-xs bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-xl shadow-2xl p-3 select-none pointer-events-auto"
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-slate-800">
            <div className="flex items-center space-x-1.5">
              <div className="p-1 rounded-md bg-blue-500/20 text-blue-400">
                <Layers className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-bold text-slate-200">Layer Legend</span>
            </div>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
              {activeCount}/{uploadedLayers.length} ON
            </span>
          </div>

          {/* List of uploaded layers ONLY */}
          <div className="space-y-1">
            {uploadedLayers.map((layer) => {
              const isVisible = visibleLayers[layer.id];
              return (
                <div
                  key={layer.id}
                  className={`flex items-center justify-between px-2 py-1.5 rounded-lg border transition-all text-xs ${
                    isVisible
                      ? "bg-slate-800/80 border-slate-700 text-white shadow-sm"
                      : "bg-slate-900/40 border-slate-800/60 text-slate-500 hover:bg-slate-800/40"
                  }`}
                >
                  <div className="flex items-center space-x-2 truncate mr-2">
                    {/* Glowing Color Indicator */}
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0 transition-opacity"
                      style={{
                        backgroundColor: layer.color,
                        opacity: isVisible ? 1 : 0.3,
                        boxShadow: isVisible ? `0 0 6px ${layer.color}90` : "none",
                      }}
                    />
                    <div className="truncate">
                      <span
                        className={`font-semibold text-[11px] block truncate ${
                          isVisible ? "text-slate-200" : "text-slate-500 line-through"
                        }`}
                      >
                        {layer.name}
                      </span>
                      <span className="text-[9px] font-mono text-slate-500 block">
                        {layer.ext}
                      </span>
                    </div>
                  </div>

                  {/* Toggle Show/Hide Button */}
                  <button
                    type="button"
                    onClick={() => toggleLayer(layer.id)}
                    className={`p-1 rounded-md transition-all cursor-pointer ${
                      isVisible
                        ? "text-blue-400 hover:text-white hover:bg-blue-600/30"
                        : "text-slate-500 hover:text-slate-300 hover:bg-slate-800"
                    }`}
                    title={isVisible ? `Hide ${layer.name}` : `Show ${layer.name}`}
                  >
                    {isVisible ? (
                      <Eye className="w-3.5 h-3.5" />
                    ) : (
                      <EyeOff className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Quick Controls if 2+ layers */}
          {uploadedLayers.length > 1 && (
            <div className="mt-2 pt-1.5 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-400">
              <button
                type="button"
                onClick={() => setAllLayers(true)}
                className="hover:text-blue-400 cursor-pointer font-medium"
              >
                Show All
              </button>
              <span className="text-slate-700">•</span>
              <button
                type="button"
                onClick={() => setAllLayers(false)}
                className="hover:text-rose-400 cursor-pointer font-medium"
              >
                Hide All
              </button>
            </div>
          )}
        </div>
      )}

      {/* TOP-RIGHT VIEW CONTROLS */}
      <div
        className="absolute top-3 right-3 z-20 flex items-center space-x-1.5 bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-xl p-1.5 shadow-2xl select-none pointer-events-auto"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => handleZoom(1.25)}
          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-all cursor-pointer"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => handleZoom(0.8)}
          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-all cursor-pointer"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={handleResetView}
          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-mono font-bold transition-all cursor-pointer flex items-center space-x-1"
          title="Fit View (100%)"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Fit</span>
        </button>
      </div>

      {/* MAIN 2D IMAGE CANVAS AREA */}
      <div className="relative flex-1 flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing">
        {uploadedLayers.length === 0 ? (
          /* Empty State when no PCB design is loaded */
          <div className="text-center p-8 max-w-md bg-slate-900/80 rounded-2xl border border-slate-800 shadow-xl space-y-3">
            <div className="w-12 h-12 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mx-auto">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">No PCB Layers Uploaded</h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Upload a Gerber ZIP package or individual .GBL/.GKO/.DRL files to inspect.
              </p>
            </div>
          </div>
        ) : activeImages.length === 0 ? (
          /* State when all layers are toggled off in the legend */
          <div className="text-center p-6 max-w-sm bg-slate-900/80 rounded-2xl border border-slate-800 shadow-xl space-y-2 pointer-events-auto">
            <div className="w-10 h-10 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
              <EyeOff className="w-5 h-5" />
            </div>
            <h3 className="text-xs font-bold text-white">All Layers Hidden</h3>
            <p className="text-[11px] text-slate-400">
              Click the eye icons in the Layer Legend on the left to show layers.
            </p>
            <button
              type="button"
              onClick={() => setAllLayers(true)}
              className="mt-2 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold cursor-pointer transition-all inline-block"
            >
              Show All Layers
            </button>
          </div>
        ) : (
          /* Composite Stacked Layer Canvas */
          <div
            className="relative transition-transform duration-75 ease-out select-none"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: "center center",
            }}
          >
            <div className="relative rounded-xl p-2 bg-slate-900/90 border border-slate-800 shadow-2xl backdrop-blur-sm">
              {/* Stack each visible layer image */}
              {activeImages.map((layer, idx) => (
                <img
                  key={layer.id}
                  src={layer.imageBase64}
                  alt={layer.name}
                  className={`${
                    idx === 0
                      ? "max-w-[85vw] max-h-[65vh] object-contain block select-none pointer-events-none"
                      : "absolute inset-2 w-[calc(100%-16px)] h-[calc(100%-16px)] object-contain select-none pointer-events-none"
                  }`}
                  draggable={false}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* BOTTOM FOOTER HUD: Live Dimensions, Layer Count & Pan Hint */}
      <div className="relative z-10 px-4 py-2.5 bg-slate-900/90 backdrop-blur-md border-t border-slate-800 flex flex-wrap items-center justify-between text-xs font-mono text-slate-400 gap-2">
        <div className="flex items-center space-x-3">
          <span className="flex items-center space-x-1.5 text-slate-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <strong>
              {uploadedLayers.length > 0
                ? `${activeCount} of ${uploadedLayers.length} Layers Active`
                : "No Layers"}
            </strong>
          </span>

          <span className="text-slate-600 hidden sm:inline">•</span>

          <span>
            Dimensions: <strong className="text-white">{width_mm} × {length_mm} mm</strong>
          </span>

          <span className="text-slate-600 hidden sm:inline">•</span>

          <span>
            Area: <strong className="text-purple-300">{Math.round((width_mm * length_mm) / 100 * 100) / 100} cm²</strong>
          </span>

          {drills.length > 0 && (
            <>
              <span className="text-slate-600 hidden sm:inline">•</span>
              <span>
                Holes: <strong className="text-emerald-400">{drills.length}</strong>
                {slotCount > 0 && (
                  <span className="text-amber-400 ml-1">({slotCount} slots)</span>
                )}
              </span>
            </>
          )}
        </div>

        <div className="flex items-center space-x-3 text-[11px]">
          <span>
            Zoom: <strong className="text-blue-400">{Math.round(zoom * 100)}%</strong>
          </span>
          <span className="text-slate-600">•</span>
          <span className="flex items-center space-x-1 text-slate-400">
            <Move className="w-3 h-3 text-slate-500" />
            <span>Click & Drag to Pan • Wheel to Zoom</span>
          </span>
        </div>
      </div>
    </div>
  );
}
