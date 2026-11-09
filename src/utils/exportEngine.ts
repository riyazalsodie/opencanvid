import type { ProjectState, MouseEventRecord, VideoClip } from '../types/canvid';
import {
  WINDOWS_ARROW_DATA_URL,
  WINDOWS_LINK_DATA_URL,
  MACOS_ARROW_DATA_URL,
  MACOS_LINK_DATA_URL,
} from './cursorAssets';
import { TauriBridge } from './tauriBridge';

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

  try {
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
    switch (project.aspectRatio) {
      case '9:16':
        targetW = 1080;
        targetH = 1920;
        break;
      case '1:1':
        targetW = 1080;
        targetH = 1080;
        break;
      case '4:3':
        targetW = 1440;
        targetH = 1080;
        break;
      case '16:9':
      default:
        targetW = 1920;
        targetH = 1080;
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

    // 6. Set up Dedicated Video Element for Frame Seeking
    if (existingVideoElement && existingVideoElement.readyState >= 2) {
      video = existingVideoElement;
    } else {
      video = document.createElement('video');
      video.playsInline = true;
      video.muted = true;
      video.src = project.videoUrl!;
      video.preload = 'auto';

      await new Promise<void>((resolve, reject) => {
        if (video!.readyState >= 2) return resolve();
        video!.onloadeddata = () => resolve();
        video!.oncanplay = () => resolve();
        video!.onerror = () => {
          if (existingVideoElement) {
            video = existingVideoElement;
            return resolve();
          }
          reject(new Error(`Failed loading source video: ${video?.error?.message || 'code ' + video?.error?.code}`));
        };
        setTimeout(resolve, 3500);
      });
    }

    if (project.webcam.enabled && (project.camUrl || existingCamElement)) {
      if (existingCamElement && existingCamElement.readyState >= 1) {
        camVideo = existingCamElement;
      } else if (project.camUrl) {
        camVideo = document.createElement('video');
        camVideo.playsInline = true;
        camVideo.muted = true;
        camVideo.src = project.camUrl;
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

    const fps = 30; // 30 FPS broadcast standard
    const totalFrames = Math.max(1, Math.round(totalDurationSec * fps));

    // 8. Geometry & Styling
    const videoOrigW = video.videoWidth || 1920;
    const videoOrigH = video.videoHeight || 1080;
    const userPadding = project.padding !== undefined ? project.padding : 8;
    const scaleFactor = Math.max(0.4, Math.min(0.94, 1 - (userPadding / 100) * 1.35));
    const innerW = targetW * scaleFactor;
    const innerH = targetH * scaleFactor;
    const frameX = (targetW - innerW) / 2;
    const frameY = (targetH - innerH) / 2;
    const baseRadius = project.radius !== undefined ? project.radius : 14;
    const cornerRadius = Math.max(28, Math.round(baseRadius * (targetW / 650)));

    // Mouse events helper
    const mouseEvents = project.mouseEvents || [];
    const getMouseAtTime = (ms: number): MouseEventRecord | null => {
      if (mouseEvents.length === 0) return null;
      let low = 0;
      let high = mouseEvents.length - 1;
      while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        if (mouseEvents[mid].t_ms < ms) low = mid + 1;
        else high = mid - 1;
      }
      const idx = Math.max(0, Math.min(mouseEvents.length - 1, low));
      return mouseEvents[idx];
    };

    onProgress({
      progress: 10,
      status: 'rendering',
      message: `Rendering ${totalFrames} frames with Canvid curvature & screen blur...`,
    });

    // 9. Frame-by-Frame Deterministic Rendering Loop
    let frameBatch: { index: number; dataUrl: string }[] = [];

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

      // Seek video to frame timestamp
      if (Math.abs(video.currentTime - videoTargetTime) > 0.025) {
        video.currentTime = videoTargetTime;
        await new Promise<void>((r) => {
          const onSeek = () => {
            video!.removeEventListener('seeked', onSeek);
            r();
          };
          video!.addEventListener('seeked', onSeek);
          setTimeout(r, 80); // Safety fallback
        });
      }

      const vw = video.videoWidth > 0 ? video.videoWidth : videoOrigW;
      const vh = video.videoHeight > 0 ? video.videoHeight : videoOrigH;

      // A. Draw Background: Wallpaper (with blur) OR Authentic Canvid Ambient Screen Blur
      ctx.save();
      if (bgImg && bgImg.complete && bgImg.naturalWidth > 0) {
        if (project.backgroundBlur && project.backgroundBlur > 0) {
          ctx.filter = `blur(${Math.max(12, project.backgroundBlur * 1.6)}px)`;
        }
        ctx.drawImage(bgImg, -20, -20, targetW + 40, targetH + 40);
      } else if (project.background.type === 'color' && project.background.value && project.background.value.toLowerCase() !== '#000000') {
        ctx.fillStyle = project.background.value;
        ctx.fillRect(0, 0, targetW, targetH);
      } else {
        // Canvid Signature Ambient Screen Blur
        ctx.filter = 'blur(48px) brightness(0.65) saturate(1.25)';
        ctx.drawImage(video, 0, 0, vw, vh, -40, -40, targetW + 80, targetH + 80);
      }
      ctx.restore();

      // B. Compute Auto-Zoom Transform
      const curMs = currentTimelineSec * 1000;
      const activeZoom = (project.zooms || []).find((z) => curMs >= z.start && curMs <= z.end);

      let zoomScale = 1.0;
      let focalX = targetW / 2;
      let focalY = targetH / 2;

      if (activeZoom) {
        const zDur = Math.max(100, activeZoom.end - activeZoom.start);
        const zProgress = (curMs - activeZoom.start) / zDur;
        let ease = 1.0;
        if (zProgress < 0.25) {
          ease = zProgress / 0.25;
        } else if (zProgress > 0.75) {
          ease = 1 - (zProgress - 0.75) / 0.25;
        }
        zoomScale = 1 + (activeZoom.level - 1) * ease;

        if (activeZoom.focal_x !== undefined && activeZoom.focal_y !== undefined) {
          focalX = frameX + (activeZoom.focal_x * innerW);
          focalY = frameY + (activeZoom.focal_y * innerH);
        }
      }

      // C. 1. Outer Soft Drop Shadow
      if (project.shadowEnabled) {
        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
        ctx.shadowBlur = Math.max(28, (project.shadowBlur ?? 35) * (targetH / 650));
        ctx.shadowOffsetY = 14 * (targetH / 650);
        ctx.fillStyle = '#000000';
        drawRoundedRect(ctx, frameX, frameY, innerW, innerH, cornerRadius);
        ctx.fill();
        ctx.restore();
      }

      // C. 2. Rounded Window Clip
      ctx.save();
      drawRoundedRect(ctx, frameX, frameY, innerW, innerH, cornerRadius);
      ctx.clip();

      // C. 3. Apply Camera Zoom Transform
      ctx.save();
      if (zoomScale > 1.001) {
        ctx.translate(focalX, focalY);
        ctx.scale(zoomScale, zoomScale);
        ctx.translate(-focalX, -focalY);
      }

      // C. 4. Render Sharp Video Frame
      ctx.drawImage(video, 0, 0, vw, vh, frameX, frameY, innerW, innerH);
      ctx.restore(); // restore zoom
      ctx.restore(); // restore clip

      // C. 5. Sleek Translucent Window Border Accent
      ctx.save();
      drawRoundedRect(ctx, frameX, frameY, innerW, innerH, cornerRadius);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = Math.max(1, 1.5 * (targetH / 1080));
      ctx.stroke();
      ctx.restore();

      // D. Draw Floating Webcam Overlay
      if (camVideo && project.webcam.enabled) {
        const camSizePx = (project.webcam.size / 100) * (innerW * 0.32);
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
          drawRoundedRect(ctx, camX, camY, camSizePx, camSizePx, 16);
        }
        ctx.closePath();
        ctx.clip();

        if (project.webcam.mirrored) {
          ctx.translate(camX + camSizePx, camY);
          ctx.scale(-1, 1);
          ctx.drawImage(camVideo, 0, 0, camSizePx, camSizePx);
        } else {
          ctx.drawImage(camVideo, camX, camY, camSizePx, camSizePx);
        }
        ctx.restore();

        // Webcam subtle border
        ctx.save();
        ctx.beginPath();
        if (project.webcam.shape === 'circle') {
          ctx.arc(camX + camSizePx / 2, camY + camSizePx / 2, camSizePx / 2, 0, Math.PI * 2);
        } else {
          drawRoundedRect(ctx, camX, camY, camSizePx, camSizePx, 16);
        }
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
      }

      // E. Draw Cursor
      if (project.cursor.visible) {
        ctx.save();
        if (zoomScale > 1.001) {
          ctx.translate(focalX, focalY);
          ctx.scale(zoomScale, zoomScale);
          ctx.translate(-focalX, -focalY);
        }

        const m = getMouseAtTime(curMs);
        if (m) {
          const curTheme = project.cursor.theme || 'mac';
          const isClicking = m.event_type === 'lclick';
          const cursorImg = curTheme === 'mac'
            ? (isClicking ? macHand : macArrow)
            : (isClicking ? winLink : winArrow);

          const mouseCanvasX = frameX + (m.x / videoOrigW) * innerW;
          const mouseCanvasY = frameY + (m.y / videoOrigH) * innerH;
          const cursorScale = (project.cursor.scale ?? 1.4) * (targetW / 1920);
          const cursorW = 28 * cursorScale;
          const cursorH = 28 * cursorScale;

          // Click ripple effect
          if (project.cursor.clickEffect === 'ripple' && isClicking) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(mouseCanvasX, mouseCanvasY, 26 * cursorScale, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(59, 130, 246, 0.7)';
            ctx.lineWidth = 3;
            ctx.stroke();
            ctx.restore();
          }

          ctx.drawImage(cursorImg, mouseCanvasX, mouseCanvasY, cursorW, cursorH);
        }

        ctx.restore();
      }

      // Serialize frame
      const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
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
    const res = await TauriBridge.finalizeExportSession({
      tempDir,
      totalFrames,
      fps,
      sourceVideoPath,
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
  }
}
