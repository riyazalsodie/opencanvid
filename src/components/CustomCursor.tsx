import React, { useMemo } from 'react';
import type { CursorConfig, MouseEventRecord } from '../types/canvid';
import {
  WINDOWS_ARROW_DATA_URL,
  WINDOWS_LINK_DATA_URL,
  MACOS_ARROW_DATA_URL,
  MACOS_LINK_DATA_URL,
} from '../utils/cursorAssets';
import { sampleCursorState } from '../utils/springPhysics';

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
  const sampled = useMemo(() => {
    if (!cursorConfig.visible) return null;
    return sampleCursorState(mouseEvents, currentTimeMs, cursorConfig, screenWidth, screenHeight);
  }, [mouseEvents, currentTimeMs, cursorConfig, screenWidth, screenHeight]);

  if (!cursorConfig.visible || !sampled) return null;

  const leftPercent = (sampled.x / screenWidth) * 100;
  const topPercent = (sampled.y / screenHeight) * 100;
  const scaleFactor = cursorConfig.scale ?? 1.0;
  const baseSize = 12 * scaleFactor;
  const maxRippleDiameter = Math.max(32, 48 * scaleFactor);

  // Real Directional Linear Motion Blur aligned along spring trajectory velocity
  const isMotionBlur = cursorConfig.motionBlur !== false && sampled.speed > 2.0 && !sampled.isClicking;
  const blurAmount = isMotionBlur ? Math.min(10.0, Math.max(0, (sampled.speed - 2.0) * 0.16)) : 0;
  const angleRad = isMotionBlur ? Math.atan2(sampled.vy, sampled.vx) : 0;
  const angleDeg = (angleRad * 180) / Math.PI;

  // Slight trailing bias along direction of motion for realistic camera shutter exposure
  const trailBiasX = isMotionBlur && sampled.speed > 0 ? -(sampled.vx / sampled.speed) * (blurAmount * 0.45) : 0;
  const trailBiasY = isMotionBlur && sampled.speed > 0 ? -(sampled.vy / sampled.speed) * (blurAmount * 0.45) : 0;

  // Hotspot alignment (translates cursor image so tip/fingertip sits at exact 0,0 hotspot)
  const theme = cursorConfig.theme || 'windows';
  const isWindows = theme === 'windows';
  const isMac = theme === 'mac';

  let hotspotTranslate = 'translate(0%, 0%)';
  if (sampled.showHand) {
    if (isWindows) {
      hotspotTranslate = 'translate(-35.71%, 0%)';
    } else if (isMac) {
      hotspotTranslate = 'translate(-33.96%, -11.61%)';
    } else if (theme === 'touch') {
      hotspotTranslate = 'translate(0%, 0%)';
    } else {
      hotspotTranslate = 'translate(-35.4%, -6.25%)';
    }
  } else {
    if (isWindows) {
      hotspotTranslate = 'translate(0%, 0%)';
    } else if (isMac) {
      hotspotTranslate = 'translate(-17.11%, -9.73%)';
    } else if (theme === 'touch') {
      hotspotTranslate = 'translate(0%, 0%)';
    } else {
      hotspotTranslate = 'translate(-3px, -3px)';
    }
  }

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-40">
      {/* Real Screen Click Ripple Waves (Pinned at exact click coordinates on screen) */}
      {cursorConfig.clickEffect === 'ripple' &&
        sampled.activeRipples.map((rp) => {
          const rxPct = (rp.x / screenWidth) * 100;
          const ryPct = (rp.y / screenHeight) * 100;
          const d1 = 8 + rp.progress * maxRippleDiameter;
          const a1 = Math.pow(Math.max(0, 1 - rp.rawProgress), 1.5);
          const d2 = 6 + rp.secondaryProgress * (maxRippleDiameter * 0.72);
          const a2 = Math.pow(Math.max(0, 1 - rp.secondaryProgress), 1.6) * 0.65;

          return (
            <React.Fragment key={rp.id}>
              {/* Outer Refractive Water-Wave Crest */}
              <div
                className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none"
                style={{
                  left: `${rxPct}%`,
                  top: `${ryPct}%`,
                  width: `${d1.toFixed(1)}px`,
                  height: `${d1.toFixed(1)}px`,
                  background: `radial-gradient(circle, rgba(255,255,255,0) 56%, rgba(255,255,255,${(a1 * 0.22).toFixed(3)}) 78%, rgba(255,255,255,${(a1 * 0.68).toFixed(3)}) 92%, rgba(0,0,0,${(a1 * 0.24).toFixed(3)}) 100%)`,
                  boxShadow: `0 0 0 1px rgba(255,255,255,${(a1 * 0.78).toFixed(3)}), 0 0 10px rgba(255,255,255,${(a1 * 0.25).toFixed(3)}), inset 0 0 0 1px rgba(0,0,0,${(a1 * 0.18).toFixed(3)})`,
                }}
              />

              {/* Secondary Trailing Wave Crest */}
              {rp.secondaryProgress > 0 && (
                <div
                  className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none"
                  style={{
                    left: `${rxPct}%`,
                    top: `${ryPct}%`,
                    width: `${d2.toFixed(1)}px`,
                    height: `${d2.toFixed(1)}px`,
                    boxShadow: `0 0 0 1px rgba(255,255,255,${(a2 * 0.65).toFixed(3)}), inset 0 0 0 0.75px rgba(0,0,0,${(a2 * 0.16).toFixed(3)})`,
                  }}
                />
              )}

              {/* Initial Impact Specular Glint */}
              {rp.rawProgress < 0.28 && (
                <div
                  className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none"
                  style={{
                    left: `${rxPct}%`,
                    top: `${ryPct}%`,
                    width: `${(8 + rp.rawProgress * 28 * scaleFactor).toFixed(1)}px`,
                    height: `${(8 + rp.rawProgress * 28 * scaleFactor).toFixed(1)}px`,
                    background: `radial-gradient(circle, rgba(255,255,255,${((1 - rp.rawProgress / 0.28) * 0.45).toFixed(3)}) 0%, rgba(255,255,255,0) 72%)`,
                  }}
                />
              )}
            </React.Fragment>
          );
        })}

      {/* SVG Directional Motion Blur Filter Definition */}
      {isMotionBlur && blurAmount > 0.4 && (
        <svg className="absolute w-0 h-0 pointer-events-none overflow-hidden" aria-hidden="true">
          <defs>
            <filter id="cursor-dir-motion-blur" x="-200%" y="-200%" width="500%" height="500%">
              <feGaussianBlur in="SourceGraphic" stdDeviation={`${blurAmount.toFixed(2)} 0`} />
            </filter>
          </defs>
        </svg>
      )}

      {/* Main Single Cursor Element positioned at exact hotspot */}
      <div
        className="absolute pointer-events-none will-change-transform"
        style={{
          left: `${leftPercent}%`,
          top: `${topPercent}%`,
          transformOrigin: '0% 0%',
          transform: `translate(${trailBiasX.toFixed(2)}px, ${trailBiasY.toFixed(2)}px) scale(${sampled.clickScale.toFixed(4)}) rotate(${sampled.tiltDeg.toFixed(2)}deg)`,
        }}
      >
        <div
          className="pointer-events-none"
          style={{
            transform: hotspotTranslate,
          }}
        >
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
              {sampled.showHand ? (
                <HandCursorSvg theme={cursorConfig.theme} size={baseSize} />
              ) : (
                <CursorSvg theme={cursorConfig.theme} size={baseSize} />
              )}
            </div>
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
    const outer = size * 0.95;
    const inner = Math.max(2, outer * 0.36);
    return (
      <div
        className="rounded-full bg-white/85 border border-white shadow-[0_2px_8px_rgba(0,0,0,0.4)] flex items-center justify-center -translate-x-1/2 -translate-y-1/2"
        style={{ width: `${outer}px`, height: `${outer}px` }}
      >
        <div
          className="rounded-full bg-zinc-900"
          style={{ width: `${inner}px`, height: `${inner}px` }}
        />
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

  // Touch Theme: Pressed Dot
  if (theme === 'touch') {
    const outer = size * 0.95;
    const inner = Math.max(2, outer * 0.44);
    return (
      <div
        className="rounded-full bg-white border border-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.6)] flex items-center justify-center -translate-x-1/2 -translate-y-1/2"
        style={{ width: `${outer}px`, height: `${outer}px` }}
      >
        <div
          className="rounded-full bg-blue-500"
          style={{ width: `${inner}px`, height: `${inner}px` }}
        />
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
