import React, { useRef, useState, useEffect, useMemo } from 'react';
import {
  Wand2,
  ChevronDown,
  Undo2,
  Redo2,
  MoreVertical,
  ArrowUpCircle,
  Play,
  Pause,
  Crop,
  PanelLeft,
  Scissors,
  ZoomIn,
  ZoomOut,
  RectangleHorizontal,
  Check,
} from 'lucide-react';
import type { ProjectState } from '../types/canvid';
import { CustomCursor } from './CustomCursor';
import { QuickShareSettingsModal } from './QuickShareSettingsModal';

interface StudioViewportProps {
  project: ProjectState;
  onTimeUpdate: (time: number) => void;
  onDurationChange: (duration: number) => void;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  camRef: React.RefObject<HTMLVideoElement | null>;
  onExport?: () => void;
  isExporting?: boolean;
  onSaveProject?: () => void;
  onTogglePlay?: () => void;
  onSeek?: (time: number) => void;
  onAddZoom?: () => void;
  onCutClip?: () => void;
  aspectRatio?: '16:9' | '9:16' | '4:3' | '1:1';
  setAspectRatio?: (ar: '16:9' | '9:16' | '4:3' | '1:1') => void;
  timelineZoomScale?: number;
  setTimelineZoomScale?: (s: number) => void;
}

