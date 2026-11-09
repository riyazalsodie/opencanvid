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

  try {
    // 1. Determine target resolution based on Aspect Ratio
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

    // 2. Offscreen Rendering Canvas
    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Could not create canvas 2D rendering context.');

    // 3. Preload Genuine Cursors
    const winArrow = new Image(); winArrow.src = WINDOWS_ARROW_DATA_URL;
    const winLink = new Image(); winLink.src = WINDOWS_LINK_DATA_URL;
    const macArrow = new Image(); macArrow.src = MACOS_ARROW_DATA_URL;
    const macHand = new Image(); macHand.src = MACOS_LINK_DATA_URL;

    // Preload Wallpaper if image
    let bgImg: HTMLImageElement | null = null;
    if (project.background.type === 'image' && project.background.value) {
      bgImg = new Image();
      bgImg.src = project.background.value;
    }

    await Promise.all([
      new Promise((r) => { winArrow.onload = r; winArrow.onerror = r; }),
      new Promise((r) => { winLink.onload = r; winLink.onerror = r; }),
      new Promise((r) => { macArrow.onload = r; macArrow.onerror = r; }),
      new Promise((r) => { macHand.onload = r; macHand.onerror = r; }),
      bgImg ? new Promise((r) => { bgImg!.onload = r; bgImg!.onerror = r; }) : Promise.resolve(),
    ]);

    // 4. Set up Video Elements (Prefer already active element from viewport to bypass CORS/reloading)
    let video: HTMLVideoElement;
    if (existingVideoElement && existingVideoElement.readyState >= 1) {
      video = existingVideoElement;
    } else {
      video = document.createElement('video');
      video.playsInline = true;
      video.muted = false;
      video.volume = project.volume ?? 1;
      video.src = project.videoUrl!;

      await new Promise<void>((resolve, reject) => {
        if (video.readyState >= 1) return resolve();
        video.onloadedmetadata = () => resolve();
        video.onerror = () => {
          console.error('[Export Video Error]', video.error);
          reject(new Error(`Failed loading source video file: ${video.error?.message || 'code ' + video.error?.code}`));
        };
        setTimeout(resolve, 3500); // safety fallback
      });
    }

    let camVideo: HTMLVideoElement | null = null;
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

    // 5. Sorted Clips
    const safeDur = project.duration > 0 ? project.duration : 12;
    const clips: VideoClip[] = (project.clips && project.clips.length > 0)
      ? [...project.clips].sort((a, b) => a.start - b.start)
      : [{ id: 'clip-1', start: 0, end: safeDur, sourceStart: 0 }];

    const totalDurationSec = clips.reduce((acc, c) => acc + Math.max(0.05, c.end - c.start), 0);
    if (totalDurationSec <= 0) throw new Error('Video duration is 0.');

    // 6. Setup MediaStream & Audio
    const canvasStream = canvas.captureStream(60);
    let combinedStream = canvasStream;

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const audioCtx = new AudioCtx();
        const dest = audioCtx.createMediaStreamDestination();
        const vSource = audioCtx.createMediaElementSource(video);
        vSource.connect(dest);
        vSource.connect(audioCtx.destination);
        combinedStream = new MediaStream([
          ...canvasStream.getVideoTracks(),
          ...dest.stream.getAudioTracks(),
        ]);
      }
    } catch {
      // Audio fallback to canvas-only stream if already piped
    }

    // 7. Pick Best Supported MimeType
    let mimeType = 'video/webm;codecs=vp9,opus';
    if (MediaRecorder.isTypeSupported('video/mp4;codecs=avc1')) {
      mimeType = 'video/mp4;codecs=avc1';
    } else if (MediaRecorder.isTypeSupported('video/mp4')) {
      mimeType = 'video/mp4';
    } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')) {
      mimeType = 'video/webm;codecs=vp8,opus';
    } else if (MediaRecorder.isTypeSupported('video/webm')) {
      mimeType = 'video/webm';
    }

    const recordedChunks: Blob[] = [];
    const recorder = new MediaRecorder(combinedStream, {
      mimeType,
      videoBitsPerSecond: 16_000_000, // Crisp 16 Mbps UHD bitrate
    });

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        recordedChunks.push(e.data);
      }
    };

    recorder.start(100);

    onProgress({
      progress: 10,
      status: 'rendering',
      message: 'Rendering real edited frames with smooth zooms & cursor...',
    });

    // 8. Video Dimensions and Insets (Exact Match with Studio Viewport Scaling)
    const videoOrigW = video.videoWidth || 1920;
    const videoOrigH = video.videoHeight || 1080;
    const scaleFactor = Math.max(0.4, 1 - ((project.padding ?? 8) / 100) * 1.4);
    const innerW = targetW * scaleFactor;
    const innerH = targetH * scaleFactor;
    const frameX = (targetW - innerW) / 2;
    const frameY = (targetH - innerH) / 2;
    const cornerRadius = Math.max(12, (project.radius ?? 14) * (targetH / 650));

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

    // 9. Play through each clip sequentially
    let elapsedGlobalTime = 0;

    for (let cIdx = 0; cIdx < clips.length; cIdx++) {
      const clip = clips[cIdx];
      const clipDuration = Math.max(0.05, clip.end - clip.start);

      // Seek video to clip's source start
      video.currentTime = clip.sourceStart;
      if (camVideo) camVideo.currentTime = clip.sourceStart;

      await new Promise<void>((resolve) => {
        const onSeeked = () => {
          video.removeEventListener('seeked', onSeeked);
          resolve();
        };
        video.addEventListener('seeked', onSeeked);
        setTimeout(resolve, 150); // safety fallback
      });

      await video.play().catch(() => {});
      if (camVideo) await camVideo.play().catch(() => {});

      const clipStartWallTime = performance.now();

      await new Promise<void>((resolveClip) => {
        let animId: number;

        const renderFrame = () => {
          const now = performance.now();
          const elapsedInClip = (now - clipStartWallTime) / 1000;
          const currentTimelineSec = elapsedGlobalTime + elapsedInClip;

          if (elapsedInClip >= clipDuration || video.ended) {
            cancelAnimationFrame(animId);
            resolveClip();
            return;
          }

          // A. Draw Background
          if (bgImg) {
            ctx.drawImage(bgImg, 0, 0, targetW, targetH);
          } else if (project.background.type === 'color') {
            ctx.fillStyle = project.background.value || '#000000';
            ctx.fillRect(0, 0, targetW, targetH);
          } else {
            ctx.fillStyle = '#0a0a0d';
            ctx.fillRect(0, 0, targetW, targetH);
          }

          // B. Compute Active Auto-Zoom
          const curMs = currentTimelineSec * 1000;
          const activeZoom = (project.zooms || []).find((z) => curMs >= z.start && curMs <= z.end);

          let zoomScale = 1.0;
          let focalX = targetW / 2;
          let focalY = targetH / 2;

          if (activeZoom) {
            const zDur = Math.max(100, activeZoom.end - activeZoom.start);
            const zProgress = (curMs - activeZoom.start) / zDur;
            // Spring ease-in / ease-out
            let ease = 1.0;
            if (zProgress < 0.25) {
              ease = (zProgress / 0.25);
            } else if (zProgress > 0.75) {
              ease = 1 - (zProgress - 0.75) / 0.25;
            }
            zoomScale = 1 + (activeZoom.level - 1) * ease;

            // Focal coordinates relative to the video frame
            if (activeZoom.focal_x !== undefined && activeZoom.focal_y !== undefined) {
              focalX = frameX + (activeZoom.focal_x * innerW);
              focalY = frameY + (activeZoom.focal_y * innerH);
            }
          }

          // C. 1. Draw Outer Drop Shadow Behind the Rounded Frame
          if (project.shadowEnabled) {
            ctx.save();
            ctx.shadowColor = 'rgba(0,0,0,0.65)';
            ctx.shadowBlur = (project.shadowBlur ?? 35) * (targetH / 720);
            ctx.shadowOffsetY = 12 * (targetH / 720);
            ctx.fillStyle = '#000000';
            drawRoundedRect(ctx, frameX, frameY, innerW, innerH, cornerRadius);
            ctx.fill();
            ctx.restore();
          }

          // C. 2. Clip strictly to the Rounded Rectangle Frame (Never squared!)
          ctx.save();
          drawRoundedRect(ctx, frameX, frameY, innerW, innerH, cornerRadius);
          ctx.clip();

          // C. 3. Apply Camera Zoom Transform INSIDE the Rounded Clip
          ctx.save();
          if (zoomScale > 1.001) {
            ctx.translate(focalX, focalY);
            ctx.scale(zoomScale, zoomScale);
            ctx.translate(-focalX, -focalY);
          }

          // C. 4. Render Video Frame
          ctx.drawImage(video, 0, 0, videoOrigW, videoOrigH, frameX, frameY, innerW, innerH);
          ctx.restore(); // restore zoom transform
          ctx.restore(); // restore rounded clip path

          // D. Draw Floating Webcam (if active)
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
              drawRoundedRect(ctx, camX, camY, camSizePx, camSizePx, 18 * (targetH / 720));
            }
            ctx.clip();
            ctx.drawImage(camVideo, camX, camY, camSizePx, camSizePx);
            ctx.restore();
          }

          // E. Draw Vector Mouse Cursor (Authentic OS Quality with Motion Blur)
          if (project.cursor.visible) {
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

              // Motion blur: calculate delta from previous point
              const prevM = getMouseAtTime(curMs - 35);
              const vx = prevM ? (m.x - prevM.x) : 0;
              const vy = prevM ? (m.y - prevM.y) : 0;
              const speed = Math.hypot(vx, vy);

              if (project.cursor.motionBlur && speed > 2) {
                ctx.save();
                ctx.globalAlpha = 0.35;
                ctx.drawImage(
                  cursorImg,
                  mouseCanvasX - vx * 0.4,
                  mouseCanvasY - vy * 0.4,
                  cursorW,
                  cursorH
                );
                ctx.restore();
              }

              // Draw authentic crisp cursor
              ctx.drawImage(cursorImg, mouseCanvasX, mouseCanvasY, cursorW, cursorH);
            }
          }

          // Restore zoom transform
          ctx.restore();

          // Progress update
          const overallPct = Math.min(
            92,
            Math.round(10 + ((currentTimelineSec / totalDurationSec) * 82))
          );
          onProgress({
            progress: overallPct,
            status: 'rendering',
            message: `Rendering frame at ${currentTimelineSec.toFixed(1)}s / ${totalDurationSec.toFixed(1)}s (${overallPct}%)...`,
          });

          animId = requestAnimationFrame(renderFrame);
        };

        animId = requestAnimationFrame(renderFrame);
      });

      video.pause();
      if (camVideo) camVideo.pause();
      elapsedGlobalTime += clipDuration;
    }

    // 10. Stop recording and collect buffer
    onProgress({
      progress: 94,
      status: 'saving',
      message: 'Encoding final MP4 video stream...',
    });

    recorder.stop();

    const finalBlob = await new Promise<Blob>((res) => {
      recorder.onstop = () => {
        res(new Blob(recordedChunks, { type: mimeType }));
      };
    });

    const arrayBuffer = await finalBlob.arrayBuffer();

    onProgress({
      progress: 97,
      status: 'saving',
      message: 'Saving final edited file to disk...',
    });

    const defaultFilename = `${project.name.replace(/[^a-zA-Z0-9_-]/g, '_')}_Edited.mp4`;
    const saveResult = await TauriBridge.saveExportedVideo(defaultFilename, arrayBuffer);

    if (saveResult.success) {
      onProgress({
        progress: 100,
        status: 'done',
        message: 'Export Complete!',
        outputPath: saveResult.filePath,
      });
      return { success: true, filePath: saveResult.filePath };
    } else {
      throw new Error('Save dialog was cancelled or write failed.');
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
