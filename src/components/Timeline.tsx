import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import type { ProjectState, ZoomKeyframe } from '../types/canvid';

interface TimelineProps {
  project: ProjectState;
  onSeek: (time: number) => void;
  onTogglePlay?: () => void;
  onAddZoom?: () => void;
  onDeleteZoom: (id: string) => void;
  onUpdateZoom?: (id: string, updates: Partial<ZoomKeyframe>) => void;
  onSetSpeed?: (speed: number) => void;
  selectedZoomId: string | null;
  onSelectZoom: (id: string | null) => void;
  selectedClipId?: string | null;
  onSelectClip?: (id: string | null) => void;
  timelineZoomScale?: number;
  aspectRatio?: '16:9' | '9:16' | '4:3' | '1:1';
  setAspectRatio?: (ar: '16:9' | '9:16' | '4:3' | '1:1') => void;
}

export const Timeline: React.FC<TimelineProps> = React.memo(({
  project,
  onSeek,
  onUpdateZoom,
  selectedZoomId,
  onSelectZoom,
  selectedClipId,
  onSelectClip,
  timelineZoomScale = 1.0,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [isScrubbing, setIsScrubbing] = useState(false);

  const [draggingZoom, setDraggingZoom] = useState<{
    id: string;
    type: 'move' | 'resize-start' | 'resize-end';
    initialX: number;
    initialStart: number;
    initialEnd: number;
  } | null>(null);

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
  const progressPercent = Math.max(0, Math.min(100, (safeCurrentTime / safeDuration) * 100));

  // 60FPS Smooth scrub seeker
  const handleSeekAtClientX = useCallback((clientX: number) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    if (rect.width <= 0) return;
    const pos = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    onSeek(pos * safeDuration);
  }, [safeDuration, onSeek]);

  const handleTrackPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    if (onSelectClip) onSelectClip(null);
    onSelectZoom(null);
    setIsScrubbing(true);
    handleSeekAtClientX(e.clientX);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handleTrackPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isScrubbing) return;
    handleSeekAtClientX(e.clientX);
  };

  const handleTrackPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isScrubbing) {
      setIsScrubbing(false);
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}
    }
  };

  // Dragging / Resizing Zoom Blocks
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!draggingZoom || !trackRef.current || !onUpdateZoom) return;
      const rect = trackRef.current.getBoundingClientRect();
      const deltaX = e.clientX - draggingZoom.initialX;
      const deltaMs = (deltaX / rect.width) * safeDuration * 1000;

      if (draggingZoom.type === 'move') {
        const dur = draggingZoom.initialEnd - draggingZoom.initialStart;
        const newStart = Math.max(0, Math.min(safeDuration * 1000 - dur, draggingZoom.initialStart + deltaMs));
        onUpdateZoom(draggingZoom.id, {
          start: Math.round(newStart),
          end: Math.round(newStart + dur),
        });
      } else if (draggingZoom.type === 'resize-start') {
        const newStart = Math.max(0, Math.min(draggingZoom.initialEnd - 300, draggingZoom.initialStart + deltaMs));
        onUpdateZoom(draggingZoom.id, { start: Math.round(newStart) });
      } else if (draggingZoom.type === 'resize-end') {
        const newEnd = Math.max(draggingZoom.initialStart + 300, Math.min(safeDuration * 1000, draggingZoom.initialEnd + deltaMs));
        onUpdateZoom(draggingZoom.id, { end: Math.round(newEnd) });
      }
    };

    const handleMouseUp = () => {
      setDraggingZoom(null);
    };

    if (draggingZoom) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingZoom, safeDuration, onUpdateZoom]);

  // Generate ruler tick marks matching Image 1 & Image 2 (every 2s with minor ticks)
  const rulerTicks = useMemo(() => {
    const ticks = [];
    const step = safeDuration > 60 ? 4 : safeDuration > 20 ? 2 : 1;
    for (let s = 0; s <= Math.floor(safeDuration); s += step) {
      const leftPct = (s / safeDuration) * 100;
      if (leftPct <= 99) {
        ticks.push({ sec: s, leftPct });
      }
    }
    return ticks;
  }, [safeDuration]);

  // Minor sub-second hairline ticks (12 per major tick interval)
  const minorTicks = useMemo(() => {
    const ticks = [];
    const step = safeDuration > 60 ? 1 : 0.5;
    for (let s = 0; s <= safeDuration; s += step) {
      const leftPct = (s / safeDuration) * 100;
      if (leftPct <= 99.5) {
        ticks.push(leftPct);
      }
    }
    return ticks;
  }, [safeDuration]);

  // Active clips list (fallback to single full duration clip)
  const clips = useMemo(() => {
    if (project.clips && project.clips.length > 0) {
      return project.clips;
    }
    return [
      {
        id: 'clip-primary',
        start: 0,
        end: safeDuration,
        sourceStart: 0,
      },
    ];
  }, [project.clips, safeDuration]);

  return (
    <div className="h-32 rounded-2xl border border-zinc-800/80 bg-[#0c0c0e] flex flex-col select-none font-sans z-20 shadow-xl overflow-hidden shrink-0">
      {/* Scrollable Tracks & Ruler Area with Zoom Scaling */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-x-auto overflow-y-hidden custom-scrollbar bg-[#070709]"
      >
        <div
          ref={trackRef}
          onPointerDown={handleTrackPointerDown}
          onPointerMove={handleTrackPointerMove}
          onPointerUp={handleTrackPointerUp}
          style={{
            width: `${Math.max(100, (timelineZoomScale ?? 1) * 100)}%`,
            minWidth: '100%',
          }}
          className="h-full relative cursor-pointer px-4 pt-1.5 pb-2 flex flex-col justify-between"
        >
          {/* Subtle Vertical Hairline Grid Lines (Matching Image 1 & Image 2) */}
          <div className="absolute inset-0 pointer-events-none px-4">
            {rulerTicks.map((t) => (
              <div
                key={t.sec}
                className="absolute top-0 bottom-0 w-[1px] bg-zinc-800/35 pointer-events-none"
                style={{ left: `calc(1rem + (100% - 2rem) * (${t.leftPct} / 100))` }}
              />
            ))}
          </div>

          {/* Seconds Ruler Header */}
          <div className="h-5 relative w-full pointer-events-none text-[10px] text-zinc-500 font-mono">
            {/* Minor hairline ticks */}
            {minorTicks.map((pct, idx) => (
              <div
                key={idx}
                className="absolute top-3 w-[1px] h-1.5 bg-zinc-800/80"
                style={{ left: `${pct}%` }}
              />
            ))}

            {/* Major labels & ticks */}
            {rulerTicks.map((t) => (
              <div
                key={t.sec}
                className="absolute top-0 flex flex-col items-center -translate-x-1/2"
                style={{ left: `${t.leftPct}%` }}
              >
                <span className="leading-none text-[10px] text-zinc-400 font-medium">{formatTime(t.sec)}</span>
                <div className="w-[1px] h-2 bg-zinc-600 mt-0.5" />
              </div>
            ))}
          </div>

          {/* Video Clip Primary Track (Multiple Clips with Selection & Cuts) */}
          <div className="h-7 rounded-md relative flex items-center my-0.5 select-none">
            {clips.map((clip) => {
              const clipDur = Math.max(0.1, clip.end - clip.start);
              const leftPct = (clip.start / safeDuration) * 100;
              const widthPct = (clipDur / safeDuration) * 100;
              const isClipSelected = selectedClipId === clip.id;

              return (
                <div
                  key={clip.id}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    if (onSelectClip) {
                      onSelectClip(clip.id);
                    }
                    onSelectZoom(null);
                    handleSeekAtClientX(e.clientX);
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onSelectClip) {
                      onSelectClip(clip.id);
                    }
                    onSelectZoom(null);
                  }}
                  className={`absolute top-0 bottom-0 rounded-md border flex items-center px-2.5 transition-all cursor-pointer shadow-sm select-none ${
                    isClipSelected
                      ? 'bg-[#164d2b] border-2 border-[#22c55e] ring-2 ring-emerald-500/80 shadow-[0_0_16px_rgba(34,197,94,0.6)] text-white z-20 font-semibold'
                      : 'bg-[#0b2416] border border-[#144225] hover:border-[#22c55e]/60 text-[#4ade80] z-10 font-medium'
                  }`}
                  style={{
                    left: `${leftPct}%`,
                    width: `${widthPct}%`,
                  }}
                  title={`Click to select clip (${clipDur.toFixed(2)}s) · Press S to cut`}
                >
                  <span className="text-[11px] tracking-tight truncate select-none pointer-events-none">
                    Clip {clipDur.toFixed(2)}s
                  </span>
                </div>
              );
            })}
          </div>

        {/* Zoom Keyframe Track (Dark Rounded Slot matching Canvid Image 9) */}
        <div className="h-7 bg-[#080d16] border border-[#131d2e] rounded-md relative overflow-hidden flex items-center px-1 my-0.5">
          {project.zooms.map((z) => {
            const startSec = z.start / 1000;
            const endSec = z.end / 1000;
            const durSec = Math.max(0.1, endSec - startSec);
            const leftPct = (startSec / safeDuration) * 100;
            const widthPct = (durSec / safeDuration) * 100;
            const isSelected = selectedZoomId === z.id;
            const levelStr = z.level % 1 === 0 ? `${z.level}x` : `${z.level.toFixed(1)}x`;

            return (
              <div
                key={z.id}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectZoom(z.id);
                }}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  setDraggingZoom({
                    id: z.id,
                    type: 'move',
                    initialX: e.clientX,
                    initialStart: z.start,
                    initialEnd: z.end,
                  });
                }}
                className={`absolute top-0.5 bottom-0.5 rounded-md px-2 flex items-center justify-between text-[11px] font-medium cursor-move border transition-all select-none ${
                  isSelected
                    ? 'bg-[#182647] border-[#3b82f6] text-blue-100 ring-2 ring-blue-500/40 z-20 shadow-md'
                    : 'bg-[#121c32] border-[#203052] text-[#93c5fd] hover:border-blue-400/60 z-10'
                }`}
                style={{
                  left: `${leftPct}%`,
                  width: `max(105px, ${widthPct}%)`,
                }}
              >
                {/* Left resize handle */}
                <div
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    setDraggingZoom({
                      id: z.id,
                      type: 'resize-start',
                      initialX: e.clientX,
                      initialStart: z.start,
                      initialEnd: z.end,
                    });
                  }}
                  className="w-1.5 h-full absolute left-0 top-0 cursor-ew-resize hover:bg-blue-400/40 rounded-l"
                />

                <span className="truncate flex items-center gap-1.5 leading-none">
                  <span>Zoom</span>
                  <span className="text-[10px] opacity-75">🔍</span>
                  <span className="text-zinc-200">{levelStr}</span>
                  <span className="text-zinc-400 text-[10px]">{durSec.toFixed(1)}s</span>
                </span>

                {/* Right resize handle */}
                <div
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    setDraggingZoom({
                      id: z.id,
                      type: 'resize-end',
                      initialX: e.clientX,
                      initialStart: z.start,
                      initialEnd: z.end,
                    });
                  }}
                  className="w-1.5 h-full absolute right-0 top-0 cursor-ew-resize hover:bg-blue-400/40 rounded-r"
                />
              </div>
            );
          })}
        </div>

        {/* 0s Gray Initial Playhead Pin */}
        <div className="absolute top-0 bottom-0 left-4 w-[1px] bg-zinc-600/60 pointer-events-none z-20">
          <div className="w-2.5 h-2.5 bg-zinc-600 rounded-sm -translate-x-[4px] -translate-y-0.5" />
        </div>

        {/* Electric Blue Playhead Line with Rounded Pill Cap */}
        <div
          className="absolute top-0 bottom-0 pointer-events-none z-30 flex flex-col items-center"
          style={{
            left: `calc(1rem + (100% - 2rem) * (${progressPercent} / 100))`,
            transform: 'translateX(-50%)',
          }}
        >
          <div className="w-2.5 h-3.5 bg-blue-500 rounded-sm shadow-md" />
          <div className="w-[1.5px] flex-1 bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
        </div>
      </div>
    </div>
  </div>
  );
});
