import React, { useMemo } from 'react';
import type { CursorConfig, MouseEventRecord } from '../types/canvid';
import {
  WINDOWS_ARROW_DATA_URL,
  WINDOWS_LINK_DATA_URL,
  MACOS_ARROW_DATA_URL,
  MACOS_LINK_DATA_URL,
} from '../utils/cursorAssets';

interface CustomCursorProps {
  cursorConfig: CursorConfig;
  mouseEvents: MouseEventRecord[];
  currentTimeMs: number;
  screenWidth?: number;
  screenHeight?: number;
}

export const CustomCursor: React.FC<CustomCursorProps> = React.memo(({
  cursorConfig,
  mouseEvents,
  currentTimeMs,
  screenWidth = 1920,
  screenHeight = 1080,
}) => {
  if (!cursorConfig.visible) return null;

  // Binary search for coordinate lookup & velocity determination
  const { currentPos, speed, vx, vy, isClicking } = useMemo(() => {
    if (mouseEvents.length === 0) {
      const t = (currentTimeMs / 1000) * 0.85;
      const x = (screenWidth * 0.5) + Math.sin(t) * (screenWidth * 0.32);
      const y = (screenHeight * 0.5) + Math.sin(t * 1.7) * (screenHeight * 0.24);
      const velX = Math.cos(t) * 20;
      const velY = Math.cos(t * 1.7) * 16;
      const curSpeed = Math.sqrt(velX * velX + velY * velY);
      return {
        currentPos: { x, y },
        speed: curSpeed,
        vx: velX,
        vy: velY,
        isClicking: false,
      };
    }

    let low = 0;
    let high = mouseEvents.length - 1;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (mouseEvents[mid].t_ms < currentTimeMs) {
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    const idx = Math.max(0, Math.min(mouseEvents.length - 1, low));
    const p0 = mouseEvents[Math.max(0, idx - 2)];
    const p1 = mouseEvents[Math.max(0, idx - 1)];
    const p2 = mouseEvents[idx];
    const p3 = mouseEvents[Math.min(mouseEvents.length - 1, idx + 1)];

    let x = p2.x;
    let y = p2.y;
    let velX = 0;
    let velY = 0;

    if (p1 && p2 && p2.t_ms > p1.t_ms) {
      const dt = Math.max(1, p2.t_ms - p1.t_ms);
      velX = ((p2.x - p1.x) / dt) * 16.6;
      velY = ((p2.y - p1.y) / dt) * 16.6;

      if (cursorConfig.smoothing) {
        const t = Math.max(0, Math.min(1, (currentTimeMs - p1.t_ms) / (p2.t_ms - p1.t_ms)));
        const t2 = t * t;
        const t3 = t2 * t;

        x = 0.5 * (
          (2 * p1.x) +
          (-p0.x + p2.x) * t +
          (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
          (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3
        );

        y = 0.5 * (
          (2 * p1.y) +
          (-p0.y + p2.y) * t +
          (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
          (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3
        );
      }
    }

    const curSpeed = Math.sqrt(velX * velX + velY * velY);

    // Click detection: activates hand pointer in a ±220ms window around click events
    let isClick = false;
    const windowStart = Math.max(0, idx - 12);
    const windowEnd = Math.min(mouseEvents.length - 1, idx + 12);
    for (let i = windowStart; i <= windowEnd; i++) {
      const ev = mouseEvents[i];
      if (ev.event_type === 'lclick' || ev.event_type === 'rclick') {
        const delta = currentTimeMs - ev.t_ms;
        if (delta >= -40 && delta <= 240) {
          isClick = true;
          break;
        }
      }
    }

    return {
      currentPos: { x, y },
      speed: curSpeed,
      vx: velX,
      vy: velY,
      isClicking: isClick,
    };
  }, [mouseEvents, currentTimeMs, cursorConfig.smoothing, screenWidth, screenHeight]);

  const leftPercent = (currentPos.x / screenWidth) * 100;
  const topPercent = (currentPos.y / screenHeight) * 100;
  const baseSize = 22 * (cursorConfig.scale || 1.4);

  // Real Directional Linear Motion Blur (True camera shutter smear matching Canvid, ZERO ghosting duplicates)
  const isMotionBlur = cursorConfig.motionBlur !== false && speed > 2.0 && !isClicking;
  const blurAmount = isMotionBlur ? Math.min(10.0, Math.max(0, (speed - 2.0) * 0.16)) : 0;
  const angleRad = isMotionBlur ? Math.atan2(vy, vx) : 0;
  const angleDeg = (angleRad * 180) / Math.PI;

  // Slight trailing bias along direction of motion for realistic camera shutter exposure
  const trailBiasX = isMotionBlur && speed > 0 ? -(vx / speed) * (blurAmount * 0.45) : 0;
  const trailBiasY = isMotionBlur && speed > 0 ? -(vy / speed) * (blurAmount * 0.45) : 0;

  // Precise Hotspot Alignment:
  // Windows Arrow hotspot is (0, 0) -> translate(0, 0)
  // Windows Link Hand fingertip is (25px / 70px) = 35.71% -> translate(-35.71%, 0)
  // macOS Arrow hotspot is (13px / 76px) = 17.11%, (11px / 113px) = 9.73% -> translate(-17.11%, -9.73%)
  // macOS Link Hand fingertip is (36px / 106px) = 33.96%, (13px / 112px) = 11.61% -> translate(-33.96%, -11.61%)
  const theme = cursorConfig.theme || 'windows';
  const isWindows = theme === 'windows';
  const isMac = theme === 'mac';

  let cursorTransform = 'translate(0%, 0%)';
  if (isClicking) {
    if (isWindows) {
      cursorTransform = 'translate(-35.71%, 0%) scale(0.96)';
    } else if (isMac) {
      cursorTransform = 'translate(-33.96%, -11.61%) scale(0.96)';
    } else {
      cursorTransform = 'translate(-35.4%, -6.25%) scale(0.96)';
    }
  } else {
    if (isWindows) {
      cursorTransform = 'translate(0%, 0%)';
    } else if (isMac) {
      cursorTransform = 'translate(-17.11%, -9.73%)';
    } else {
      cursorTransform = 'translate(-3px, -3px)';
    }
  }

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-40">
      {/* SVG Directional Motion Blur Filter Definition */}
      {isMotionBlur && blurAmount > 0.4 && (
        <svg className="absolute w-0 h-0 pointer-events-none overflow-hidden" aria-hidden="true">
          <defs>
            <filter id="cursor-dir-motion-blur" x="-200%" y="-200%" width="500%" height="500%">
              {/* Pure 1-Dimensional Linear Blur strictly along local X-axis */}
              <feGaussianBlur in="SourceGraphic" stdDeviation={`${blurAmount.toFixed(2)} 0`} />
            </filter>
          </defs>
        </svg>
      )}

      {/* Main Single Cursor Element with Real Directional Linear Motion Blur */}
      <div
        className="absolute pointer-events-none will-change-transform"
        style={{
          left: `${leftPercent}%`,
          top: `${topPercent}%`,
          transform: `${cursorTransform} translate(${trailBiasX}px, ${trailBiasY}px)`,
          transition: 'transform 75ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Click Expanding Ripple Animation if enabled */}
        {isClicking && cursorConfig.clickEffect !== 'none' && (
          <div
            className={`absolute rounded-full -translate-x-1/2 -translate-y-1/2 pointer-events-none animate-ping ${
              cursorConfig.clickEffect === 'glow'
                ? 'w-10 h-10 bg-indigo-500/35 blur-xs'
                : cursorConfig.clickEffect === 'radar'
                ? 'w-12 h-12 border border-emerald-400/80'
                : 'w-10 h-10 border border-indigo-400/80 bg-indigo-500/20'
            }`}
            style={{
              left: isClicking ? (isMac ? '34%' : '36%') : (isMac ? '17%' : '0'),
              top: isClicking ? (isMac ? '12%' : '4%') : (isMac ? '10%' : '0'),
            }}
          />
        )}

        {/* Directional Blur Rotator: Aligns 1D blur strictly along motion vector while keeping cursor upright */}
        <div
          className="pointer-events-none will-change-transform"
          style={{
            transform: isMotionBlur && blurAmount > 0.4 ? `rotate(${angleDeg.toFixed(2)}deg)` : 'none',
            filter: isMotionBlur && blurAmount > 0.4 ? 'url(#cursor-dir-motion-blur)' : 'none',
          }}
        >
          <div
            className="pointer-events-none will-change-transform"
            style={{
              transform: isMotionBlur && blurAmount > 0.4 ? `rotate(${-angleDeg.toFixed(2)}deg)` : 'none',
            }}
          >
            {isClicking ? (
              <HandCursorSvg theme={cursorConfig.theme} size={baseSize} />
            ) : (
              <CursorSvg theme={cursorConfig.theme} size={baseSize} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

/** Standard Arrow Cursor for normal navigation */
export const CursorSvg: React.FC<{ theme?: string; size: number }> = ({ theme = 'windows', size }) => {
  // Original Windows 11 Aero/Fluent Arrow (Extracted directly from C:\Windows\Cursors)
  if (theme === 'windows') {
    return (
      <img
        src={WINDOWS_ARROW_DATA_URL}
        alt="cursor"
        className="select-none pointer-events-none filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)]"
        style={{
          width: `${size}px`,
          height: `${size * (76 / 52)}px`,
        }}
        draggable={false}
      />
    );
  }

  // macOS Authentic Arrow (Extracted directly from Apple macOS cursor suite)
  if (theme === 'mac') {
    return (
      <img
        src={MACOS_ARROW_DATA_URL}
        alt="cursor"
        className="select-none pointer-events-none filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)]"
        style={{
          width: `${size * (76 / 52)}px`,
          height: `${size * (113 / 52)}px`,
        }}
        draggable={false}
      />
    );
  }

  // Touch Pointer: Translucent clean circle
  if (theme === 'touch') {
    return (
      <div
        className="rounded-full bg-white/85 border border-white shadow-[0_2px_8px_rgba(0,0,0,0.4)] flex items-center justify-center -translate-x-1/2 -translate-y-1/2"
        style={{ width: `${size * 0.9}px`, height: `${size * 0.9}px` }}
      >
        <div className="w-2.5 h-2.5 rounded-full bg-zinc-900" />
      </div>
    );
  }

  // Recorded Native Style: Blue-accented hollow arrow
  if (theme === 'recorded') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]"
      >
        <path
          d="M4 3L11.5 20.5L14.2 13.8L21 11L4 3Z"
          fill="#1e1e24"
          stroke="#60a5fa"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  // Default Fallback
  return (
    <img
      src={WINDOWS_ARROW_DATA_URL}
      alt="cursor"
      className="select-none pointer-events-none filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)]"
      style={{
        width: `${size}px`,
        height: `${size * (76 / 52)}px`,
      }}
      draggable={false}
    />
  );
};

/** Pointing Hand Click Cursor (Original authentic Windows hand matching reference media_1794244660380_9a38b9bc.png) */
export const HandCursorSvg: React.FC<{ theme?: string; size: number }> = ({ theme = 'windows', size }) => {
  // Original Windows 11 Aero/Fluent Pointing Hand (Extracted from C:\Windows\Cursors\aero_link.cur)
  if (theme === 'windows') {
    return (
      <img
        src={WINDOWS_LINK_DATA_URL}
        alt="pointer"
        className="select-none pointer-events-none filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)]"
        style={{
          width: `${size * (70 / 52)}px`,
          height: `${size * (92 / 52)}px`,
        }}
        draggable={false}
      />
    );
  }

  // macOS Authentic Pointing Hand (Apple Glove Hand matching Canvid & genuine macOS)
  if (theme === 'mac') {
    return (
      <img
        src={MACOS_LINK_DATA_URL}
        alt="pointer"
        className="select-none pointer-events-none filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)]"
        style={{
          width: `${size * (106 / 52)}px`,
          height: `${size * (112 / 52)}px`,
        }}
        draggable={false}
      />
    );
  }

  // Touch Theme: Pressed Dot with pulse
  if (theme === 'touch') {
    return (
      <div
        className="rounded-full bg-white border-2 border-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.6)] flex items-center justify-center -translate-x-1/2 -translate-y-1/2 scale-90"
        style={{ width: `${size * 0.95}px`, height: `${size * 0.95}px` }}
      >
        <div className="w-3.5 h-3.5 rounded-full bg-blue-500" />
      </div>
    );
  }

  // Recorded Theme: Blue styled hand cursor
  if (theme === 'recorded') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]"
      >
        <path
          d="M8.5 1.5C7.7 1.5 7 2.2 7 3V11L5.5 9.8C4.8 9.2 3.8 9.4 3.2 10.1C2.6 10.8 2.8 11.8 3.5 12.4L7.5 16.5C8.9 17.9 10.8 18.7 12.8 18.7H14.5C17 18.7 19 16.7 19 14.2V8.5C19 7.7 18.3 7 17.5 7C17.3 7 17.1 7.04 16.9 7.12C16.6 6.46 15.9 6 15.1 6C14.9 6 14.7 6.04 14.5 6.12C14.2 5.46 13.5 5 12.7 5C12.5 5 12.3 5.04 12.1 5.12V3C12.1 2.2 11.4 1.5 10.6 1.5H8.5Z"
          fill="#1E293B"
          stroke="#60A5FA"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <path d="M12.1 8V12" stroke="#60A5FA" strokeWidth="1.2" strokeLinecap="round" />
        <path d="M14.5 8.5V12" stroke="#60A5FA" strokeWidth="1.2" strokeLinecap="round" />
        <path d="M16.9 9V12" stroke="#60A5FA" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    );
  }

  // Default: Original Windows 11 Aero Link Hand
  return (
    <img
      src={WINDOWS_LINK_DATA_URL}
      alt="pointer"
      className="select-none pointer-events-none filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)]"
      style={{
        width: `${size * (70 / 52)}px`,
        height: `${size * (92 / 52)}px`,
      }}
      draggable={false}
    />
  );
};
