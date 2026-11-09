import React, { useState, useRef } from 'react';
import { Check, X } from 'lucide-react';

interface Region {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface RegionSelectorOverlayProps {
  isOpen: boolean;
  isMaximized?: boolean;
  onCancel: () => void;
  onConfirm: (region: Region) => void;
}

export const RegionSelectorOverlay: React.FC<RegionSelectorOverlayProps> = ({
  isOpen,
  isMaximized = false,
  onCancel,
  onConfirm,
}) => {
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [currentPoint, setCurrentPoint] = useState<{ x: number; y: number } | null>(null);
  const isDraggingRef = useRef(false);

  if (!isOpen) return null;

  const handleMouseDown = (e: React.MouseEvent) => {
    isDraggingRef.current = true;
    setStartPoint({ x: e.clientX, y: e.clientY });
    setCurrentPoint({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current) return;
    setCurrentPoint({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  let region: Region | null = null;
  if (startPoint && currentPoint) {
    const x = Math.min(startPoint.x, currentPoint.x);
    const y = Math.min(startPoint.y, currentPoint.y);
    const width = Math.abs(currentPoint.x - startPoint.x);
    const height = Math.abs(currentPoint.y - startPoint.y);
    if (width > 20 && height > 20) {
      region = { x, y, width, height };
    }
  }

  return (
    <div
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      className={`absolute inset-0 z-[100] bg-black/50 cursor-crosshair select-none flex flex-col justify-between font-sans overflow-hidden ${
        isMaximized ? 'rounded-none' : 'rounded-[20px]'
      }`}
    >
      {/* Top Banner Instructions & Presets */}
      <div
        onMouseDown={(e) => e.stopPropagation()}
        className="w-full py-2 bg-zinc-950/95 border-b border-zinc-800 text-center text-xs text-zinc-300 backdrop-blur-md flex items-center justify-between px-6 z-50"
      >
        <div className="flex items-center gap-3">
          <span className="font-semibold text-white">Select Region</span>
          <span className="text-zinc-500">•</span>
          <span className="text-zinc-400 text-[11px]">Click & drag on screen to define capture rectangle</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onConfirm({ x: 0, y: 0, width: 1920, height: 1080 })}
            className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[11px] font-medium transition-colors"
          >
            Full 1080p
          </button>
          <button
            type="button"
            onClick={() => onConfirm({ x: 100, y: 100, width: 1280, height: 720 })}
            className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[11px] font-medium transition-colors"
          >
            720p HD
          </button>
          <span className="text-zinc-600">|</span>
          <button
            type="button"
            onClick={onCancel}
            className="text-zinc-400 hover:text-white flex items-center gap-1 text-[11px] bg-zinc-800 hover:bg-red-500/20 hover:text-red-300 px-2.5 py-1 rounded transition-colors"
          >
            <X className="w-3 h-3" />
            <span>Cancel (ESC)</span>
          </button>
        </div>
      </div>

      {/* Selected Region Box */}
      {region && (
        <div
          className="absolute border-2 border-indigo-500 bg-indigo-500/15 pointer-events-none rounded-2xl shadow-2xl transition-all"
          style={{
            left: `${region.x}px`,
            top: `${region.y}px`,
            width: `${region.width}px`,
            height: `${region.height}px`,
          }}
        >
          {/* Dimension Tag */}
          <div className="absolute top-2.5 left-2.5 bg-zinc-900/90 text-white font-mono text-[10px] px-2.5 py-1 rounded-lg border border-zinc-700/80 shadow-md backdrop-blur-md">
            {region.width} × {region.height}
          </div>

          {/* Confirm Button */}
          <div
            onMouseDown={(e) => e.stopPropagation()}
            className="absolute -bottom-14 right-0 pointer-events-auto flex items-center gap-2 z-50"
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (region) onConfirm(region);
              }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs shadow-xl transition-transform hover:scale-105 active:scale-95 cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Record Region</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
