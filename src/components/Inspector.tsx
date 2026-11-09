import React, { useState, useRef, useEffect } from 'react';
import {
  Image as ImageIcon,
  MousePointer,
  Aperture,
  Volume2,
  MessageSquare,
  ArrowUpCircle,
  EyeOff,
  Network,
  PanelLeftClose,
  Sparkles,
  ChevronDown,
  ChevronUp,
  SquareDashed,
  CircleDashed,
  Sun,
  Disc,
  Upload,
  Check,
} from 'lucide-react';
import type { ProjectState, ZoomKeyframe } from '../types/canvid';
import { CANVID_WALLPAPERS } from '../utils/wallpapers';
import { WINDOWS_ARROW_DATA_URL, MACOS_ARROW_DATA_URL } from '../utils/cursorAssets';

interface InspectorProps {
  project: ProjectState;
  updateProject: (updates: Partial<ProjectState>) => void;
  selectedZoom: ZoomKeyframe | null;
  updateSelectedZoom: (updates: Partial<ZoomKeyframe>) => void;
  onAutoGenerateZooms: () => void;
}

// 60FPS Zero-Lag Hardware Accelerated Smooth Slider matching Canvid
const SmoothSlider: React.FC<{
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (val: number) => void;
  cssVar?: string;
  className?: string;
}> = ({
  min,
  max,
  step = 1,
  value,
  onChange,
  cssVar,
}) => {
  const [localVal, setLocalVal] = useState(value);
  const throttleTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    setLocalVal(value);
    if (cssVar) {
      document.documentElement.style.setProperty(cssVar, `${value}px`);
    }
  }, [value, cssVar]);

  const handleInput = (e: React.FormEvent<HTMLInputElement>) => {
    const nextVal = parseFloat(e.currentTarget.value);
    setLocalVal(nextVal);

    if (cssVar) {
      document.documentElement.style.setProperty(cssVar, `${nextVal}px`);
    }

    if (throttleTimeoutRef.current === null) {
      throttleTimeoutRef.current = window.setTimeout(() => {
        onChange(nextVal);
        throttleTimeoutRef.current = null;
      }, 35);
    }
  };

  const handlePointerUp = () => {
    if (throttleTimeoutRef.current !== null) {
      clearTimeout(throttleTimeoutRef.current);
      throttleTimeoutRef.current = null;
    }
    onChange(localVal);
  };

  // Percentage for filled track
  const pct = Math.max(0, Math.min(100, ((localVal - min) / (max - min)) * 100));

  return (
    <div className="relative w-full flex items-center h-5 py-1">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={localVal}
        onInput={handleInput}
        onPointerUp={handlePointerUp}
        style={{
          background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${pct}%, #27272a ${pct}%, #27272a 100%)`,
        }}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer focus:outline-none focus:ring-0 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-zinc-200 [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:hover:scale-110 [&::-webkit-slider-thumb]:transition-transform"
      />
    </div>
  );
};

// Smooth Spring Dynamic Curve SVG Visualizer matching Canvid Screenshot 2 & 3
const SpringCurveGraph: React.FC<{ tension: number; friction: number }> = ({ tension, friction }) => {
  const points: string[] = [];
  const total = 50;
  const omega = Math.sqrt(Math.max(10, tension)) * 0.045;
  const zeta = Math.max(0.12, friction * 0.016);

  for (let i = 0; i <= total; i++) {
    const t = i / total;
    const val = 1 - Math.exp(-zeta * omega * i * 3.5) * Math.cos(omega * i * 3.5);
    const x = (t * 220).toFixed(1);
    const y = (38 - Math.max(0, Math.min(1.08, val)) * 32).toFixed(1);
    points.push(`${i === 0 ? 'M' : 'L'} ${x} ${y}`);
  }

  const pathD = points.join(' ');
  const areaD = `${pathD} L 220 44 L 0 44 Z`;

  return (
    <div className="w-full h-14 bg-[#111113] border border-zinc-800/80 rounded-xl overflow-hidden relative flex items-center justify-center shadow-inner">
      <svg className="w-full h-full" viewBox="0 0 220 44" preserveAspectRatio="none">
        <defs>
          <linearGradient id="canvidSpringGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0.0" />
          </linearGradient>
        </defs>
        <path d={areaD} fill="url(#canvidSpringGrad)" />
        <path d={pathD} fill="none" stroke="#d4d4d8" strokeWidth="1.75" strokeLinecap="round" />
      </svg>
    </div>
  );
};

// Canvid 14-Color Swatches Palette matching Image 3
const CANVID_COLOR_PALETTE = [
  '#09090b', // Black
  '#d1d5db', // Light Gray
  '#2563eb', // Royal Blue
  '#0d9488', // Teal
  '#0284c7', // Sky / Slate Blue
  '#16a34a', // Emerald Green
  '#65a30d', // Olive Green
  '#eab308', // Gold / Amber
  '#b45309', // Bronze / Brown
  '#ea580c', // Terracotta / Orange
  '#dc2626', // Crimson Red
  '#db2777', // Mauve / Rose
  '#9333ea', // Purple
  '#4f46e5', // Deep Indigo
];

