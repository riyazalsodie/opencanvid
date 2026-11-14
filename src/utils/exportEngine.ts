import type { ProjectState, VideoClip } from '../types/canvid';
import {
  WINDOWS_ARROW_DATA_URL,
  WINDOWS_LINK_DATA_URL,
  MACOS_ARROW_DATA_URL,
  MACOS_LINK_DATA_URL,
} from './cursorAssets';
import { TauriBridge } from './tauriBridge';
import { sampleCursorState, computeCameraZoom } from './springPhysics';

export interface ExportProgress {
  progress: number; // 0 to 100
  status: 'preparing' | 'rendering' | 'saving' | 'done' | 'error';
  message: string;
  outputPath?: string;
  error?: string;
}

// 100% Cross-Browser Anti-Aliased Rounded Rect Path
function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  if (typeof (ctx as any).roundRect === 'function') {
    (ctx as any).roundRect(x, y, w, h, radius);
  } else {
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.arcTo(x + w, y, x + w, y + radius, radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.arcTo(x + w, y + h, x + w - radius, y + h, radius);
    ctx.lineTo(x + radius, y + h);
    ctx.arcTo(x, y + h, x, y + h - radius, radius);
    ctx.lineTo(x, y + radius);
    ctx.arcTo(x, y, x + radius, y, radius);
    ctx.closePath();
  }
}

// Draw Image with object-fit: cover (matching CSS backgroundSize: 'cover')
function drawImageCover(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  imgW: number,
  imgH: number,
  x: number,
  y: number,
  w: number,
  h: number
) {
  if (imgW <= 0 || imgH <= 0 || w <= 0 || h <= 0) return;
  const imgRatio = imgW / imgH;
  const targetRatio = w / h;
  let sWidth = imgW;
  let sHeight = imgH;
  let sx = 0;
  let sy = 0;

  if (imgRatio > targetRatio) {
    sWidth = imgH * targetRatio;
    sx = (imgW - sWidth) / 2;
  } else {
    sHeight = imgW / targetRatio;
    sy = (imgH - sHeight) / 2;
  }
  ctx.drawImage(img, sx, sy, sWidth, sHeight, x, y, w, h);
}

// Draw Image / Video with object-fit: contain (matching StudioViewport <video className="object-contain" />)
function drawImageContain(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  imgW: number,
  imgH: number,
  x: number,
  y: number,
  w: number,
  h: number
) {
  if (imgW <= 0 || imgH <= 0 || w <= 0 || h <= 0) return;
  const imgRatio = imgW / imgH;
  const targetRatio = w / h;
  let dWidth = w;
  let dHeight = h;
  let dx = x;
  let dy = y;

  if (imgRatio > targetRatio) {
    dHeight = w / imgRatio;
    dy = y + (h - dHeight) / 2;
  } else {
    dWidth = h * imgRatio;
    dx = x + (w - dWidth) / 2;
  }
  ctx.drawImage(img, 0, 0, imgW, imgH, dx, dy, dWidth, dHeight);
}