export const StudioViewport: React.FC<StudioViewportProps> = React.memo(({
  project,
  onTimeUpdate,
  onDurationChange,
  videoRef,
  camRef,
  onExport,
  isExporting,
  onSaveProject: _onSaveProject,
  onTogglePlay,
  onSeek,
  onAddZoom,
  onCutClip,
  aspectRatio = '16:9',
  setAspectRatio,
  timelineZoomScale = 1,
  setTimelineZoomScale,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const [videoDims, setVideoDims] = useState<{ width: number; height: number }>({ width: 1920, height: 1080 });
  const [playbackTime, setPlaybackTime] = useState<number>(0);
  const [showAspectMenu, setShowAspectMenu] = useState(false);
  const [isQuickShareOpen, setIsQuickShareOpen] = useState(false);
  const aspectMenuRef = useRef<HTMLDivElement>(null);

  // Close aspect ratio popup when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (aspectMenuRef.current && !aspectMenuRef.current.contains(e.target as Node)) {
        setShowAspectMenu(false);
      }
    };
    if (showAspectMenu) {
      window.addEventListener('mousedown', handleClickOutside);
    }
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [showAspectMenu]);

  // Safe time formatting (MM:SS)
  const formatTime = (seconds: number) => {
    if (!Number.isFinite(seconds) || isNaN(seconds) || seconds < 0) return '00:00';
    const totalSec = Math.floor(seconds);
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const safeDuration = Number.isFinite(project.duration) && project.duration > 0 ? project.duration : 12;
  const safeCurrentTime = Number.isFinite(project.currentTime) && project.currentTime >= 0 ? project.currentTime : 0;

  // 60 FPS+ animation loop: hardware video clock drives local state
  useEffect(() => {
    let animId: number;
    let lastThrottledTime = 0;

    const tick = () => {
      // Yield full hardware control of video clock to export engine during export
      if (isExporting) {
        animId = requestAnimationFrame(tick);
        return;
      }
      const v = videoRef.current;
      if (v) {
        if (!v.paused) {
          const ct = v.currentTime;

          // Seamless clip-skipping: if user trimmed or cut clips, skip cut gaps automatically
          if (project.clips && project.clips.length > 0) {
            const activeClip = project.clips.find((c) => ct >= c.start && ct < c.end);
            if (!activeClip) {
              const nextClip = project.clips.find((c) => c.start > ct);
              if (nextClip) {
                v.currentTime = nextClip.start;
                setPlaybackTime(nextClip.start);
                onTimeUpdate(nextClip.start);
                animId = requestAnimationFrame(tick);
                return;
              } else {
                v.pause();
                setPlaybackTime(safeDuration);
                onTimeUpdate(safeDuration);
                animId = requestAnimationFrame(tick);
                return;
              }
            }
          }

          setPlaybackTime(ct);

          if (Math.abs(ct - lastThrottledTime) >= 0.1) {
            lastThrottledTime = ct;
            onTimeUpdate(ct);
          }
        }
      }
      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [videoRef, onTimeUpdate, project.clips, safeDuration]);

  const effectiveTime = project.isPlaying ? playbackTime : project.currentTime;

  // Active recorded mouse position at the current millisecond (for auto camera tracking)
  const recordedMouseFocal = useMemo(() => {
    if (project.mouseEvents.length === 0 || videoDims.width <= 0 || videoDims.height <= 0) return null;
    const curMs = effectiveTime * 1000;
    let low = 0;
    let high = project.mouseEvents.length - 1;
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (project.mouseEvents[mid].t_ms < curMs) {
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }
    const idx = Math.max(0, Math.min(project.mouseEvents.length - 1, low));
    const p = project.mouseEvents[idx];
    if (!p) return null;
    return {
      x: Math.max(0.05, Math.min(0.95, p.x / videoDims.width)),
      y: Math.max(0.05, Math.min(0.95, p.y / videoDims.height)),
      isClick: Math.abs(p.t_ms - curMs) < 300 && (p.event_type === 'lclick' || p.event_type === 'rclick'),
    };
  }, [project.mouseEvents, effectiveTime, videoDims]);

  // Determine current active timeline zoom keyframe
  const timelineZoom = useMemo(() => {
    const curMs = effectiveTime * 1000;
    return project.zooms.find(
      (z) => !z.disabled && curMs >= z.start && curMs <= z.end
    );
  }, [project.zooms, effectiveTime]);

  const isZoomActive = Boolean(timelineZoom);
  const currentZoomLevel = timelineZoom ? timelineZoom.level : 1.0;

  // Screen Focus follows recorded mouse or explicit keyframe focal point (NEVER desktop cursor hover)
  const currentFocal = useMemo(() => {
    if (timelineZoom) {
      if (recordedMouseFocal) {
        return { x: recordedMouseFocal.x, y: recordedMouseFocal.y };
      }
      return { x: timelineZoom.focal_x, y: timelineZoom.focal_y };
    }
    return { x: 0.5, y: 0.5 };
  }, [timelineZoom, recordedMouseFocal]);

  // Dynamic Camera Transform with smooth spring easing & focal clamping
  const zoomStyle = useMemo<React.CSSProperties>(() => {
    if (!isZoomActive) {
      return {
        transform: 'scale(1) translate(0%, 0%)',
        transition: 'transform 450ms cubic-bezier(0.16, 1, 0.3, 1)',
        transformOrigin: '50% 50%',
      };
    }

    const { x, y } = currentFocal;
    const maxOffset = 50 * (1 - 1 / currentZoomLevel);
    const transX = Math.max(-maxOffset, Math.min(maxOffset, (0.5 - x) * 100));
    const transY = Math.max(-maxOffset, Math.min(maxOffset, (0.5 - y) * 100));

    return {
      transform: `scale(${currentZoomLevel}) translate(${transX.toFixed(2)}%, ${transY.toFixed(2)}%)`,
      transition: 'transform 450ms cubic-bezier(0.16, 1, 0.3, 1)',
      transformOrigin: '50% 50%',
    };
  }, [isZoomActive, currentZoomLevel, currentFocal]);

  const handleLoadedMetadata = () => {
    const v = videoRef.current;
    if (!v) return;
    setVideoDims({
      width: v.videoWidth || 1920,
      height: v.videoHeight || 1080,
    });
    if (v.duration && !isNaN(v.duration)) {
      onDurationChange(v.duration);
    }
  };

  const aspectClass = useMemo(() => {
    switch (project.aspectRatio) {
      case '9:16':
        return 'aspect-[9/16] max-h-[68vh]';
      case '4:3':
        return 'aspect-[4/3] max-h-[66vh]';
      case '1:1':
        return 'aspect-square max-h-[66vh]';
      case '16:9':
      default:
        return 'aspect-video max-h-[66vh]';
    }
  }, [project.aspectRatio]);

  const webcamPosClass = useMemo(() => {
    switch (project.webcam.position) {
      case 'TOP_LEFT':
        return 'top-6 left-6';
      case 'TOP_RIGHT':
        return 'top-6 right-6';
      case 'BOTTOM_LEFT':
        return 'bottom-6 left-6';
      case 'BOTTOM_RIGHT':
      default:
        return 'bottom-6 right-6';
    }
  }, [project.webcam.position]);

  const activeCursorTime = effectiveTime * 1000;

  return (
    <div className="flex-1 rounded-2xl border border-zinc-800/40 bg-[#0c0c0e] flex flex-col overflow-hidden relative select-none shadow-xl min-w-0">
      {/* 1. Top Studio Sub-Bar (Matching Screenshot 1 & 2) */}
      <div className="h-10 px-4 flex items-center justify-between text-xs text-zinc-300 border-b border-zinc-800/40 bg-[#0e0e11] shrink-0">
        {/* Left: Presets ⌄ */}
        <div className="flex items-center gap-1.5 text-zinc-400 hover:text-zinc-200 cursor-pointer px-2 py-1 rounded-md hover:bg-zinc-900/80 transition-colors">
          <Wand2 className="w-3.5 h-3.5 text-zinc-400" />
          <span className="font-medium text-xs">Presets</span>
          <ChevronDown className="w-3 h-3 text-zinc-500" />
        </div>

        {/* Right: Undo, Redo, Export with 3-Dots Quick Share Menu */}
        <div className="flex items-center gap-1.5 relative">
          {/* Undo */}
          <button
            className="p-1.5 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-900/80 rounded-md transition-colors"
            title="Undo"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>

          {/* Redo */}
          <button
            className="p-1.5 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-900/80 rounded-md transition-colors"
            title="Redo"
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>

          {/* Primary Export Button with 3 dots on right side */}
          <div className="flex items-center rounded-lg bg-blue-600 shadow-sm ml-1 overflow-hidden">
            <button
              onClick={onExport}
              disabled={isExporting}
              className="flex items-center gap-1.5 px-3.5 py-1.5 hover:bg-blue-500 text-white font-medium transition-all text-xs disabled:opacity-50"
            >
              <ArrowUpCircle className="w-3.5 h-3.5" />
              <span>{isExporting ? 'Exporting...' : 'Export'}</span>
            </button>

            <div className="w-[1px] h-4 bg-blue-400/40" />

            <button
              onClick={() => setIsQuickShareOpen(!isQuickShareOpen)}
              className="px-2 py-1.5 hover:bg-blue-500 text-white transition-colors"
              title="Quick Share Settings"
            >
              <MoreVertical className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Quick Share Settings Dropdown Modal */}
          <QuickShareSettingsModal
            isOpen={isQuickShareOpen}
            onClose={() => setIsQuickShareOpen(false)}
          />
        </div>
      </div>

      {/* 2. Main Studio Canvas Viewport Frame */}
      <div className="flex-1 flex items-center justify-center p-4 overflow-hidden relative bg-[#070709]">
        <div
          ref={containerRef}
          className={`w-full max-w-5xl ${aspectClass} rounded-2xl relative overflow-hidden flex items-center justify-center shadow-2xl bg-black border border-zinc-800/60`}
        >
          {/* Hardware-Accelerated Isolated Background Blur Layer: Zero Tiling, Full Bleed Cover */}
          <div
            className="absolute inset-0 pointer-events-none z-0 overflow-hidden will-change-transform bg-no-repeat bg-center bg-cover"
            style={{
              backgroundImage: project.background.type === 'image'
                ? `url(${project.background.value})`
                : undefined,
              backgroundColor: project.background.type === 'color' ? project.background.value : '#000000',
              background: project.background.type === 'gradient' ? project.background.value : undefined,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'center center',
              backgroundSize: 'cover',
              filter: `blur(var(--canvid-bg-blur, ${project.backgroundBlur ?? 0}px))`,
              transform: 'scale(1.06) translateZ(0)',
              willChange: 'filter, transform',
            }}
          />

          {/* Video Canvas Container - Hardware GPU Scaled Padding */}
          <div
            ref={videoContainerRef}
            className="relative overflow-hidden flex items-center justify-center z-10 will-change-transform"
            style={{
              width: '100%',
              height: '100%',
              transform: `scale(${Math.max(0.4, 1 - (project.padding / 100) * 1.4).toFixed(4)}) translateZ(0)`,
              transformOrigin: '50% 50%',
              borderRadius: `var(--canvid-radius, ${project.radius}px)`,
              boxShadow: project.shadowEnabled
                ? `0 calc(var(--canvid-shadow-blur, ${project.shadowBlur}px) / 2) var(--canvid-shadow-blur, ${project.shadowBlur}px) rgba(0,0,0,0.6)`
                : 'none',
              willChange: 'transform, border-radius, box-shadow',
            }}
          >
            {/* Main Video Element with Dynamic Camera Pan & Zoom Transform */}
            {project.videoUrl ? (
              <div className="w-full h-full relative overflow-hidden pointer-events-none" style={zoomStyle}>
                <video
                  ref={videoRef as any}
                  src={project.videoUrl}
                  className="w-full h-full object-contain select-none"
                  onLoadedMetadata={handleLoadedMetadata}
                  onEnded={onTogglePlay}
                  playsInline
                  preload="auto"
                />

                {/* Overlaid Vector Cursor with Motion Blur */}
                <CustomCursor
                  cursorConfig={project.cursor}
                  mouseEvents={project.mouseEvents}
                  currentTimeMs={activeCursorTime}
                  screenWidth={videoDims.width}
                  screenHeight={videoDims.height}
                />
              </div>
            ) : (
              <div className="w-full h-full bg-[#0c0c0e] flex flex-col items-center justify-center text-zinc-400 gap-3">
                <div className="w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center shadow-inner">
                  <Wand2 className="w-6 h-6 text-zinc-500" />
                </div>
                <div className="flex flex-col items-center gap-1">
                  <span className="text-zinc-200 font-semibold text-sm">No Recording Loaded</span>
                  <span className="text-zinc-500 text-xs">Start a recording or import a video to begin editing</span>
                </div>
              </div>
            )}
          </div>

          {/* Webcam Floating Bubble Overlay */}
          {project.webcam.enabled && Boolean(project.camUrl) && (
            <div
              className={`absolute z-30 overflow-hidden shadow-2xl border-2 border-white/20 transition-all duration-200 ${webcamPosClass} ${
                project.webcam.shape === 'circle' ? 'rounded-full' : 'rounded-2xl'
              }`}
              style={{
                width: `${project.webcam.size}px`,
                height: `${project.webcam.size}px`,
                transform: project.webcam.mirrored ? 'scaleX(-1)' : 'none',
              }}
            >
              {project.camUrl ? (
                <video
                  ref={camRef as any}
                  src={project.camUrl}
                  className="w-full h-full object-cover"
                  playsInline
                  muted
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-indigo-900 to-purple-900 flex items-center justify-center text-white text-xs font-semibold">
                  Camera
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 3. Bottom Playback Control Bar in Video Box Bottom (Matching Image 3) */}
      <div className="h-11 px-4 flex items-center justify-between text-xs text-zinc-300 border-t border-zinc-800/80 bg-[#0c0c0e] shrink-0">
        {/* Left: Layout icon, Cut Scissors, Zoom Slider */}
        <div className="flex items-center gap-2">
          <button
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800/70 transition-colors"
            title="Toggle Sidebar"
          >
            <PanelLeft className="w-4 h-4" />
          </button>

          <button
            onClick={onCutClip ? onCutClip : onAddZoom}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800/70 transition-colors"
            title="Split Selected Clip at Playhead (S)"
          >
            <Scissors className="w-4 h-4" />
          </button>

          {/* Timeline Zoom Slider */}
          <div className="flex items-center gap-1.5 ml-2 bg-zinc-900/60 border border-zinc-800/70 px-2 py-1 rounded-lg">
            <ZoomOut className="w-3.5 h-3.5 text-zinc-500" />
            <input
              type="range"
              min="0.5"
              max="2.0"
              step="0.1"
              value={timelineZoomScale}
              onChange={(e) => setTimelineZoomScale && setTimelineZoomScale(parseFloat(e.target.value))}
              className="accent-blue-500 bg-zinc-800 h-1 w-14 rounded-full cursor-pointer"
            />
            <ZoomIn className="w-3.5 h-3.5 text-zinc-500" />
          </div>
        </div>

        {/* Center: Playback Timecodes & Transport Controls */}
        <div className="flex items-center gap-3">
          <span className="font-mono text-zinc-300 text-xs font-semibold tracking-tight w-11 text-right">
            {formatTime(safeCurrentTime)}
          </span>

          {/* Rewind 5s */}
          <button
            onClick={() => onSeek && onSeek(Math.max(0, safeCurrentTime - 5))}
            className="w-7 h-7 flex items-center justify-center rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800/80 transition-all active:scale-95"
            title="Rewind 5s"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
              <text x="12" y="15" textAnchor="middle" fontSize="7" fontWeight="bold" fill="currentColor" stroke="none">5</text>
            </svg>
          </button>

          {/* Play/Pause Button */}
          <button
            onClick={onTogglePlay}
            tabIndex={-1}
            onFocus={(e) => e.currentTarget.blur()}
            className="w-7 h-7 flex items-center justify-center rounded-full bg-white hover:bg-zinc-100 text-zinc-950 shadow-md transition-all active:scale-95 hover:scale-105"
            title="Play/Pause (Space or K)"
          >
            {project.isPlaying ? (
              <Pause className="w-3.5 h-3.5 fill-current text-zinc-950" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-current text-zinc-950 translate-x-0.5" />
            )}
          </button>

          {/* Forward 5s */}
          <button
            onClick={() => onSeek && onSeek(Math.min(safeDuration, safeCurrentTime + 5))}
            className="w-7 h-7 flex items-center justify-center rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800/80 transition-all active:scale-95"
            title="Forward 5s"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12a9 9 0 1 1-9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
              <path d="M21 3v5h-5" />
              <text x="12" y="15" textAnchor="middle" fontSize="7" fontWeight="bold" fill="currentColor" stroke="none">5</text>
            </svg>
          </button>

          <span className="font-mono text-zinc-500 text-xs font-semibold tracking-tight w-11 text-left">
            {formatTime(safeDuration)}
          </span>
        </div>

        {/* Right: Crop & Aspect Ratio Dropdown (Image 3: Crop [▢] 16:9) */}
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800/80 hover:bg-zinc-800 text-zinc-300 font-medium text-xs transition-colors shadow-sm">
            <Crop className="w-3.5 h-3.5 text-zinc-400" />
            <span>Crop</span>
          </button>

          <div ref={aspectMenuRef} className="relative">
            <button
              onClick={() => setShowAspectMenu(!showAspectMenu)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800/80 hover:bg-zinc-800 text-zinc-300 font-medium text-xs transition-colors shadow-sm"
              title="Change Canvas Aspect Ratio"
            >
              <RectangleHorizontal className="w-3.5 h-3.5 text-zinc-400" />
              <span>{aspectRatio}</span>
            </button>

            {showAspectMenu && (
              <div className="absolute right-0 bottom-full mb-2 w-32 bg-[#141416] border border-zinc-800/90 rounded-xl shadow-2xl py-1 z-50 flex flex-col text-xs animate-in fade-in slide-in-from-bottom-1 duration-150">
                {(['16:9', '9:16', '4:3', '1:1'] as const).map((ratio) => (
                  <button
                    key={ratio}
                    onClick={() => {
                      if (setAspectRatio) setAspectRatio(ratio);
                      setShowAspectMenu(false);
                    }}
                    className={`px-3 py-1.5 flex items-center justify-between text-left transition-colors ${
                      aspectRatio === ratio
                        ? 'bg-blue-600/20 text-blue-400 font-semibold'
                        : 'text-zinc-300 hover:bg-zinc-800/80'
                    }`}
                  >
                    <span>{ratio}</span>
                    {aspectRatio === ratio && <Check className="w-3 h-3 text-blue-400" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}, (prev, next) => {
  if (prev.project.videoUrl !== next.project.videoUrl) return false;
  if (prev.project.camUrl !== next.project.camUrl) return false;
  if (prev.project.background !== next.project.background) return false;
  if (prev.project.backgroundBlur !== next.project.backgroundBlur) return false;
  if (prev.project.padding !== next.project.padding) return false;
  if (prev.project.radius !== next.project.radius) return false;
  if (prev.project.shadowEnabled !== next.project.shadowEnabled) return false;
  if (prev.project.shadowBlur !== next.project.shadowBlur) return false;
  if (prev.project.aspectRatio !== next.project.aspectRatio) return false;
  if (prev.project.webcam !== next.project.webcam) return false;
  if (prev.project.cursor !== next.project.cursor) return false;
  if (prev.project.zooms !== next.project.zooms) return false;
  if (prev.project.targetCrop !== next.project.targetCrop) return false;
  if (prev.project.isPlaying !== next.project.isPlaying) return false;
  if (prev.aspectRatio !== next.aspectRatio) return false;
  if (prev.timelineZoomScale !== next.timelineZoomScale) return false;
  if (!prev.project.isPlaying && prev.project.currentTime !== next.project.currentTime) return false;
  return true;
});
