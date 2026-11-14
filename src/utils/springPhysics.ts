import type { CursorConfig, MouseEventRecord, ZoomConfig, ZoomKeyframe } from '../types/canvid';

const SPRING_MASS = 4.0;
const SIM_DT = 0.002; // 2ms integration step for unconditional numerical stability

export const CURSOR_STYLE_PRESETS: Record<
  'molasses' | 'default' | 'gentle' | 'stiff',
  { tension: number; friction: number }
> = {
  molasses: { tension: 180, friction: 100 },
  default: { tension: 470, friction: 70 },
  gentle: { tension: 320, friction: 80 },
  stiff: { tension: 600, friction: 50 },
};

export const ZOOM_STYLE_PRESETS: Record<
  'molasses' | 'default' | 'gentle' | 'stiff',
  { tension: number; friction: number }
> = {
  molasses: { tension: 140, friction: 160 },
  default: { tension: 280, friction: 120 },
  gentle: { tension: 220, friction: 140 },
  stiff: { tension: 420, friction: 90 },
};

/**
 * Evaluates a normalized 0 -> 1 step response for a 2nd-order damped harmonic oscillator
 * (m * x'' + friction * x' + tension * (x - 1) = 0, x(0) = 0, x'(0) = 0).
 */
export function computeSpringCurveSamples(
  tension: number,
  friction: number,
  durationSec = 1.6,
  sampleCount = 80
): { t: number; value: number }[] {
  const k = Math.max(20, tension);
  const c = Math.max(4, friction);
  const kOverM = k / SPRING_MASS;
  const cOverM = c / SPRING_MASS;

  const samples: { t: number; value: number }[] = [];
  let x = 0;
  let v = 0;
  let simTime = 0;

  for (let i = 0; i <= sampleCount; i++) {
    const targetTime = (i / sampleCount) * durationSec;
    while (simTime < targetTime - 1e-6) {
      const step = Math.min(SIM_DT, targetTime - simTime);
      const accel = kOverM * (1 - x) - cOverM * v;
      v += accel * step;
      x += v * step;
      simTime += step;
    }
    samples.push({ t: i / sampleCount, value: x });
  }

  return samples;
}

/**
 * Estimates natural 98% settling time in milliseconds for a spring configuration.
 */
export function estimateSpringSettleMs(tension: number, friction: number): number {
  const k = Math.max(20, tension);
  const c = Math.max(4, friction);
  const omega0 = Math.sqrt(k / SPRING_MASS);
  const zeta = c / (2 * Math.sqrt(k * SPRING_MASS));

  if (zeta < 0.99) {
    // Underdamped envelope decay: exp(-zeta * omega0 * t) = 0.02 -> ~3.91 / (zeta * omega0)
    const ms = (3.9 / Math.max(0.2, zeta * omega0)) * 1000;
    return Math.max(240, Math.min(1400, ms));
  }
  // Overdamped slow eigenvalue: r1 = omega0 * (zeta - sqrt(zeta^2 - 1))
  const slowPole = Math.max(0.4, omega0 * (zeta - Math.sqrt(Math.max(0, zeta * zeta - 1))));
  const ms = (3.6 / slowPole) * 1000;
  return Math.max(300, Math.min(1800, ms));
}

/**
 * Single point evaluation of the spring step response at elapsedSec (0..settleSec).
 */
export function evaluateSpringStep(
  elapsedSec: number,
  tension: number,
  friction: number
): number {
  if (elapsedSec <= 0) return 0;
  const k = Math.max(20, tension);
  const c = Math.max(4, friction);
  const kOverM = k / SPRING_MASS;
  const cOverM = c / SPRING_MASS;

  const clampedTime = Math.min(3.0, elapsedSec);
  let x = 0;
  let v = 0;
  let t = 0;
  while (t < clampedTime - 1e-6) {
    const dt = Math.min(SIM_DT, clampedTime - t);
    const accel = kOverM * (1 - x) - cOverM * v;
    v += accel * dt;
    x += v * dt;
    t += dt;
  }
  return x;
}

/**
 * Binary searches and evaluates raw (or Catmull-Rom smoothed) mouse coordinates at curMs.
 */