export async function exportFinalEditedVideo(
  project: ProjectState,
  onProgress: (p: ExportProgress) => void,
  existingVideoElement?: HTMLVideoElement | null,
  existingCamElement?: HTMLVideoElement | null
): Promise<{ success: boolean; filePath?: string; error?: string }> {
  if (!project.videoUrl && !existingVideoElement) {
    return { success: false, error: 'No video recording found to export.' };
  }

  onProgress({
    progress: 5,
    status: 'preparing',
    message: 'Preparing studio canvas & assets...',
  });

  let tempDir = '';
  let video: HTMLVideoElement | null = null;
  let camVideo: HTMLVideoElement | null = null;
  let objectUrlToRevoke: string | null = null;
  let hiddenContainer: HTMLDivElement | null = null;

  try {
    // Read user quick export preferences if set
    let savedSettings: any = {};
    try {
      const raw = localStorage.getItem('canvid_export_settings');
      if (raw) savedSettings = JSON.parse(raw);
    } catch {}

    const fps = savedSettings.frameRate === 30 ? 30 : 60;

    // 1. Prepare Export Session in Electron
    const sessionRes = await TauriBridge.prepareExportSession();
    if (!sessionRes.success || !sessionRes.tempDir) {
      throw new Error('Failed to create export session directory.');
    }
    tempDir = sessionRes.tempDir;

    // 2. Extract Source File Path for Native Audio Extraction
    let sourceVideoPath: string | undefined = undefined;
    if (project.videoUrl?.startsWith('media://local?path=')) {
      try {
        const u = new URL(project.videoUrl);
        sourceVideoPath = decodeURIComponent(u.searchParams.get('path') || '');
      } catch {}
    }

    // 3. Determine target resolution based on Aspect Ratio
    let targetW = 1920;
    let targetH = 1080;
    const resPreset = savedSettings.resolution || '1080p';
    let baseDim = 1080;
    if (resPreset === '4K') baseDim = 2160;
    else if (resPreset === '1440p') baseDim = 1440;
    else if (resPreset === '720p') baseDim = 720;

    switch (project.aspectRatio) {
      case '9:16':
        targetW = baseDim;
        targetH = Math.round((baseDim * 16) / 9);
        break;
      case '1:1':
        targetW = baseDim;
        targetH = baseDim;
        break;
      case '4:3':
        targetW = Math.round((baseDim * 4) / 3);
        targetH = baseDim;
        break;
      case '16:9':
      default:
        targetW = Math.round((baseDim * 16) / 9);
        targetH = baseDim;
        break;
    }

    // 4. Dedicated Offscreen Rendering Canvas
    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Could not create canvas 2D rendering context.');

    // 5. Preload Genuine Cursors
    const winArrow = new Image(); winArrow.src = WINDOWS_ARROW_DATA_URL;
    const winLink = new Image(); winLink.src = WINDOWS_LINK_DATA_URL;
    const macArrow = new Image(); macArrow.src = MACOS_ARROW_DATA_URL;
    const macHand = new Image(); macHand.src = MACOS_LINK_DATA_URL;

    // Preload Wallpaper if image
    let bgImg: HTMLImageElement | null = null;
    if (project.background.type === 'image' && project.background.value) {
      bgImg = new Image();
      bgImg.crossOrigin = 'anonymous';
      let val = project.background.value;
      if (val.startsWith('./')) {
        try {
          val = new URL(val, window.location.href).href;
        } catch {
          val = '/' + val.slice(2);
        }
      }
      bgImg.src = val;
    }

    await Promise.all([
      new Promise((r) => { winArrow.onload = r; winArrow.onerror = r; }),
      new Promise((r) => { winLink.onload = r; winLink.onerror = r; }),
      new Promise((r) => { macArrow.onload = r; macArrow.onerror = r; }),
      new Promise((r) => { macHand.onload = r; macHand.onerror = r; }),
      bgImg ? new Promise((r) => {
        if (bgImg!.complete) return r(null);
        bgImg!.onload = () => r(null);
        bgImg!.onerror = () => r(null);
        setTimeout(r, 1500);
      }) : Promise.resolve(),
    ]);

    // 6. Set up Dedicated Video Element for Deterministic Frame Seeking
    let videoSourceUrl = project.videoUrl || '';

    if (sourceVideoPath) {
      try {
        const fileBytes = await TauriBridge.readVideoFile(sourceVideoPath);
        if (fileBytes && fileBytes.length > 0) {
          const blob = new Blob([fileBytes.buffer as ArrayBuffer], { type: 'video/mp4' });
          objectUrlToRevoke = URL.createObjectURL(blob);
          videoSourceUrl = objectUrlToRevoke;
        }
      } catch (err) {
        console.warn('Could not read file directly to blob URL:', err);
      }
    }

    video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.playsInline = true;
    video.muted = true;
    video.preload = 'auto';
    video.src = videoSourceUrl;

    // Attach to hidden DOM container for hardware acceleration & reliable frame callbacks
    hiddenContainer = document.createElement('div');
    hiddenContainer.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:2px;height:2px;opacity:0;pointer-events:none;overflow:hidden;';
    hiddenContainer.appendChild(video);
    document.body.appendChild(hiddenContainer);

    await new Promise<void>((resolve, reject) => {
      let resolved = false;
      const v = video!;
      const onReady = () => {
        if (!resolved && v.readyState >= 2) {
          resolved = true;
          resolve();
        }
      };
      if (v.readyState >= 2) return resolve();
      v.addEventListener('loadeddata', onReady);
      v.addEventListener('canplay', onReady);
      v.onerror = () => {
        if (!resolved) {
          resolved = true;
          reject(new Error(`Failed loading source video: ${v?.error?.message || 'code ' + v?.error?.code}`));
        }
      };
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          resolve();
        }
      }, 4500);
    });

    if (project.webcam.enabled && Boolean(project.camUrl)) {
      if (existingCamElement && existingCamElement.readyState >= 1) {
        camVideo = existingCamElement;
      } else if (project.camUrl) {
        camVideo = document.createElement('video');
        camVideo.crossOrigin = 'anonymous';
        camVideo.playsInline = true;
        camVideo.muted = true;
        camVideo.src = project.camUrl;
        hiddenContainer.appendChild(camVideo);
        await new Promise<void>((resolve) => {
          if (camVideo!.readyState >= 1) return resolve();
          camVideo!.onloadedmetadata = () => resolve();
          camVideo!.onerror = () => resolve();
          setTimeout(resolve, 1500);
        });
      }
    }

    // 7. Calculate Timeline & Active Clips
    const safeDur = project.duration > 0 ? project.duration : 12;
    const clips: VideoClip[] = (project.clips && project.clips.length > 0)
      ? [...project.clips].sort((a, b) => a.start - b.start)
      : [{ id: 'clip-1', start: 0, end: safeDur, sourceStart: 0 }];

    const totalDurationSec = clips.reduce((acc, c) => acc + Math.max(0.05, c.end - c.start), 0);
    if (totalDurationSec <= 0) throw new Error('Video duration is 0.');

    const totalFrames = Math.max(1, Math.round(totalDurationSec * fps));

    // 8. Geometry & Scaling matching StudioViewport.tsx 1:1
    const videoOrigW = video.videoWidth || 1920;
    const videoOrigH = video.videoHeight || 1080;

    const userPadding = typeof project.padding === 'number' ? project.padding : 8;
    const paddingScale = Math.max(0.4, 1 - (userPadding / 100) * 1.4);
    const innerW = targetW * paddingScale;
    const innerH = targetH * paddingScale;
    const frameX = (targetW - innerW) / 2;
    const frameY = (targetH - innerH) / 2;

    const userRadius = typeof project.radius === 'number' ? project.radius : 12;
    const cornerRadius = Math.round(userRadius * (targetW / 960));

    const mouseEvents = project.mouseEvents || [];

    onProgress({
      progress: 10,
      status: 'rendering',
      message: `Rendering ${totalFrames} frames at ${fps} FPS...`,
    });

    // 9. Frame-by-Frame Deterministic Rendering Loop
    let frameBatch: { index: number; dataUrl: string }[] = [];

    // Seeking synchronizer using Chromium's requestVideoFrameCallback
    const seekVideoFrame = (vid: HTMLVideoElement, targetTime: number): Promise<void> => {
      return new Promise<void>((resolve) => {
        if (Math.abs(vid.currentTime - targetTime) < 0.006) {
          return resolve();
        }
        let resolved = false;
        const finish = () => {
          if (!resolved) {
            resolved = true;
            vid.removeEventListener('seeked', onSeeked);
            resolve();
          }
        };
        const onSeeked = () => {
          if ('requestVideoFrameCallback' in vid) {
            (vid as any).requestVideoFrameCallback(() => finish());
          } else {
            requestAnimationFrame(() => finish());
          }
        };
        vid.addEventListener('seeked', onSeeked, { once: true });
        vid.currentTime = targetTime;
        setTimeout(finish, 200);
      });
    };

    for (let frameIdx = 0; frameIdx < totalFrames; frameIdx++) {
      const currentTimelineSec = frameIdx / fps;

      // Map current timeline second to exact clip & source video time
      let runningSec = 0;
      let activeClip = clips[0];
      let clipOffsetSec = 0;

      for (let i = 0; i < clips.length; i++) {
        const c = clips[i];
        const d = Math.max(0.05, c.end - c.start);
        if (currentTimelineSec >= runningSec && currentTimelineSec < runningSec + d) {
          activeClip = c;
          clipOffsetSec = currentTimelineSec - runningSec;
          break;
        }
        if (i === clips.length - 1) {
          activeClip = c;
          clipOffsetSec = Math.min(d, currentTimelineSec - runningSec);
        }
        runningSec += d;
      }

      const videoTargetTime = activeClip.sourceStart + clipOffsetSec;

      // Deterministic Seek to frame timestamp
      await seekVideoFrame(video, videoTargetTime);

      const curMs = currentTimelineSec * 1000;
      const hasMouse = mouseEvents.length > 0;
      const sampled = hasMouse
        ? sampleCursorState(mouseEvents, curMs, project.cursor, videoOrigW, videoOrigH)
        : null;
      const cursorFocal = sampled
        ? { x: sampled.x / videoOrigW, y: sampled.y / videoOrigH }
        : null;

      // Clear canvas
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, targetW, targetH);

      // A. Draw Background Layer (Matching StudioViewport.tsx 1:1)
      ctx.save();
      if (bgImg && bgImg.complete && bgImg.naturalWidth > 0) {
        if (project.backgroundBlur && project.backgroundBlur > 0) {
          ctx.filter = `blur(${Math.max(8, project.backgroundBlur * 1.5)}px)`;
        } else {
          ctx.filter = 'none';
        }
        // Scale 1.06 to avoid edge blur bleed matching CSS transform: 'scale(1.06)'
        ctx.save();
        ctx.translate(targetW / 2, targetH / 2);
        ctx.scale(1.06, 1.06);
        ctx.translate(-targetW / 2, -targetH / 2);
        drawImageCover(ctx, bgImg, bgImg.naturalWidth, bgImg.naturalHeight, 0, 0, targetW, targetH);
        ctx.restore();
      } else if (project.background.type === 'gradient' && project.background.value) {
        ctx.filter = 'none';
        const gradColors = project.background.value.match(/(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\))/g);
        if (gradColors && gradColors.length >= 2) {
          const g = ctx.createLinearGradient(0, 0, targetW, targetH);
          g.addColorStop(0, gradColors[0]);
          g.addColorStop(1, gradColors[gradColors.length - 1]);
          ctx.fillStyle = g;
        } else {
          ctx.fillStyle = '#18181b';
        }
        ctx.fillRect(0, 0, targetW, targetH);
      } else if (project.background.type === 'color' && project.background.value && project.background.value.toLowerCase() !== '#000000') {
        ctx.filter = 'none';
        ctx.fillStyle = project.background.value;
        ctx.fillRect(0, 0, targetW, targetH);
      } else {
        // Canvid Signature Ambient Screen Blur
        ctx.filter = 'blur(48px) brightness(0.65) saturate(1.25)';
        ctx.drawImage(video, 0, 0, videoOrigW, videoOrigH, -40, -40, targetW + 80, targetH + 80);
      }
      ctx.restore();

      // B. Outer Soft Drop Shadow (Matching StudioViewport.tsx)
      if (project.shadowEnabled) {
        ctx.save();
        const shadowBlur = (typeof project.shadowBlur === 'number' ? project.shadowBlur : 35) * (targetW / 960);
        ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
        ctx.shadowBlur = shadowBlur;
        ctx.shadowOffsetY = shadowBlur / 2;
        ctx.fillStyle = '#000000';
        drawRoundedRect(ctx, frameX, frameY, innerW, innerH, cornerRadius);
        ctx.fill();
        ctx.restore();
      }

      // C. Video Container: Rounded Clip + Dynamic Camera Zoom
      ctx.save();
      drawRoundedRect(ctx, frameX, frameY, innerW, innerH, cornerRadius);
      ctx.clip();

      // Compute Camera Zoom & Pan
      const zoom = computeCameraZoom(curMs, project.zooms || [], cursorFocal, project.zoomConfig);

      ctx.save();
      // Match StudioViewport: transformOrigin: 50% 50%, transform: scale(level) translate(transX%, transY%)
      const originX = frameX + innerW / 2;
      const originY = frameY + innerH / 2;
      ctx.translate(originX, originY);
      ctx.scale(zoom.level, zoom.level);
      ctx.translate((zoom.transX / 100) * innerW, (zoom.transY / 100) * innerH);
      ctx.translate(-innerW / 2, -innerH / 2);

      // C. 1. Draw Video Frame with object-fit: contain
      drawImageContain(ctx, video, videoOrigW, videoOrigH, 0, 0, innerW, innerH);

      // C. 2. Draw Real Screen Ripples & Vector Cursor inside Same Camera Space
      if (project.cursor.visible && sampled) {
        const scaleFactor = project.cursor.scale ?? 1.0;
        const unitW = 22 * scaleFactor * (targetW / 1920) / zoom.level;

        // C. 2a. Real Multi-Wave Screen Ripple Effect (pinned at click coordinates)
        if (project.cursor.clickEffect === 'ripple' && sampled.activeRipples.length > 0) {
          const maxR = Math.max(18, 30 * scaleFactor) * (targetW / 1920) / zoom.level;
          const strokeScale = (targetW / 1920) / zoom.level;

          for (const rp of sampled.activeRipples) {
            const rx = (rp.x / videoOrigW) * innerW;
            const ry = (rp.y / videoOrigH) * innerH;
            const r1 = 4 * strokeScale + rp.progress * maxR;
            const a1 = Math.pow(Math.max(0, 1 - rp.rawProgress), 1.5);

            // Soft annular refractive sheen
            ctx.save();
            const grad = ctx.createRadialGradient(rx, ry, Math.max(0, r1 * 0.56), rx, ry, r1);
            grad.addColorStop(0, 'rgba(255, 255, 255, 0)');
            grad.addColorStop(0.55, `rgba(255, 255, 255, ${(a1 * 0.16).toFixed(3)})`);
            grad.addColorStop(0.85, `rgba(255, 255, 255, ${(a1 * 0.55).toFixed(3)})`);
            grad.addColorStop(1, `rgba(0, 0, 0, ${(a1 * 0.18).toFixed(3)})`);
            ctx.beginPath();
            ctx.arc(rx, ry, r1, 0, Math.PI * 2);
            ctx.fillStyle = grad;
            ctx.fill();

            // Primary bright wave crest + subtle contrast inner edge
            ctx.beginPath();
            ctx.arc(rx, ry, r1, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(255, 255, 255, ${(a1 * 0.82).toFixed(3)})`;
            ctx.lineWidth = 1.6 * strokeScale;
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(rx, ry, Math.max(0.5, r1 - 1.5 * strokeScale), 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(0, 0, 0, ${(a1 * 0.2).toFixed(3)})`;
            ctx.lineWidth = 1.0 * strokeScale;
            ctx.stroke();

            // Secondary trailing wave crest
            if (rp.secondaryProgress > 0) {
              const r2 = 3 * strokeScale + rp.secondaryProgress * (maxR * 0.72);
              const a2 = Math.pow(Math.max(0, 1 - rp.secondaryProgress), 1.6) * 0.65;
              ctx.beginPath();
              ctx.arc(rx, ry, r2, 0, Math.PI * 2);
              ctx.strokeStyle = `rgba(255, 255, 255, ${(a2 * 0.68).toFixed(3)})`;
              ctx.lineWidth = 1.2 * strokeScale;
              ctx.stroke();
            }

            // Initial impact specular flash
            if (rp.rawProgress < 0.28) {
              const flashR = Math.max(2, (4 + rp.rawProgress * 16 * scaleFactor) * strokeScale);
              const flashAlpha = (1 - rp.rawProgress / 0.28) * 0.45;
              const fGrad = ctx.createRadialGradient(rx, ry, 0, rx, ry, flashR);
              fGrad.addColorStop(0, `rgba(255, 255, 255, ${flashAlpha.toFixed(3)})`);
              fGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
              ctx.beginPath();
              ctx.arc(rx, ry, flashR, 0, Math.PI * 2);
              ctx.fillStyle = fGrad;
              ctx.fill();
            }
            ctx.restore();
          }
        }

        // C. 2b. Cursor Rendering with Click Zoom-In/Out, Tilt, & Directional Motion Blur
        const mouseCanvasX = (sampled.x / videoOrigW) * innerW;
        const mouseCanvasY = (sampled.y / videoOrigH) * innerH;
        const curTheme = project.cursor.theme || 'windows';
        const showHand = sampled.showHand;

        const isMotionBlur = project.cursor.motionBlur !== false && sampled.speed > 2.0 && !sampled.isClicking;
        const blurAmount = isMotionBlur ? Math.min(8.0, Math.max(0, (sampled.speed - 2.0) * 0.18)) : 0;

        const drawCursorAtHotspot = (cx: number, cy: number, alpha: number) => {
          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.translate(cx, cy);
          ctx.scale(sampled.clickScale, sampled.clickScale);
          if (sampled.tiltDeg !== 0) {
            ctx.rotate((sampled.tiltDeg * Math.PI) / 180);
          }

          if (curTheme === 'touch') {
            const radius = (unitW * 0.95) / 2;
            ctx.beginPath();
            ctx.arc(0, 0, radius, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
            ctx.fill();
            ctx.lineWidth = Math.max(1, unitW * 0.12);
            ctx.strokeStyle = showHand ? '#3b82f6' : '#ffffff';
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(0, 0, Math.max(1.5, radius * (showHand ? 0.44 : 0.36)), 0, Math.PI * 2);
            ctx.fillStyle = showHand ? '#3b82f6' : '#18181b';
            ctx.fill();
            ctx.restore();
            return;
          }

          const cursorImg = curTheme === 'mac'
            ? (showHand ? macHand : macArrow)
            : (showHand ? winLink : winArrow);

          let cursorW = unitW;
          let cursorH = unitW * (76 / 52);
          let hotspotOffsetX = 0;
          let hotspotOffsetY = 0;

          if (showHand) {
            if (curTheme === 'mac') {
              cursorW = unitW * (106 / 52);
              cursorH = unitW * (112 / 52);
              hotspotOffsetX = -0.3396 * cursorW;
              hotspotOffsetY = -0.1161 * cursorH;
            } else {
              cursorW = unitW * (70 / 52);
              cursorH = unitW * (92 / 52);
              hotspotOffsetX = -0.3571 * cursorW;
            }
          } else {
            if (curTheme === 'mac') {
              cursorW = unitW * (76 / 52);
              cursorH = unitW * (113 / 52);
              hotspotOffsetX = -0.1711 * cursorW;
              hotspotOffsetY = -0.0973 * cursorH;
            }
          }

          ctx.drawImage(cursorImg, hotspotOffsetX, hotspotOffsetY, cursorW, cursorH);
          ctx.restore();
        };

        // Directional Camera Shutter Motion Blur
        if (isMotionBlur && blurAmount > 0.4 && sampled.speed > 0) {
          const steps = Math.min(5, Math.max(2, Math.round(blurAmount * 1.2)));
          const normX = sampled.vx / sampled.speed;
          const normY = sampled.vy / sampled.speed;
          for (let s = 1; s <= steps; s++) {
            const t = s / steps;
            const smearDist = t * blurAmount * 2.8 * (targetW / 1920) / zoom.level;
            drawCursorAtHotspot(
              mouseCanvasX - normX * smearDist,
              mouseCanvasY - normY * smearDist,
              (1 - t) * 0.28
            );
          }
        }

        drawCursorAtHotspot(mouseCanvasX, mouseCanvasY, 1.0);
      }

      ctx.restore(); // Restore camera zoom
      ctx.restore(); // Restore rounded window clip

      // D. Draw Floating Webcam Overlay
      if (camVideo && project.webcam.enabled && Boolean(project.camUrl) && camVideo.videoWidth > 0) {
        const camSizePx = Math.round((project.webcam.size || 200) * (targetW / 960));
        let camX = frameX + 24;
        let camY = frameY + 24;
        if (project.webcam.position === 'TOP_RIGHT') {
          camX = frameX + innerW - camSizePx - 24;
          camY = frameY + 24;
        } else if (project.webcam.position === 'BOTTOM_LEFT') {
          camX = frameX + 24;
          camY = frameY + innerH - camSizePx - 24;
        } else if (project.webcam.position === 'BOTTOM_RIGHT') {
          camX = frameX + innerW - camSizePx - 24;
          camY = frameY + innerH - camSizePx - 24;
        }

        ctx.save();
        ctx.beginPath();
        if (project.webcam.shape === 'circle') {
          ctx.arc(camX + camSizePx / 2, camY + camSizePx / 2, camSizePx / 2, 0, Math.PI * 2);
        } else {
          drawRoundedRect(ctx, camX, camY, camSizePx, camSizePx, 20 * (targetW / 1920));
        }
        ctx.closePath();
        ctx.clip();

        if (project.webcam.mirrored) {
          ctx.translate(camX + camSizePx, camY);
          ctx.scale(-1, 1);
          drawImageCover(ctx, camVideo, camVideo.videoWidth || 640, camVideo.videoHeight || 480, 0, 0, camSizePx, camSizePx);
        } else {
          drawImageCover(ctx, camVideo, camVideo.videoWidth || 640, camVideo.videoHeight || 480, camX, camY, camSizePx, camSizePx);
        }
        ctx.restore();

        // Subtle border
        ctx.save();
        ctx.beginPath();
        if (project.webcam.shape === 'circle') {
          ctx.arc(camX + camSizePx / 2, camY + camSizePx / 2, camSizePx / 2, 0, Math.PI * 2);
        } else {
          drawRoundedRect(ctx, camX, camY, camSizePx, camSizePx, 20 * (targetW / 1920));
        }
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.lineWidth = 2 * (targetW / 1920);
        ctx.stroke();
        ctx.restore();
      }

      // Serialize frame
      const dataUrl = canvas.toDataURL('image/jpeg', 0.90);
      frameBatch.push({ index: frameIdx, dataUrl });

      // Write batch to disk every 15 frames or on final frame
      if (frameBatch.length >= 15 || frameIdx === totalFrames - 1) {
        await TauriBridge.writeExportFrameBatch(tempDir, frameBatch);
        frameBatch = [];
      }

      // Update progress
      const pct = Math.min(88, Math.round(10 + ((frameIdx / totalFrames) * 78)));
      onProgress({
        progress: pct,
        status: 'rendering',
        message: `Rendering frame ${frameIdx + 1} of ${totalFrames} (${pct}%)...`,
      });
    }

    // 10. Finalize & Stitch with FFmpeg
    onProgress({
      progress: 92,
      status: 'saving',
      message: 'Encoding final MP4 video with FFmpeg...',
    });

    const defaultFilename = `${project.name.replace(/[^a-zA-Z0-9_-]/g, '_')}_Edited.mp4`;
    let crfVal = 18;
    if (savedSettings.quality === 'Ultra') crfVal = 14;
    else if (savedSettings.quality === 'Standard') crfVal = 23;
    else if (savedSettings.quality === 'Low') crfVal = 28;

    const res = await TauriBridge.finalizeExportSession({
      tempDir,
      totalFrames,
      fps,
      sourceVideoPath,
      audioOffset: clips[0]?.sourceStart || 0,
      crf: crfVal,
      defaultName: defaultFilename,
    });

    if (res.success && res.filePath) {
      onProgress({
        progress: 100,
        status: 'done',
        message: 'Export Complete!',
        outputPath: res.filePath,
      });
      return { success: true, filePath: res.filePath };
    } else {
      throw new Error('Save dialog was cancelled or export failed.');
    }
  } catch (err: any) {
    onProgress({
      progress: 0,
      status: 'error',
      message: err?.message || 'Export error occurred.',
      error: String(err),
    });
    return { success: false, error: err?.message || String(err) };
  } finally {
    if (hiddenContainer && hiddenContainer.parentNode) {
      try {
        hiddenContainer.parentNode.removeChild(hiddenContainer);
      } catch {}
    }
    if (objectUrlToRevoke) {
      try {
        URL.revokeObjectURL(objectUrlToRevoke);
      } catch {}
    }
    if (video && video !== existingVideoElement) {
      try {
        video.pause();
        video.src = '';
        video.load();
      } catch {}
    }
    if (camVideo && camVideo !== existingCamElement) {
      try {
        camVideo.pause();
        camVideo.src = '';
        camVideo.load();
      } catch {}
    }
  }
}