export const Inspector: React.FC<InspectorProps> = React.memo(({
  project,
  updateProject,
  selectedZoom: _selectedZoom,
  updateSelectedZoom: _updateSelectedZoom,
  onAutoGenerateZooms: _onAutoGenerateZooms,
}) => {
  // 8 Exact Tabs matching Canvid Left Rail
  const [activeTab, setActiveTab] = useState<
    'background' | 'cursor' | 'webcam' | 'captions' | 'audio' | 'export' | 'visibility' | 'physics'
  >('background');

  const [wallpaperCategory, setWallpaperCategory] = useState<'canvid' | 'system'>('system');
  const [bgSubTab, setBgSubTab] = useState<'wallpaper' | 'image' | 'gradient' | 'color'>('color');
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);

  // Accordion Expander States
  const [isCursorCustomOpen, setIsCursorCustomOpen] = useState(true);
  const [isZoomCustomOpen, setIsZoomCustomOpen] = useState(true);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredWallpapers = CANVID_WALLPAPERS.filter((w) =>
    wallpaperCategory === 'system' ? (w.category === 'windows' || w.category === 'mac') : w.category === 'canvid'
  );

  const handleCustomImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    updateProject({
      background: { type: 'image', value: url },
    });
  };

  return (
    <div className="flex h-full rounded-2xl border border-zinc-800/80 bg-[#0c0c0e] text-zinc-200 select-none font-sans z-20 overflow-hidden shadow-xl shrink-0">
      {/* 1. Left Vertical Icon Strip: EXACT 8 ICONS IN ORDER + BOTTOM COLLAPSE */}
      <div className="w-13 border-r border-zinc-800/80 bg-[#09090c] flex flex-col items-center justify-between py-3">
        {/* Top 8 Icons */}
        <div className="flex flex-col items-center gap-3">
          {/* Icon 1: Wallpaper & Background */}
          <button
            onClick={() => {
              setActiveTab('background');
              setIsCollapsed(false);
            }}
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
              activeTab === 'background' && !isCollapsed
                ? 'bg-zinc-800 text-white shadow-sm'
                : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/60'
            }`}
            title="Background"
          >
            <ImageIcon className="w-4 h-4 stroke-[1.8]" />
          </button>

          {/* Icon 2: Cursor */}
          <button
            onClick={() => {
              setActiveTab('cursor');
              setIsCollapsed(false);
            }}
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
              activeTab === 'cursor' && !isCollapsed
                ? 'bg-zinc-800 text-white shadow-sm'
                : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/60'
            }`}
            title="Cursor"
          >
            <MousePointer className="w-4 h-4 stroke-[1.8]" />
          </button>

          {/* Icon 3: Webcam Aperture */}
          <button
            onClick={() => {
              setActiveTab('webcam');
              setIsCollapsed(false);
            }}
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
              activeTab === 'webcam' && !isCollapsed
                ? 'bg-zinc-800 text-white shadow-sm'
                : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/60'
            }`}
            title="Webcam"
          >
            <Aperture className="w-4 h-4 stroke-[1.8]" />
          </button>

          {/* Icon 4: Captions Speech Bubble */}
          <button
            onClick={() => {
              setActiveTab('captions');
              setIsCollapsed(false);
            }}
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
              activeTab === 'captions' && !isCollapsed
                ? 'bg-zinc-800 text-white shadow-sm'
                : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/60'
            }`}
            title="Captions"
          >
            <MessageSquare className="w-4 h-4 stroke-[1.8]" />
          </button>

          {/* Icon 5: Audio Volume */}
          <button
            onClick={() => {
              setActiveTab('audio');
              setIsCollapsed(false);
            }}
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
              activeTab === 'audio' && !isCollapsed
                ? 'bg-zinc-800 text-white shadow-sm'
                : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/60'
            }`}
            title="Audio"
          >
            <Volume2 className="w-4 h-4 stroke-[1.8]" />
          </button>

          {/* Icon 6: Export / Upload Arrow In Circle */}
          <button
            onClick={() => {
              setActiveTab('export');
              setIsCollapsed(false);
            }}
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
              activeTab === 'export' && !isCollapsed
                ? 'bg-zinc-800 text-white shadow-sm'
                : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/60'
            }`}
            title="Export"
          >
            <ArrowUpCircle className="w-4 h-4 stroke-[1.8]" />
          </button>

          {/* Icon 7: Eye Off / Visibility */}
          <button
            onClick={() => {
              setActiveTab('visibility');
              setIsCollapsed(false);
            }}
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
              activeTab === 'visibility' && !isCollapsed
                ? 'bg-zinc-800 text-white shadow-sm'
                : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/60'
            }`}
            title="Visibility"
          >
            <EyeOff className="w-4 h-4 stroke-[1.8]" />
          </button>

          {/* Icon 8: Connected Nodes / Motion Blur & Zoom Physics */}
          <button
            onClick={() => {
              setActiveTab('physics');
              setIsCollapsed(false);
            }}
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
              activeTab === 'physics' && !isCollapsed
                ? 'bg-zinc-800 text-white shadow-sm'
                : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/60'
            }`}
            title="Motion Blur & Zoom Physics"
          >
            <Network className="w-4 h-4 stroke-[1.8]" />
          </button>
        </div>

        {/* Bottom Rail: Panel Collapse Toggle */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/60 transition-colors"
          title={isCollapsed ? 'Expand Panel' : 'Collapse Panel'}
        >
          <PanelLeftClose className={`w-4 h-4 transition-transform ${isCollapsed ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* 2. Main Inspector Options Panel: Smooth Animated Sliding Container */}
      <div
        className={`transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] flex flex-col custom-scrollbar text-xs bg-[#0c0c0e] ${
          isCollapsed ? 'w-0 opacity-0 pointer-events-none p-0 overflow-hidden' : 'w-76 opacity-100 p-4 gap-4 overflow-y-auto'
        }`}
      >
          {/* TAB 1: BACKGROUND (Matching Image 3) */}
          {activeTab === 'background' && (
            <>
              {/* Header Title */}
              <div className="flex items-center gap-2 text-zinc-100">
                <ImageIcon className="w-4 h-4 text-zinc-400 stroke-[1.8]" />
                <span className="font-semibold text-sm">Background</span>
              </div>

              {/* Sub-Tabs Capsule Bar: Wallpaper | Image | Gradient | Color */}
              <div className="grid grid-cols-4 bg-[#141417] border border-zinc-800/80 rounded-xl p-1 text-center font-medium shadow-inner">
                {(['wallpaper', 'image', 'gradient', 'color'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setBgSubTab(t)}
                    className={`py-1 rounded-lg capitalize text-[11px] transition-all ${
                      bgSubTab === t
                        ? 'bg-zinc-800 text-white font-semibold shadow-sm'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>

              {/* SUBTAB 1A: COLOR (Image 3 exact reference) */}
              {bgSubTab === 'color' && (
                <div className="bg-[#121215] border border-zinc-800/80 rounded-2xl p-3.5 flex flex-col gap-3.5 shadow-sm">
                  {/* 14 Circular Color Swatches (2 rows of 7) */}
                  <div className="grid grid-cols-7 gap-2.5 px-0.5 py-0.5">
                    {CANVID_COLOR_PALETTE.map((col) => {
                      const isSelected = project.background.type === 'color' && project.background.value.toLowerCase() === col.toLowerCase();
                      return (
                        <button
                          key={col}
                          onClick={() =>
                            updateProject({
                              background: { type: 'color', value: col },
                            })
                          }
                          className={`w-6 h-6 rounded-full transition-transform relative ${
                            isSelected ? 'ring-2 ring-blue-500 scale-110 shadow-md' : 'hover:scale-110'
                          }`}
                          style={{ backgroundColor: col }}
                          title={col}
                        >
                          {isSelected && (
                            <span className="absolute inset-0 flex items-center justify-center">
                              <Check className="w-3 h-3 text-white drop-shadow" />
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Hex Color Input Pill (Image 3: #000000) */}
                  <div className="flex items-center gap-2.5 bg-[#18181c] border border-zinc-800/90 rounded-xl px-3 py-2 shadow-inner">
                    <div
                      className="w-4 h-4 rounded-full border border-zinc-700/60 shrink-0 shadow-inner"
                      style={{
                        backgroundColor:
                          project.background.type === 'color'
                            ? project.background.value
                            : '#000000',
                      }}
                    />
                    <input
                      type="text"
                      value={
                        project.background.type === 'color'
                          ? project.background.value.replace('#', '').toUpperCase()
                          : '000000'
                      }
                      onChange={(e) => {
                        const val = `#${e.target.value.replace('#', '')}`;
                        updateProject({
                          background: { type: 'color', value: val },
                        });
                      }}
                      className="bg-transparent text-xs font-mono font-medium text-zinc-200 focus:outline-none w-full tracking-wider"
                      placeholder="000000"
                    />
                  </div>
                </div>
              )}

              {/* SUBTAB 1B: WALLPAPER */}
              {bgSubTab === 'wallpaper' && (
                <div className="bg-[#121215] border border-zinc-800/80 rounded-2xl p-3.5 flex flex-col gap-3.5 shadow-sm">
                  <div className="flex items-center gap-1.5 text-zinc-300 font-medium">
                    <ImageIcon className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Wallpaper</span>
                  </div>

                  {/* Canvid vs Windows and macOS */}
                  <div className="grid grid-cols-2 bg-[#16161a] border border-zinc-800/80 rounded-lg p-0.5 text-center font-medium">
                    <button
                      onClick={() => setWallpaperCategory('canvid')}
                      className={`py-1 rounded-md text-[11px] transition-colors ${
                        wallpaperCategory === 'canvid' ? 'bg-zinc-800 text-white font-semibold' : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      Canvid
                    </button>
                    <button
                      onClick={() => setWallpaperCategory('system')}
                      className={`py-1 rounded-md text-[11px] transition-colors ${
                        wallpaperCategory === 'system' ? 'bg-zinc-800 text-white font-semibold' : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      Windows and macOS
                    </button>
                  </div>

                  {/* 2x7 Wallpaper Grid */}
                  <div className="grid grid-cols-7 gap-1.5 p-0.5 max-h-44 overflow-y-auto custom-scrollbar">
                    {filteredWallpapers.slice(0, 28).map((wp) => (
                      <button
                        key={wp.id}
                        onClick={() =>
                          updateProject({
                            background: { type: 'image', value: wp.fullUrl },
                          })
                        }
                        className={`group relative aspect-square rounded-md overflow-hidden border transition-all ${
                          project.background.value === wp.fullUrl
                            ? 'border-blue-500 ring-2 ring-blue-500/50 scale-95'
                            : 'border-zinc-800/80 hover:border-zinc-600'
                        }`}
                        title={wp.name}
                      >
                        <img
                          src={wp.thumbnailUrl || wp.fullUrl}
                          alt={wp.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                          loading="lazy"
                        />
                      </button>
                    ))}
                  </div>

                  {/* Background Blur */}
                  <div className="flex flex-col gap-1 pt-2 border-t border-zinc-800/80">
                    <div className="flex items-center justify-between text-zinc-300">
                      <div className="flex items-center gap-1.5">
                        <Disc className="w-3.5 h-3.5 text-zinc-400" />
                        <span className="font-medium text-xs">Background blur</span>
                      </div>
                      <button
                        onClick={() => {
                          document.documentElement.style.setProperty('--canvid-bg-blur', '0px');
                          updateProject({ backgroundBlur: 0 });
                        }}
                        className="text-zinc-500 hover:text-zinc-300 text-[11px] font-medium"
                      >
                        Reset
                      </button>
                    </div>
                    <SmoothSlider
                      min={0}
                      max={60}
                      value={project.backgroundBlur ?? 0}
                      cssVar="--canvid-bg-blur"
                      onChange={(val) => updateProject({ backgroundBlur: val })}
                    />
                  </div>
                </div>
              )}

              {/* SUBTAB 1C: IMAGE */}
              {bgSubTab === 'image' && (
                <div className="bg-[#121215] border border-zinc-800/80 rounded-2xl p-3.5 flex flex-col gap-3.5 shadow-sm">
                  <div className="flex items-center gap-1.5 text-zinc-300 font-medium">
                    <ImageIcon className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Background Image</span>
                  </div>

                  {/* Dropzone */}
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border border-dashed border-zinc-800 hover:border-zinc-700 bg-[#16161a] rounded-xl p-5 flex flex-col items-center justify-center text-center cursor-pointer transition-colors group"
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/avif"
                      onChange={handleCustomImageUpload}
                      className="hidden"
                    />
                    <span className="text-zinc-300 font-semibold text-xs mb-1">
                      Drop an image here
                    </span>
                    <span className="text-zinc-500 text-[11px] mb-3">
                      PNG or JPG · 10MB max
                    </span>
                    <button
                      type="button"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs shadow transition-colors"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Choose image</span>
                    </button>
                  </div>

                  {/* Background Blur */}
                  <div className="flex flex-col gap-1 pt-2 border-t border-zinc-800/80">
                    <div className="flex items-center justify-between text-zinc-300">
                      <div className="flex items-center gap-1.5">
                        <Disc className="w-3.5 h-3.5 text-zinc-400" />
                        <span className="font-medium text-xs">Background blur</span>
                      </div>
                      <button
                        onClick={() => {
                          document.documentElement.style.setProperty('--canvid-bg-blur', '0px');
                          updateProject({ backgroundBlur: 0 });
                        }}
                        className="text-zinc-500 hover:text-zinc-300 text-[11px] font-medium"
                      >
                        Reset
                      </button>
                    </div>
                    <SmoothSlider
                      min={0}
                      max={60}
                      value={project.backgroundBlur ?? 0}
                      cssVar="--canvid-bg-blur"
                      onChange={(val) => updateProject({ backgroundBlur: val })}
                    />
                  </div>
                </div>
              )}

              {/* SUBTAB 1D: GRADIENT */}
              {bgSubTab === 'gradient' && (
                <div className="bg-[#121215] border border-zinc-800/80 rounded-2xl p-3.5 flex flex-col gap-3.5 shadow-sm">
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      'linear-gradient(135deg, #1e1e24 0%, #0d0d11 100%)',
                      'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                      'linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%)',
                      'linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)',
                      'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                      'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                    ].map((grad, i) => (
                      <button
                        key={i}
                        onClick={() =>
                          updateProject({
                            background: { type: 'gradient', value: grad },
                          })
                        }
                        className="aspect-video rounded-lg border border-zinc-800 hover:scale-105 transition-transform"
                        style={{ background: grad }}
                      />
                    ))}
                  </div>

                  {/* Background Blur */}
                  <div className="flex flex-col gap-1 pt-2 border-t border-zinc-800/80">
                    <div className="flex items-center justify-between text-zinc-300">
                      <div className="flex items-center gap-1.5">
                        <Disc className="w-3.5 h-3.5 text-zinc-400" />
                        <span className="font-medium text-xs">Background blur</span>
                      </div>
                      <button
                        onClick={() => {
                          document.documentElement.style.setProperty('--canvid-bg-blur', '0px');
                          updateProject({ backgroundBlur: 0 });
                        }}
                        className="text-zinc-500 hover:text-zinc-300 text-[11px] font-medium"
                      >
                        Reset
                      </button>
                    </div>
                    <SmoothSlider
                      min={0}
                      max={60}
                      value={project.backgroundBlur ?? 0}
                      cssVar="--canvid-bg-blur"
                      onChange={(val) => updateProject({ backgroundBlur: val })}
                    />
                  </div>
                </div>
              )}

              {/* SHAPE SECTION: Clean Modular Card Container (Image 3) */}
              <div className="flex flex-col gap-2 pt-1">
                <span className="font-semibold text-zinc-400 text-xs pl-1">Shape</span>

                <div className="bg-[#121215] border border-zinc-800/80 rounded-2xl p-3.5 flex flex-col gap-4 shadow-sm">
                  {/* Padding */}
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-zinc-300">
                      <div className="flex items-center gap-1.5">
                        <SquareDashed className="w-3.5 h-3.5 text-zinc-400" />
                        <span className="font-medium">Padding</span>
                      </div>
                      <button
                        onClick={() => {
                          document.documentElement.style.setProperty('--canvid-padding', '8px');
                          updateProject({ padding: 8 });
                        }}
                        className="text-zinc-500 hover:text-zinc-300 text-[11px] font-medium"
                      >
                        Reset
                      </button>
                    </div>
                    <SmoothSlider
                      min={0}
                      max={24}
                      value={project.padding}
                      cssVar="--canvid-padding"
                      onChange={(val) => updateProject({ padding: val })}
                    />
                  </div>

                  {/* Rounded Corners */}
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-zinc-300">
                      <div className="flex items-center gap-1.5">
                        <CircleDashed className="w-3.5 h-3.5 text-zinc-400" />
                        <span className="font-medium">Rounded Corners</span>
                      </div>
                      <button
                        onClick={() => {
                          document.documentElement.style.setProperty('--canvid-radius', '12px');
                          updateProject({ radius: 12 });
                        }}
                        className="text-zinc-500 hover:text-zinc-300 text-[11px] font-medium"
                      >
                        Reset
                      </button>
                    </div>
                    <SmoothSlider
                      min={0}
                      max={36}
                      value={project.radius}
                      cssVar="--canvid-radius"
                      onChange={(val) => updateProject({ radius: val })}
                    />
                  </div>

                  {/* Shadows */}
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-zinc-300">
                      <div className="flex items-center gap-1.5">
                        <Sun className="w-3.5 h-3.5 text-zinc-400" />
                        <span className="font-medium">Shadows</span>
                      </div>
                      <button
                        onClick={() => {
                          document.documentElement.style.setProperty('--canvid-shadow-blur', '35px');
                          updateProject({ shadowBlur: 35, shadowEnabled: true });
                        }}
                        className="text-zinc-500 hover:text-zinc-300 text-[11px] font-medium"
                      >
                        Reset
                      </button>
                    </div>
                    <SmoothSlider
                      min={0}
                      max={60}
                      value={project.shadowBlur}
                      cssVar="--canvid-shadow-blur"
                      onChange={(val) => updateProject({ shadowBlur: val })}
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          {/* TAB 2: CURSOR (Screenshot 2) */}
          {activeTab === 'cursor' && (
            <div className="flex flex-col gap-3.5">
              {/* Show Cursor Card */}
              <div className="bg-[#121215] border border-zinc-800/80 rounded-2xl p-3.5 flex items-center justify-between shadow-sm">
                <span className="font-semibold text-zinc-100 text-sm">Show Cursor</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={project.cursor.visible}
                    onChange={(e) =>
                      updateProject({
                        cursor: { ...project.cursor, visible: e.target.checked },
                      })
                    }
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              {/* Cursor Size Card */}
              <div className="bg-[#121215] border border-zinc-800/80 rounded-2xl p-3.5 flex flex-col gap-1 shadow-sm">
                <div className="flex items-center justify-between text-zinc-300">
                  <div className="flex items-center gap-1.5">
                    <MousePointer className="w-3.5 h-3.5 text-zinc-400" />
                    <span className="font-medium">Cursor Size</span>
                  </div>
                  <button
                    onClick={() =>
                      updateProject({
                        cursor: { ...project.cursor, scale: 1.4 },
                      })
                    }
                    className="text-zinc-500 hover:text-zinc-300 text-[11px] font-medium"
                  >
                    Reset
                  </button>
                </div>
                <SmoothSlider
                  min={0.8}
                  max={3.0}
                  step={0.1}
                  value={project.cursor.scale || 1.4}
                  onChange={(val) =>
                    updateProject({
                      cursor: { ...project.cursor, scale: val },
                    })
                  }
                />
              </div>

              {/* Cursor Style Card */}
              <div className="bg-[#121215] border border-zinc-800/80 rounded-2xl p-3.5 flex flex-col gap-2.5 shadow-sm">
                <div className="flex items-center gap-1.5 text-zinc-300 font-medium">
                  <MousePointer className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Cursor Style</span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    {
                      id: 'windows',
                      name: 'Windows',
                      icon: (
                        <img
                          src={WINDOWS_ARROW_DATA_URL}
                          alt="Windows"
                          className="w-4 h-4 mx-auto object-contain select-none filter drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]"
                          draggable={false}
                        />
                      ),
                    },
                    {
                      id: 'mac',
                      name: 'Mac',
                      icon: (
                        <img
                          src={MACOS_ARROW_DATA_URL}
                          alt="Mac"
                          className="w-4 h-4 mx-auto object-contain select-none filter drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]"
                          draggable={false}
                        />
                      ),
                    },
                    {
                      id: 'touch',
                      name: 'Touch',
                      icon: (
                        <div className="w-4 h-4 rounded-full bg-zinc-400 mx-auto my-0.5 border border-white" />
                      ),
                    },
                    {
                      id: 'recorded',
                      name: 'Recorded',
                      icon: (
                        <svg className="w-5 h-5 mx-auto" viewBox="0 0 24 24" fill="none">
                          <path d="M4 3L11.5 20.5L14.2 13.8L21 11L4 3Z" stroke="#94B8FF" strokeWidth="1.8" />
                        </svg>
                      ),
                    },
                  ].map((th) => (
                    <button
                      key={th.id}
                      onClick={() =>
                        updateProject({
                          cursor: { ...project.cursor, theme: th.id as any },
                        })
                      }
                      className={`py-2 px-1 flex flex-col items-center gap-1.5 rounded-xl border transition-all ${
                        project.cursor.theme === th.id
                          ? 'bg-zinc-800/95 border-blue-500 text-white shadow-sm'
                          : 'bg-[#18181c] border-zinc-800/90 text-zinc-400 hover:border-zinc-700'
                      }`}
                    >
                      {th.icon}
                      <span className="text-[10px] font-medium">{th.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Behavior & Effects Card */}
              <div className="bg-[#121215] border border-zinc-800/80 rounded-2xl p-3.5 flex flex-col gap-3 shadow-sm">
                {/* Always use default cursor */}
                <div className="flex items-center justify-between">
                  <div className="flex flex-col pr-2">
                    <span className="text-zinc-200 font-medium">Always use default cursor</span>
                    <span className="text-[11px] text-zinc-500">Ignore recorded pointer roles.</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={project.cursor.alwaysDefault ?? false}
                      onChange={(e) =>
                        updateProject({
                          cursor: { ...project.cursor, alwaysDefault: e.target.checked },
                        })
                      }
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                {/* Click Effect (None, Ripple) */}
                <div className="flex flex-col gap-1.5 pt-2 border-t border-zinc-800/80">
                  <div className="flex items-center gap-1.5 text-zinc-300 font-medium">
                    <Sparkles className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Click Effect</span>
                  </div>
                  <div className="grid grid-cols-2 bg-[#18181c] border border-zinc-800/80 rounded-xl p-1 text-center">
                    {(['none', 'ripple'] as const).map((eff) => (
                      <button
                        key={eff}
                        onClick={() =>
                          updateProject({
                            cursor: { ...project.cursor, clickEffect: eff },
                          })
                        }
                        className={`py-1.5 rounded-lg capitalize font-medium text-xs transition-colors ${
                          (project.cursor.clickEffect === eff || (eff === 'none' && project.cursor.clickEffect === 'none'))
                            ? 'bg-zinc-800 text-white shadow-sm font-semibold'
                            : 'text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        {eff === 'none' ? 'None' : 'Ripple'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tilt cursor with movement */}
                <div className="flex items-center justify-between pt-1">
                  <span className="text-zinc-200 font-medium">Tilt cursor with movement</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={project.cursor.tilt}
                      onChange={(e) =>
                        updateProject({
                          cursor: { ...project.cursor, tilt: e.target.checked },
                        })
                      }
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                {/* Cursor movement smoothing */}
                <div className="flex items-center justify-between pt-1">
                  <span className="text-zinc-200 font-medium">Cursor movement smoothing</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={project.cursor.smoothing}
                      onChange={(e) =>
                        updateProject({
                          cursor: { ...project.cursor, smoothing: e.target.checked },
                        })
                      }
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
              </div>

              {/* Animation Style & Spring Physics Card */}
              <div className="bg-[#121215] border border-zinc-800/80 rounded-2xl p-3.5 flex flex-col gap-3 shadow-sm">
                <span className="text-zinc-300 font-medium">Cursor movement animation style</span>
                <div className="grid grid-cols-4 bg-[#18181c] border border-zinc-800/80 rounded-xl p-1 text-center font-medium">
                  {(['molasses', 'default', 'gentle', 'stiff'] as const).map((style) => (
                    <button
                      key={style}
                      onClick={() => {
                        const presets: Record<string, [number, number]> = {
                          molasses: [180, 100],
                          default: [470, 70],
                          gentle: [320, 80],
                          stiff: [600, 50],
                        };
                        const [t, f] = presets[style] || [470, 70];
                        updateProject({
                          cursor: {
                            ...project.cursor,
                            animationStyle: style,
                            tension: t,
                            friction: f,
                          },
                        });
                      }}
                      className={`py-1 rounded-lg capitalize text-[11px] transition-colors ${
                        (project.cursor.animationStyle || 'default') === style
                          ? 'bg-zinc-800 text-white shadow-sm font-semibold'
                          : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      {style}
                    </button>
                  ))}
                </div>

                {/* Customize Expander */}
                <button
                  onClick={() => setIsCursorCustomOpen(!isCursorCustomOpen)}
                  className="flex items-center justify-between text-zinc-300 hover:text-white transition-colors py-1"
                >
                  <span className="font-medium">Customize</span>
                  {isCursorCustomOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>

                {isCursorCustomOpen && (
                  <div className="flex flex-col gap-3 pt-1 border-t border-zinc-800/80">
                    <SpringCurveGraph
                      tension={project.cursor.tension ?? 470}
                      friction={project.cursor.friction ?? 70}
                    />

                    {/* Tension */}
                    <div className="flex flex-col gap-1">
                      <span className="text-zinc-200 font-medium">Tension</span>
                      <span className="text-[11px] text-zinc-500">
                        Higher tension contracts more powerfully for snappier movement.
                      </span>
                      <SmoothSlider
                        min={100}
                        max={700}
                        value={project.cursor.tension ?? 470}
                        onChange={(val) =>
                          updateProject({
                            cursor: { ...project.cursor, tension: val },
                          })
                        }
                      />
                    </div>

                    {/* Friction */}
                    <div className="flex flex-col gap-1">
                      <span className="text-zinc-200 font-medium">Friction</span>
                      <span className="text-[11px] text-zinc-500">
                        The higher the friction, the slower the animation will be.
                      </span>
                      <SmoothSlider
                        min={10}
                        max={150}
                        value={project.cursor.friction ?? 70}
                        onChange={(val) =>
                          updateProject({
                            cursor: { ...project.cursor, friction: val },
                          })
                        }
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 8: MOTION BLUR & ZOOM PHYSICS (Screenshot 3) */}
          {activeTab === 'physics' && (
            <div className="flex flex-col gap-3.5">
              {/* Motion Blur Card */}
              <div className="bg-[#121215] border border-zinc-800/80 rounded-2xl p-3.5 flex flex-col gap-2 shadow-sm">
                <span className="font-semibold text-zinc-100 text-sm">Motion Blur</span>
                <div className="flex items-center justify-between pt-1">
                  <div className="flex flex-col pr-2">
                    <span className="text-zinc-200 font-medium">Enable Motion Blur</span>
                    <span className="text-[11px] text-zinc-500">
                      Apply motion blur effect while mouse cursor or screen is moving
                    </span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={project.cursor.motionBlur ?? true}
                      onChange={(e) =>
                        updateProject({
                          cursor: { ...project.cursor, motionBlur: e.target.checked },
                        })
                      }
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
              </div>

              {/* Zoom Physics Card */}
              <div className="bg-[#121215] border border-zinc-800/80 rounded-2xl p-3.5 flex flex-col gap-3 shadow-sm">
                <span className="font-semibold text-zinc-100 text-sm">Zoom</span>

                <div className="flex flex-col gap-1.5">
                  <span className="text-zinc-300 font-medium">Zoom movement animation style</span>
                  <div className="grid grid-cols-4 bg-[#18181c] border border-zinc-800/80 rounded-xl p-1 text-center font-medium">
                    {(['molasses', 'default', 'gentle', 'stiff'] as const).map((style) => (
                      <button
                        key={style}
                        onClick={() => {
                          const presets: Record<string, [number, number]> = {
                            molasses: [140, 160],
                            default: [280, 120],
                            gentle: [220, 140],
                            stiff: [420, 90],
                          };
                          const [t, f] = presets[style] || [280, 120];
                          updateProject({
                            zoomConfig: {
                              motionBlur: project.zoomConfig?.motionBlur ?? true,
                              animationStyle: style,
                              tension: t,
                              friction: f,
                            },
                          });
                        }}
                        className={`py-1 rounded-lg capitalize text-[11px] transition-colors ${
                          (project.zoomConfig?.animationStyle || 'default') === style
                            ? 'bg-zinc-800 text-white shadow-sm font-semibold'
                            : 'text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        {style}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Customize Accordion for Zoom */}
                <button
                  onClick={() => setIsZoomCustomOpen(!isZoomCustomOpen)}
                  className="flex items-center justify-between text-zinc-300 hover:text-white transition-colors py-1"
                >
                  <span className="font-medium">Customize</span>
                  {isZoomCustomOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>

                {isZoomCustomOpen && (
                  <div className="flex flex-col gap-3 pt-1 border-t border-zinc-800/80">
                    <SpringCurveGraph
                      tension={project.zoomConfig?.tension ?? 280}
                      friction={project.zoomConfig?.friction ?? 120}
                    />

                    {/* Tension */}
                    <div className="flex flex-col gap-1">
                      <span className="text-zinc-200 font-medium">Tension</span>
                      <span className="text-[11px] text-zinc-500">
                        Higher tension contracts more powerfully for snappy movement.
                      </span>
                      <SmoothSlider
                        min={100}
                        max={500}
                        value={project.zoomConfig?.tension ?? 280}
                        onChange={(val) =>
                          updateProject({
                            zoomConfig: {
                              motionBlur: project.zoomConfig?.motionBlur ?? true,
                              animationStyle: project.zoomConfig?.animationStyle ?? 'default',
                              tension: val,
                              friction: project.zoomConfig?.friction ?? 120,
                            },
                          })
                        }
                      />
                    </div>

                    {/* Friction */}
                    <div className="flex flex-col gap-1">
                      <span className="text-zinc-200 font-medium">Friction</span>
                      <span className="text-[11px] text-zinc-500">
                        The higher the friction, the slower the animation will be.
                      </span>
                      <SmoothSlider
                        min={20}
                        max={200}
                        value={project.zoomConfig?.friction ?? 120}
                        onChange={(val) =>
                          updateProject({
                            zoomConfig: {
                              motionBlur: project.zoomConfig?.motionBlur ?? true,
                              animationStyle: project.zoomConfig?.animationStyle ?? 'default',
                              tension: project.zoomConfig?.tension ?? 280,
                              friction: val,
                            },
                          })
                        }
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: WEBCAM */}
          {activeTab === 'webcam' && (
            <div className="bg-[#121215] border border-zinc-800/80 rounded-2xl p-3.5 flex flex-col gap-4 shadow-sm">
              <span className="font-semibold text-zinc-100 text-sm pb-1 border-b border-zinc-800">
                Webcam Overlay
              </span>

              <label className="flex items-center gap-2 cursor-pointer text-zinc-300">
                <input
                  type="checkbox"
                  checked={project.webcam.enabled}
                  onChange={(e) =>
                    updateProject({
                      webcam: { ...project.webcam, enabled: e.target.checked },
                    })
                  }
                  className="rounded accent-blue-600"
                />
                <span>Show Webcam Bubble</span>
              </label>

              {/* Position */}
              <div className="flex flex-col gap-1.5">
                <span className="text-zinc-400 font-medium">Position</span>
                <div className="grid grid-cols-2 gap-1.5">
                  {(['TOP_LEFT', 'TOP_RIGHT', 'BOTTOM_LEFT', 'BOTTOM_RIGHT'] as const).map((pos) => (
                    <button
                      key={pos}
                      onClick={() =>
                        updateProject({
                          webcam: { ...project.webcam, position: pos },
                        })
                      }
                      className={`py-1.5 rounded-lg border text-center transition-colors text-xs ${
                        project.webcam.position === pos
                          ? 'bg-zinc-800 border-blue-500 text-white font-semibold'
                          : 'border-zinc-800 text-zinc-400 hover:border-zinc-700'
                      }`}
                    >
                      {pos.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Shape */}
              <div className="flex flex-col gap-1.5">
                <span className="text-zinc-400 font-medium">Shape</span>
                <div className="grid grid-cols-2 gap-1.5">
                  {(['circle', 'rounded'] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() =>
                        updateProject({
                          webcam: { ...project.webcam, shape: s },
                        })
                      }
                      className={`py-1.5 rounded-lg border capitalize text-center transition-colors text-xs ${
                        project.webcam.shape === s
                          ? 'bg-zinc-800 border-blue-500 text-white font-semibold'
                          : 'border-zinc-800 text-zinc-400 hover:border-zinc-700'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: CAPTIONS */}
          {activeTab === 'captions' && (
            <div className="bg-[#121215] border border-zinc-800/80 rounded-2xl p-4 flex flex-col gap-2 shadow-sm">
              <span className="font-semibold text-zinc-100 text-sm pb-1 border-b border-zinc-800">
                Captions & Subtitles
              </span>
              <p className="text-zinc-400 text-xs leading-relaxed">
                Automatically generate animated word-by-word subtitles and synchronized karaoke highlights.
              </p>
            </div>
          )}

          {/* TAB 5: AUDIO */}
          {activeTab === 'audio' && (
            <div className="bg-[#121215] border border-zinc-800/80 rounded-2xl p-4 flex flex-col gap-3 shadow-sm">
              <span className="font-semibold text-zinc-100 text-sm pb-1 border-b border-zinc-800">
                Audio Mix
              </span>
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between text-zinc-300">
                  <span>Output Volume</span>
                  <span className="font-mono">{Math.round(project.volume * 100)}%</span>
                </div>
                <SmoothSlider
                  min={0}
                  max={1.5}
                  step={0.05}
                  value={project.volume}
                  onChange={(val) => updateProject({ volume: val })}
                />
              </div>
            </div>
          )}

          {/* TAB 6: EXPORT */}
          {activeTab === 'export' && (
            <div className="bg-[#121215] border border-zinc-800/80 rounded-2xl p-4 flex flex-col gap-3 shadow-sm">
              <span className="font-semibold text-zinc-100 text-sm pb-1 border-b border-zinc-800">
                Export Settings
              </span>
              <div className="flex flex-col gap-2">
                <span className="text-zinc-300 font-medium">Export Quality</span>
                <div className="grid grid-cols-2 gap-2">
                  {['1080p (60 FPS)', '4K UHD (60 FPS)'].map((res, i) => (
                    <button
                      key={res}
                      className={`py-2 rounded-lg border text-xs text-center ${
                        i === 0 ? 'bg-zinc-800 border-blue-500 text-white font-medium' : 'border-zinc-800 text-zinc-400'
                      }`}
                    >
                      {res}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 7: VISIBILITY */}
          {activeTab === 'visibility' && (
            <div className="bg-[#121215] border border-zinc-800/80 rounded-2xl p-4 flex flex-col gap-3 shadow-sm">
              <span className="font-semibold text-zinc-100 text-sm pb-1 border-b border-zinc-800">
                Visibility & Overlays
              </span>
              <div className="flex items-center justify-between">
                <span className="text-zinc-300">Show Cursors</span>
                <input
                  type="checkbox"
                  checked={project.cursor.visible}
                  onChange={(e) =>
                    updateProject({
                      cursor: { ...project.cursor, visible: e.target.checked },
                    })
                  }
                  className="rounded accent-blue-600"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-300">Show Webcam</span>
                <input
                  type="checkbox"
                  checked={project.webcam.enabled}
                  onChange={(e) =>
                    updateProject({
                      webcam: { ...project.webcam, enabled: e.target.checked },
                    })
                  }
                  className="rounded accent-blue-600"
                />
              </div>
            </div>
          )}
        </div>
      </div>
  );
}, (prev, next) => {
  if (prev.selectedZoom !== next.selectedZoom) return false;
  if (prev.project.background !== next.project.background) return false;
  if (prev.project.cursor !== next.project.cursor) return false;
  if (prev.project.webcam !== next.project.webcam) return false;
  if (prev.project.aspectRatio !== next.project.aspectRatio) return false;
  if (prev.project.padding !== next.project.padding) return false;
  if (prev.project.radius !== next.project.radius) return false;
  if (prev.project.backgroundBlur !== next.project.backgroundBlur) return false;
  if (prev.project.shadowEnabled !== next.project.shadowEnabled) return false;
  if (prev.project.shadowBlur !== next.project.shadowBlur) return false;
  if (prev.project.volume !== next.project.volume) return false;
  if (prev.project.targetCrop !== next.project.targetCrop) return false;
  if (prev.project.zoomConfig !== next.project.zoomConfig) return false;
  if (prev.project.zooms !== next.project.zooms) return false;
  return true;
});