function lookupMouseAtTime(
  events: MouseEventRecord[],
  curMs: number,
  hintIdx: number,
  useCatmullRom: boolean,
  screenWidth: number,
  screenHeight: number
): { x: number; y: number; vx: number; vy: number; idx: number; cursor: 'arrow' | 'hand' | 'ibeam' } {
  if (!events || events.length === 0) {
    const t = (curMs / 1000) * 0.85;
    const x = screenWidth * 0.5 + Math.sin(t) * (screenWidth * 0.32);
    const y = screenHeight * 0.5 + Math.sin(t * 1.7) * (screenHeight * 0.24);
    const velX = Math.cos(t) * 20;
    const velY = Math.cos(t * 1.7) * 16;
    return { x, y, vx: velX, vy: velY, idx: 0, cursor: 'arrow' };
  }

  const len = events.length;
  let idx = Math.max(0, Math.min(len - 1, hintIdx));

  if (events[idx].t_ms < curMs) {
    while (idx < len - 1 && events[idx].t_ms < curMs) idx++;
  } else {
    let low = 0;
    let high = len - 1;
    while (low <= high) {
      const mid = (low + high) >> 1;
      if (events[mid].t_ms < curMs) low = mid + 1;
      else high = mid - 1;
    }
    idx = Math.max(0, Math.min(len - 1, low));
  }

  const p0 = events[Math.max(0, idx - 2)];
  const p1 = events[Math.max(0, idx - 1)];
  const p2 = events[idx];
  const p3 = events[Math.min(len - 1, idx + 1)];

  let x = p2.x;
  let y = p2.y;
  let vx = 0;
  let vy = 0;

  if (p1 && p2 && p2.t_ms > p1.t_ms) {
    const dt = Math.max(1, p2.t_ms - p1.t_ms);
    vx = ((p2.x - p1.x) / dt) * 16.6;
    vy = ((p2.y - p1.y) / dt) * 16.6;

    if (useCatmullRom) {
      const t = Math.max(0, Math.min(1, (curMs - p1.t_ms) / (p2.t_ms - p1.t_ms)));
      const t2 = t * t;
      const t3 = t2 * t;

      x =
        0.5 *
        (2 * p1.x +
          (-p0.x + p2.x) * t +
          (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
          (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3);

      y =
        0.5 *
        (2 * p1.y +
          (-p0.y + p2.y) * t +
          (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
          (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3);
    } else if (curMs <= p1.t_ms) {
      x = p1.x;
      y = p1.y;
    } else {
      const t = Math.max(0, Math.min(1, (curMs - p1.t_ms) / (p2.t_ms - p1.t_ms)));
      x = p1.x + (p2.x - p1.x) * t;
      y = p1.y + (p2.y - p1.y) * t;
    }
  }

  const cursorRole = (p1 && curMs < p2.t_ms ? p1.cursor : p2.cursor) || 'arrow';
  return { x, y, vx, vy, idx, cursor: cursorRole };
}

/**
 * Deterministic spring-filtered cursor position & velocity at curMs.
 */
function sampleSpringPosition(
  events: MouseEventRecord[],
  curMs: number,
  cursorConfig: CursorConfig,
  screenWidth: number,
  screenHeight: number
): { x: number; y: number; vx: number; vy: number; speed: number; idx: number; cursor: 'arrow' | 'hand' | 'ibeam' } {
  const smoothing = cursorConfig.smoothing !== false;

  if (!smoothing || !events || events.length === 0) {
    const raw = lookupMouseAtTime(events, curMs, 0, smoothing, screenWidth, screenHeight);
    return {
      x: raw.x,
      y: raw.y,
      vx: raw.vx,
      vy: raw.vy,
      speed: Math.sqrt(raw.vx * raw.vx + raw.vy * raw.vy),
      idx: raw.idx,
      cursor: raw.cursor,
    };
  }

  const preset = CURSOR_STYLE_PRESETS[cursorConfig.animationStyle || 'default'];
  const tension = cursorConfig.tension ?? preset.tension;
  const friction = cursorConfig.friction ?? preset.friction;
  const kOverM = Math.max(20, tension) / SPRING_MASS;
  const cOverM = Math.max(4, friction) / SPRING_MASS;

  // Simulate deterministic causal spring window over past 1400ms in 8ms substeps
  const lookbackMs = Math.min(curMs, 1400);
  const startMs = Math.max(0, curMs - lookbackMs);
  const init = lookupMouseAtTime(events, startMs, 0, true, screenWidth, screenHeight);

  let sx = init.x;
  let sy = init.y;
  // Convert px-per-16.6ms to px-per-second for ODE
  let svx = (init.vx / 16.6) * 1000;
  let svy = (init.vy / 16.6) * 1000;
  let hintIdx = init.idx;

  const stepMs = 8;
  let tMs = startMs;
  while (tMs < curMs - 0.1) {
    const nextMs = Math.min(curMs, tMs + stepMs);
    const dtSec = (nextMs - tMs) / 1000;
    const target = lookupMouseAtTime(events, nextMs, hintIdx, true, screenWidth, screenHeight);
    hintIdx = target.idx;

    const ax = kOverM * (target.x - sx) - cOverM * svx;
    const ay = kOverM * (target.y - sy) - cOverM * svy;
    svx += ax * dtSec;
    svy += ay * dtSec;
    sx += svx * dtSec;
    sy += svy * dtSec;

    tMs = nextMs;
  }

  const endRaw = lookupMouseAtTime(events, curMs, hintIdx, true, screenWidth, screenHeight);
  // Convert velocity back to px per 60fps frame (16.6ms)
  const frameVx = (svx / 1000) * 16.6;
  const frameVy = (svy / 1000) * 16.6;
  const speed = Math.sqrt(frameVx * frameVx + frameVy * frameVy);

  return {
    x: sx,
    y: sy,
    vx: frameVx,
    vy: frameVy,
    speed,
    idx: endRaw.idx,
    cursor: endRaw.cursor,
  };
}

export interface ActiveRipple {
  id: number;
  x: number;
  y: number;
  progress: number; // 0..1 eased primary wave
  rawProgress: number; // 0..1 linear time
  secondaryProgress: number; // 0..1 trailing secondary wave
}

export interface SampledCursorResult {
  x: number;
  y: number;
  vx: number;
  vy: number;
  speed: number;
  isClicking: boolean;
  showHand: boolean;
  clickScale: number;
  tiltDeg: number;
  activeRipples: ActiveRipple[];
}

export function sampleCursorState(
  events: MouseEventRecord[],
  currentTimeMs: number,
  cursorConfig: CursorConfig,
  screenWidth = 1920,
  screenHeight = 1080
): SampledCursorResult {
  const pos = sampleSpringPosition(events, currentTimeMs, cursorConfig, screenWidth, screenHeight);

  let isClicking = false;
  let clickScale = 1.0;
  const activeRipples: ActiveRipple[] = [];

  if (events && events.length > 0) {
    // Scan neighborhood around current timestamp index for click events
    const startIdx = Math.max(0, pos.idx - 40);
    const endIdx = Math.min(events.length - 1, pos.idx + 12);

    const RIPPLE_DUR = 460;
    const CLICK_PRESS_DUR = 260;
    let minElapsedForPress = Infinity;

    for (let i = startIdx; i <= endIdx; i++) {
      const ev = events[i];
      if (!ev || (ev.event_type !== 'lclick' && ev.event_type !== 'rclick')) continue;

      const delta = currentTimeMs - ev.t_ms;

      // Active pointer switch window (-25ms..220ms)
      if (delta >= -25 && delta <= 220) {
        isClicking = true;
      }

      // Mouse click press-down zoom-in / zoom-out curve (0..260ms)
      if (delta >= 0 && delta <= CLICK_PRESS_DUR && delta < minElapsedForPress) {
        minElapsedForPress = delta;
      }

      // Active expanding screen ripples (0..460ms)
      if (delta >= 0 && delta <= RIPPLE_DUR) {
        const rawP = delta / RIPPLE_DUR;
        const easedP = 1 - Math.pow(1 - rawP, 3);
        const secRaw = delta > 75 ? (delta - 75) / (RIPPLE_DUR - 75) : 0;
        const secEased = secRaw > 0 ? 1 - Math.pow(1 - secRaw, 2.5) : 0;

        // Place ripple directly where the cursor sits at click timestamp
        const origin = sampleSpringPosition(events, ev.t_ms, cursorConfig, screenWidth, screenHeight);
        activeRipples.push({
          id: i,
          x: origin.x,
          y: origin.y,
          progress: easedP,
          rawProgress: rawP,
          secondaryProgress: secEased,
        });
      }
    }

    if (minElapsedForPress <= CLICK_PRESS_DUR) {
      if (minElapsedForPress <= 80) {
        // Press down smoothly from 1.0 -> 0.72
        const p = minElapsedForPress / 80;
        clickScale = 1.0 - 0.28 * Math.sin((p * Math.PI) / 2);
      } else {
        // Spring rebound 0.72 -> 1.05 -> 1.00 (exact 1.0 at p=1)
        const p = (minElapsedForPress - 80) / (CLICK_PRESS_DUR - 80);
        const overshoot = Math.exp(-2.8 * p) * Math.cos(Math.PI * 1.5 * p);
        clickScale = 1.0 - 0.28 * overshoot;
      }
    }
  }

  const showHand = !cursorConfig.alwaysDefault && (pos.cursor === 'hand' || pos.cursor === 'ibeam');
  const tiltDeg = cursorConfig.tilt ? Math.max(-16, Math.min(16, pos.vx * 0.38)) : 0;

  return {
    x: pos.x,
    y: pos.y,
    vx: pos.vx,
    vy: pos.vy,
    speed: pos.speed,
    isClicking,
    showHand,
    clickScale,
    tiltDeg,
    activeRipples,
  };
}

export interface CameraZoomState {
  level: number;
  transX: number;
  transY: number;
  vLevel: number;
  vTransX: number;
  vTransY: number;
  motionBlurPx: number;
}

/**
 * Continuous causal 2nd-order camera gimbal spring solver used 1:1 by StudioViewport and exportEngine.
 */
export function computeCameraZoom(
  curMs: number,
  zooms: ZoomKeyframe[],
  cursorFocal: { x: number; y: number } | null,
  zoomConfig?: ZoomConfig,
  mouseEvents?: MouseEventRecord[],
  sourceWidth = 1920,
  sourceHeight = 1080
): CameraZoomState {
  if (!zooms || zooms.length === 0) {
    return { level: 1.0, transX: 0, transY: 0, vLevel: 0, vTransX: 0, vTransY: 0, motionBlurPx: 0 };
  }

  const preset = ZOOM_STYLE_PRESETS[zoomConfig?.animationStyle || 'default'];
  const tension = Math.max(30, zoomConfig?.tension ?? preset.tension);
  const friction = Math.max(8, zoomConfig?.friction ?? preset.friction);

  const zoomMass = 3.2;
  const kZoom = tension / zoomMass;
  const cZoom = friction / zoomMass;

  // Heavy cinema fluid-head damping for focal pan so camera glides without jitter
  const panMass = 5.0;
  const kPan = (tension * 0.72) / panMass;
  const cPan = (friction * 1.35) / panMass;

  const lookbackMs = Math.min(Math.max(0, curMs), 2400);
  const startMs = Math.max(0, curMs - lookbackMs);
  const stepMs = 8;

  let level = 1.0;
  let vLevel = 0;
  let transX = 0;
  let vTransX = 0;
  let transY = 0;
  let vTransY = 0;
  let hintIdx = 0;

  let tMs = startMs;
  while (tMs < curMs - 0.1) {
    const nextMs = Math.min(curMs, tMs + stepMs);
    const dtSec = (nextMs - tMs) / 1000;

    const z = zooms.find((zk) => !zk.disabled && nextMs >= zk.start && nextMs <= zk.end);
    const zoomOutLeadMs = z ? Math.min(360, Math.max(120, (z.end - z.start) * 0.28)) : 0;

    let targetLevel = 1.0;
    let targetTransX = 0;
    let targetTransY = 0;

    if (z && nextMs <= z.end - zoomOutLeadMs) {
      targetLevel = Math.max(1.0, z.level);

      let fx = z.focal_x ?? 0.5;
      let fy = z.focal_y ?? 0.5;
      const zMode = (z as { mode?: string }).mode;

      if (zMode !== 'manual') {
        if (mouseEvents && mouseEvents.length > 0) {
          const raw = lookupMouseAtTime(mouseEvents, nextMs, hintIdx, true, sourceWidth, sourceHeight);
          hintIdx = raw.idx;
          fx = Math.max(0.05, Math.min(0.95, raw.x / Math.max(1, sourceWidth)));
          fy = Math.max(0.05, Math.min(0.95, raw.y / Math.max(1, sourceHeight)));
        } else if (cursorFocal) {
          fx = Math.max(0.05, Math.min(0.95, cursorFocal.x));
          fy = Math.max(0.05, Math.min(0.95, cursorFocal.y));
        }
      }

      const maxTargetOffset = 50 * (1 - 1 / targetLevel);
      targetTransX = Math.max(-maxTargetOffset, Math.min(maxTargetOffset, (0.5 - fx) * 100));
      targetTransY = Math.max(-maxTargetOffset, Math.min(maxTargetOffset, (0.5 - fy) * 100));
    }

    const aLevel = kZoom * (targetLevel - level) - cZoom * vLevel;
    vLevel += aLevel * dtSec;
    level += vLevel * dtSec;

    const aTransX = kPan * (targetTransX - transX) - cPan * vTransX;
    const aTransY = kPan * (targetTransY - transY) - cPan * vTransY;
    vTransX += aTransX * dtSec;
    vTransY += aTransY * dtSec;
    transX += vTransX * dtSec;
    transY += vTransY * dtSec;

    tMs = nextMs;
  }

  const finalLevel = Math.max(1.0, level);
  const maxOffset = 50 * (1 - 1 / finalLevel);
  const finalTransX = Math.max(-maxOffset, Math.min(maxOffset, transX));
  const finalTransY = Math.max(-maxOffset, Math.min(maxOffset, transY));

  const motionBlurPx = 0;

  return {
    level: finalLevel,
    transX: finalTransX,
    transY: finalTransY,
    vLevel,
    vTransX,
    vTransY,
    motionBlurPx,
  };
}
