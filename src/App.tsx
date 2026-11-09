import React, { useState, useRef, useEffect } from 'react';
import { CustomTitleBar } from './components/CustomTitleBar';
import { StudioViewport } from './components/StudioViewport';
import { Timeline } from './components/Timeline';
import { Inspector } from './components/Inspector';
import { CaptureLauncher } from './components/CaptureLauncher';
import { WindowPickerModal } from './components/WindowPickerModal';
import { RegionSelectorOverlay } from './components/RegionSelectorOverlay';
import { RecordingFloatingBar } from './components/RecordingFloatingBar';
import type { ProjectState, ZoomKeyframe, MouseEventRecord, VideoClip } from './types/canvid';
import { TauriBridge } from './utils/tauriBridge';
import { ExportProgressModal } from './components/ExportProgressModal';
import { exportFinalEditedVideo } from './utils/exportEngine';

const INITIAL_PROJECT: ProjectState = {
  name: 'OpenCanvid Studio 11-5-2026',
  videoUrl: null,
  camUrl: null,
  micUrl: null,
  duration: 0,
  currentTime: 0,
  isPlaying: false,
  aspectRatio: '16:9',
  padding: 8,
  radius: 12,
  backgroundBlur: 0,
  shadowEnabled: true,
  shadowBlur: 35,
  background: {
    type: 'image',
    value: './wallpapers/system/windows-11-dark-mode-blue-stock-official-3840x2400-5630.avif',
  },
  webcam: {
    enabled: true,
    position: 'BOTTOM_RIGHT',
    shape: 'rounded',
    size: 220,
    mirrored: true,
  },
  cursor: {
    visible: true,
    scale: 1.4,
    theme: 'windows',
    clickEffect: 'ripple',
    smoothing: true,
    tilt: true,
    motionBlur: true,
    alwaysDefault: false,
    animationStyle: 'default',
    tension: 470,
    friction: 70,
  },
  zoomConfig: {
    motionBlur: true,
    animationStyle: 'default',
    tension: 280,
    friction: 120,
  },
  zooms: [],
  clips: [{ id: 'clip-1', start: 0, end: 12, sourceStart: 0 }],
  subtitles: [],
  speed: 1,
  volume: 1,
  mouseEvents: [],
};

export const App: React.FC = () => {
  const [project, setProject] = useState<ProjectState>(INITIAL_PROJECT);
  const [selectedZoomId, setSelectedZoomId] = useState<string | null>(null);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [timelineZoomScale, setTimelineZoomScale] = useState<number>(1.0);

  // UX Navigation States (Canvid Workflow)
  const [isLauncherOpen, setIsLauncherOpen] = useState(true);
  const [isWindowPickerOpen, setIsWindowPickerOpen] = useState(false);
  const [isRegionPickerOpen, setIsRegionPickerOpen] = useState(false);
  const [pendingCrop, setPendingCrop] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  const [camEnabled, setCamEnabled] = useState(true);
  const [micEnabled, setMicEnabled] = useState(true);

  const [isExporting, setIsExporting] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const camRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const camRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const camChunksRef = useRef<Blob[]>([]);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const camStreamRef = useRef<MediaStream | null>(null);
  const startTimeRef = useRef<number>(0);
  const recTimerRef = useRef<number | null>(null);

  // Initialize & track window state (instant zero-lag maximize/restore)
  useEffect(() => {
    let unlistenResize: (() => void) | null = null;

    const checkMax = async () => {
      const max = await TauriBridge.isWindowMaximized();
      setIsMaximized(max);
    };
    checkMax();

    if (typeof window !== 'undefined') {
      if ((window as any).electronBridge?.onWindowState) {
        (window as any).electronBridge.onWindowState((state: { isMaximized: boolean }) => {
          setIsMaximized(state.isMaximized);
        });
      } else if ('__TAURI_INTERNALS__' in window) {
        import('@tauri-apps/api/window')
          .then(({ getCurrentWindow }) => {
            const win = getCurrentWindow();
            win
              .onResized(() => {
                checkMax();
              })
              .then((unlisten) => {
                unlistenResize = unlisten;
              })
              .catch(() => {});
          })
          .catch(() => {});
      }

      return () => {
        if (unlistenResize) unlistenResize();
      };
    }
  }, []);

  const handleToggleMaximize = async () => {
    // Instant optimistic UI toggle
    setIsMaximized((prev) => !prev);
    const newMax = await TauriBridge.toggleMaximizeWindow();
    setIsMaximized(newMax);
  };

  // Sync playback between main video and webcam video
  useEffect(() => {
    const video = videoRef.current;
    const cam = camRef.current;
    if (!video) return;

    if (project.isPlaying) {
      video.play().catch(() => {});
      cam?.play().catch(() => {});
    } else {
      video.pause();
      cam?.pause();
    }
  }, [project.isPlaying]);

  // Sync playback rate
  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = project.speed;
    if (camRef.current) camRef.current.playbackRate = project.speed;
  }, [project.speed]);

  // Recording duration timer
  useEffect(() => {
    if (isRecording && !isPaused) {
      recTimerRef.current = window.setInterval(() => {
        setRecordingSeconds((s) => s + 1);
      }, 1000);
    } else {
      if (recTimerRef.current) clearInterval(recTimerRef.current);
    }
    return () => {
      if (recTimerRef.current) clearInterval(recTimerRef.current);
    };
  }, [isRecording, isPaused]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      TauriBridge.restoreSystemCursor();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      TauriBridge.restoreSystemCursor();
    };
  }, []);

  const updateProject = (updates: Partial<ProjectState>) => {
    setProject((prev) => ({ ...prev, ...updates }));
  };

  const handleTimeUpdate = (time: number) => {
    updateProject({ currentTime: time });
  };

  const handleDurationChange = (dur: number) => {
    if (Number.isFinite(dur) && dur > 0 && dur < 100000) {
      setProject((prev) => {
        const hasExistingClips = prev.clips && prev.clips.length > 0 && (prev.clips.length > 1 || prev.clips[0].end !== 12);
        return {
          ...prev,
          duration: dur,
          clips: hasExistingClips ? prev.clips : [{ id: 'clip-1', start: 0, end: dur, sourceStart: 0 }],
        };
      });
    }
  };

  const handleSeek = (time: number) => {
    const safeDur = project.duration > 0 ? project.duration : 10000;
    const clamped = Math.max(0, Math.min(safeDur, time));
    updateProject({ currentTime: clamped });
    if (videoRef.current) videoRef.current.currentTime = clamped;
    if (camRef.current) camRef.current.currentTime = clamped;
  };

  const handleStepTime = (delta: number) => {
    setProject((prev) => {
      const safeDur = prev.duration > 0 ? prev.duration : 12;
      const nextTime = Math.max(0, Math.min(safeDur, Number((prev.currentTime + delta).toFixed(3))));
      if (videoRef.current) videoRef.current.currentTime = nextTime;
      if (camRef.current) camRef.current.currentTime = nextTime;
      return { ...prev, currentTime: nextTime };
    });
  };

  const handleTogglePlay = () => {
    setProject((prev) => {
      const nextPlay = !prev.isPlaying;
      if (videoRef.current) {
        if (nextPlay) {
          // If at the very end, restart from 0
          if (videoRef.current.ended || videoRef.current.currentTime >= (prev.duration || 12) - 0.05) {
            videoRef.current.currentTime = 0;
            if (camRef.current) camRef.current.currentTime = 0;
            prev.currentTime = 0;
          }
          videoRef.current.play().catch(() => {});
        } else {
          videoRef.current.pause();
        }
      }
      if (camRef.current) {
        if (nextPlay) {
          camRef.current.play().catch(() => {});
        } else {
          camRef.current.pause();
        }
      }
      return { ...prev, isPlaying: nextPlay };
    });
  };

  const handleSetSpeed = (speed: number) => {
    updateProject({ speed });
  };

  // Add zoom segment at current time
  const handleAddZoom = () => {
    const curMs = project.currentTime * 1000;
    const newZoom: ZoomKeyframe = {
      id: `zoom-${Date.now()}`,
      start: curMs,
      end: curMs + 2000,
      level: 2.0,
      focal_x: 0.5,
      focal_y: 0.5,
      disabled: false,
    };
    setProject((prev) => ({ ...prev, zooms: [...prev.zooms, newZoom] }));
    setSelectedZoomId(newZoom.id);
  };

  const handleDeleteZoom = (id: string) => {
    setProject((prev) => ({
      ...prev,
      zooms: prev.zooms.filter((z) => z.id !== id),
    }));
    if (selectedZoomId === id) setSelectedZoomId(null);
  };

  const handleUpdateZoom = (id: string, updates: Partial<ZoomKeyframe>) => {
    setProject((prev) => ({
      ...prev,
      zooms: prev.zooms.map((z) => (z.id === id ? { ...z, ...updates } : z)),
    }));
  };

  const handleUpdateSelectedZoom = (updates: Partial<ZoomKeyframe>) => {
    if (!selectedZoomId) return;
    handleUpdateZoom(selectedZoomId, updates);
  };

  const handleUpdateClip = (clipId: string, updates: Partial<VideoClip>) => {
    setProject((prev) => {
      const clips = prev.clips || [];
      const updated = clips.map((c) => (c.id === clipId ? { ...c, ...updates } : c));
      return {
        ...prev,
        clips: updated,
      };
    });
  };

  // Cut/split selected clip or current clip under playhead
  const handleCutClip = () => {
    const safeDur = project.duration > 0 ? project.duration : 12;
    const clips = (project.clips && project.clips.length > 0)
      ? project.clips
      : [{ id: 'clip-primary', start: 0, end: safeDur, sourceStart: 0 }];

    let targetIndex = -1;
    // 1. Prefer explicitly selected clip
    if (selectedClipId) {
      targetIndex = clips.findIndex((c) => c.id === selectedClipId);
    }
    // 2. Otherwise find clip directly under playhead
    const curTime = project.currentTime;
    if (targetIndex === -1) {
      targetIndex = clips.findIndex((c) => curTime >= c.start && curTime <= c.end);
    }
    // 3. Fallback to first clip if none found
    if (targetIndex === -1 && clips.length > 0) {
      targetIndex = 0;
    }
    if (targetIndex === -1) return;

    const target = clips[targetIndex];
    if (target.end - target.start < 0.2) return;

    let cutAt = curTime;
    // If playhead is outside this clip or too close to edges, cut at 50% midpoint
    if (cutAt <= target.start + 0.05 || cutAt >= target.end - 0.05) {
      cutAt = Number(((target.start + target.end) / 2).toFixed(2));
      handleSeek(cutAt);
    }

    const clipA: VideoClip = {
      id: `clip-${Date.now()}-a`,
      start: target.start,
      end: cutAt,
      sourceStart: target.sourceStart,
    };

    const clipB: VideoClip = {
      id: `clip-${Date.now()}-b`,
      start: cutAt,
      end: target.end,
      sourceStart: target.sourceStart + (cutAt - target.start),
    };

    const newClips = [...clips];
    newClips.splice(targetIndex, 1, clipA, clipB);

    setProject((prev) => ({
      ...prev,
      clips: newClips,
    }));
    setSelectedClipId(clipB.id);
  };

  // Global Canvid-Style Keyboard Shortcuts Suite
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput =
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          (activeEl as HTMLElement).isContentEditable ||
          activeEl.getAttribute('role') === 'textbox');

      // Ignore standard editing keystrokes when typing into text fields
      if (isInput) return;

      const key = e.key.toLowerCase();
      const code = e.code;

      // 1. Play / Pause: Space or K
      if (code === 'Space' || (!e.ctrlKey && !e.metaKey && key === 'k')) {
        e.preventDefault();
        // Blur any focused button to avoid double-invocation from browser synthetic click
        if (activeEl instanceof HTMLElement && activeEl.tagName === 'BUTTON') {
          activeEl.blur();
        }
        handleTogglePlay();
        return;
      }

      // 2. Scrub / Step: Left Arrow / J (back) & Right Arrow / L (forward)
      if (code === 'ArrowLeft' || (!e.ctrlKey && !e.metaKey && key === 'j')) {
        e.preventDefault();
        const delta = e.shiftKey ? -5 : (e.altKey || e.ctrlKey ? -0.05 : -1);
        handleStepTime(delta);
        return;
      }

      if (code === 'ArrowRight' || (!e.ctrlKey && !e.metaKey && key === 'l')) {
        e.preventDefault();
        const delta = e.shiftKey ? 5 : (e.altKey || e.ctrlKey ? 0.05 : 1);
        handleStepTime(delta);
        return;
      }

      // 3. Jump to Start / End: Home & End
      if (code === 'Home') {
        e.preventDefault();
        handleSeek(0);
        return;
      }

      if (code === 'End') {
        e.preventDefault();
        handleSeek(project.duration || 12);
        return;
      }

      // 4. Split / Cut Clip: S or C or Ctrl+B
      if ((!e.ctrlKey && !e.metaKey && (key === 's' || key === 'c')) || (e.ctrlKey && key === 'b')) {
        e.preventDefault();
        handleCutClip();
        return;
      }

      // 5. Add Zoom Keyframe: Z (without Ctrl/Cmd)
      if (!e.ctrlKey && !e.metaKey && key === 'z') {
        e.preventDefault();
        handleAddZoom();
        return;
      }

      // 6. Delete Selected Item: Delete or Backspace
      if (code === 'Delete' || code === 'Backspace') {
        if (selectedZoomId) {
          e.preventDefault();
          handleDeleteZoom(selectedZoomId);
          return;
        } else if (selectedClipId && project.clips && project.clips.length > 1) {
          e.preventDefault();
          setProject((prev) => ({
            ...prev,
            clips: (prev.clips || []).filter((c) => c.id !== selectedClipId),
          }));
          setSelectedClipId(null);
          return;
        }
      }

      // 7. Timeline Zoom In / Out: + / = / - / 0
      if ((e.ctrlKey || e.metaKey || !isInput) && (key === '=' || key === '+')) {
        e.preventDefault();
        setTimelineZoomScale((s) => Math.min(3.0, Number((s + 0.2).toFixed(1))));
        return;
      }

      if ((e.ctrlKey || e.metaKey || !isInput) && key === '-') {
        e.preventDefault();
        setTimelineZoomScale((s) => Math.max(0.5, Number((s - 0.2).toFixed(1))));
        return;
      }

      if ((e.ctrlKey || e.metaKey) && key === '0') {
        e.preventDefault();
        setTimelineZoomScale(1.0);
        return;
      }

      // 8. Toggle Audio Mute: M
      if (!e.ctrlKey && !e.metaKey && key === 'm') {
        e.preventDefault();
        setProject((prev) => ({ ...prev, volume: prev.volume === 0 ? 1 : 0 }));
        return;
      }

      // 9. Fullscreen / Maximize Window: F
      if (!e.ctrlKey && !e.metaKey && key === 'f') {
        e.preventDefault();
        handleToggleMaximize();
        return;
      }

      // 10. Deselect / Close: Escape
      if (code === 'Escape') {
        e.preventDefault();
        setSelectedClipId(null);
        setSelectedZoomId(null);
        setIsWindowPickerOpen(false);
        setIsRegionPickerOpen(false);
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedZoomId, selectedClipId, project.clips, project.duration]);

  // Auto-generate zooms from mouse clicks
  const handleAutoGenerateZooms = async () => {
    const newZooms = await TauriBridge.computeAutoZooms(
      project.mouseEvents,
      1920,
      1080,
      2.0
    );
    setProject((prev) => ({ ...prev, zooms: newZooms }));
  };

  // START RECORDING WORKFLOW
  const handleSelectCaptureMode = async (mode: 'display' | 'window' | 'region') => {
    if (mode === 'window') {
      setIsWindowPickerOpen(true);
      return;
    }
    if (mode === 'region') {
      // Expand window to fullscreen so user can drag-select across entire desktop
      await TauriBridge.setFullscreenMode(true);
      setIsRegionPickerOpen(true);
      return;
    }
    setPendingCrop(null);
    await startCaptureStream({});
  };

  const handleSelectWindowFromModal = async (win: any) => {
    setIsWindowPickerOpen(false);
    setPendingCrop({ x: win.x, y: win.y, width: win.width, height: win.height });
    await startCaptureStream({ sourceId: win.sourceId });
  };

  const handleSelectRegionFromModal = async (reg: { x: number; y: number; width: number; height: number }) => {
    await TauriBridge.setFullscreenMode(false);
    setIsRegionPickerOpen(false);
    setPendingCrop(reg);
    await startCaptureStream({});
  };

  const handleCancelRegionSelection = async () => {
    await TauriBridge.setFullscreenMode(false);
    setIsRegionPickerOpen(false);
  };

  const startCaptureStream = async (constraints: any) => {
    try {
      setIsLauncherOpen(false);
      recordedChunksRef.current = [];
      camChunksRef.current = [];
      setRecordingSeconds(0);
      startTimeRef.current = performance.now();

      // 1. Screen media capture with zero burned-in cursor (cursor: 'never')
      // Direct Electron desktopCapturer intercepts getDisplayMedia via setDisplayMediaRequestHandler
      if (constraints?.sourceId && (window as any).electronBridge?.selectCaptureSource) {
        await (window as any).electronBridge.selectCaptureSource(constraints.sourceId);
      }

      let screenStream: MediaStream;
      try {
        screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            frameRate: 60,
            cursor: 'never',
            displaySurface: 'monitor',
          } as any,
          audio: true,
        });
      } catch (err) {
        console.warn('getDisplayMedia failed, falling back to getUserMedia desktop capturer:', err);
        if (constraints?.sourceId) {
          screenStream = await (navigator.mediaDevices as any).getUserMedia({
            audio: false,
            video: {
              mandatory: {
                chromeMediaSource: 'desktop',
                chromeMediaSourceId: constraints.sourceId,
                minFrameRate: 60,
                maxFrameRate: 60,
              },
              optional: [
                { cursor: 'never' },
              ],
            } as any,
          });
        } else {
          throw err;
        }
      }
      screenStreamRef.current = screenStream;

      // 2. Microphone capture
      if (micEnabled) {
        try {
          const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          micStream.getAudioTracks().forEach((track) => screenStream.addTrack(track));
        } catch (e) {
          console.warn('Microphone permission not granted:', e);
        }
      }

      // 3. Optional Webcam capture
      if (camEnabled) {
        try {
          const camStream = await navigator.mediaDevices.getUserMedia({
            video: { width: 640, height: 480 },
            audio: false,
          });
          camStreamRef.current = camStream;
          const camRec = new MediaRecorder(camStream, { mimeType: 'video/webm' });
          camRec.ondataavailable = (e) => {
            if (e.data.size > 0) camChunksRef.current.push(e.data);
          };
          camRecorderRef.current = camRec;
          camRec.start(250);
        } catch (e) {
          console.warn('Webcam permission not granted:', e);
        }
      }

      // 4. Start native mouse tracking & Canvid-style WGC recorder (WithoutCursor)
      await TauriBridge.startMouseRecording();
      try {
        await TauriBridge.startWgcRecording();
      } catch (e) {
        console.warn('WGC recorder start fallback:', e);
      }

      // 5. Start main video recorder
      const screenRec = new MediaRecorder(screenStream, {
        mimeType: 'video/webm;codecs=vp9,opus',
      });
      screenRec.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunksRef.current.push(e.data);
      };
      mediaRecorderRef.current = screenRec;
      screenRec.start(250);

      setIsRecording(true);
      setIsPaused(false);

      // Transform window into Canvid-style always-on-top floating recording toolbar pill
      await TauriBridge.setRecordingFloatingMode(true);
    } catch (err) {
      console.error('Failed to start recording stream:', err);
      setIsLauncherOpen(true);
      await TauriBridge.setRecordingFloatingMode(false);
    }
  };

  // Toggle Pause/Resume during recording
  const handleToggleRecordPause = () => {
    if (!mediaRecorderRef.current) return;
    if (isPaused) {
      mediaRecorderRef.current.resume();
      camRecorderRef.current?.resume();
      setIsPaused(false);
    } else {
      mediaRecorderRef.current.pause();
      camRecorderRef.current?.pause();
      setIsPaused(true);
    }
  };

  // Stop recording and transition to Studio Editor
  const handleStopRecording = async () => {
    setIsRecording(false);

    // Expand window back to 1280x820 Studio editor and center
    await TauriBridge.setRecordingFloatingMode(false);

    // Stop Native Mouse Tracking & compute auto-zooms
    const events: MouseEventRecord[] = await TauriBridge.stopMouseRecording();

    // Stop Native WGC Zero-Cursor Recorder (exact Canvid pipeline)
    let wgcVideoUrl: string | null = null;
    try {
      const wgcPath = await TauriBridge.stopWgcRecording();
      if (wgcPath) {
        const fileBytes = await TauriBridge.readVideoFile(wgcPath);
        if (fileBytes && fileBytes.length > 5000) {
          wgcVideoUrl = 'media://local?path=' + encodeURIComponent(wgcPath);
          console.log('Native WGC Zero-Cursor Video URL ready:', wgcVideoUrl, 'Bytes:', fileBytes.length);
        } else {
          console.warn('WGC output buffer too small or unavailable');
        }
      }
    } catch (e) {
      console.warn('WGC stop recording warning:', e);
    }

    // Stop media streams
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    camStreamRef.current?.getTracks().forEach((t) => t.stop());

    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.onstop = async () => {
        const elapsedSec = Math.max(1, (performance.now() - startTimeRef.current) / 1000.0);
        const screenBlob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        const screenUrl = URL.createObjectURL(screenBlob);

        let camUrl: string | null = null;
        if (camChunksRef.current.length > 0) {
          const camBlob = new Blob(camChunksRef.current, { type: 'video/webm' });
          camUrl = URL.createObjectURL(camBlob);
        }

        // Auto compute zooms from clicks with 2.0x level
        const screenW = (window.screen.width * (window.devicePixelRatio || 1)) || 1920;
        const screenH = (window.screen.height * (window.devicePixelRatio || 1)) || 1080;
        let zooms: ZoomKeyframe[] = [];
        try {
          zooms = await TauriBridge.computeAutoZooms(events, screenW, screenH, 2.0);
        } catch (e) {
          console.warn('Error computing zooms:', e);
        }

        setProject((prev) => ({
          ...prev,
          name: `OpenCanvid Studio ${new Date().toLocaleTimeString().replace(/:/g, '-')}`,
          videoUrl: wgcVideoUrl || screenUrl,
          camUrl: camUrl,
          duration: elapsedSec,
          clips: [{ id: 'clip-1', start: 0, end: elapsedSec, sourceStart: 0 }],
          mouseEvents: events,
          zooms: zooms,
          targetCrop: pendingCrop || undefined,
          currentTime: 0,
          isPlaying: false,
        }));

        setIsLauncherOpen(false);
      };
      mediaRecorderRef.current.stop();
    }

    if (camRecorderRef.current) {
      camRecorderRef.current.stop();
    }
  };

  // Parse and restore complete Canvid project state
  const loadProjectFromData = (data: any, fallbackName: string): boolean => {
    if (data && (data.format === 'canvid-project' || data.zooms || data.clips || data.cursor)) {
      let resolvedVideoUrl = project.videoUrl;

      if (data.videoBase64) {
        resolvedVideoUrl = data.videoBase64;
      } else if (data.videoPath) {
        resolvedVideoUrl = `media://local?path=${encodeURIComponent(data.videoPath)}`;
      }

      setProject({
        name: data.name || fallbackName,
        videoUrl: resolvedVideoUrl,
        camUrl: data.camUrl || null,
        micUrl: data.micUrl || null,
        duration: data.duration || 12,
        background: data.background || INITIAL_PROJECT.background,
        cursor: data.cursor || INITIAL_PROJECT.cursor,
        webcam: data.webcam || INITIAL_PROJECT.webcam,
        zooms: Array.isArray(data.zooms) ? data.zooms : [],
        clips: Array.isArray(data.clips) && data.clips.length > 0
          ? data.clips
          : [{ id: 'clip-1', start: 0, end: data.duration || 12, sourceStart: 0 }],
        mouseEvents: Array.isArray(data.mouseEvents) ? data.mouseEvents : [],
        aspectRatio: data.aspectRatio || '16:9',
        speed: data.speed || 1,
        volume: data.volume !== undefined ? data.volume : 1,
        targetCrop: data.targetCrop,
        currentTime: 0,
        isPlaying: false,
        padding: data.padding ?? (data.background?.padding ?? 8),
        radius: data.radius ?? (data.background?.borderRadius ?? 12),
        shadowEnabled: data.shadowEnabled ?? true,
        shadowBlur: data.shadowBlur ?? (data.background?.shadow ?? 35),
        backgroundBlur: data.backgroundBlur ?? 0,
        zoomConfig: INITIAL_PROJECT.zoomConfig,
        subtitles: [],
      });

      setSelectedClipId(null);
      setSelectedZoomId(null);
      setIsLauncherOpen(false);
      return true;
    }
    return false;
  };

  // Handle local file import (video or .canvid)
  const handleOpenFile = async () => {
    // 1. Try Native Electron Open Dialog
    try {
      const res = await TauriBridge.openProjectFile();
      if (res && res.content) {
        try {
          const parsed = JSON.parse(res.content);
          if (loadProjectFromData(parsed, res.fileName.replace(/\.(canvid|json)$/i, ''))) {
            return;
          }
        } catch {
          // If not JSON, it might be a raw video file chosen by user
          const videoUrl = `media://local?path=${encodeURIComponent(res.filePath)}`;
          updateProject({
            name: res.fileName.replace(/\.[^/.]+$/, ''),
            videoUrl,
          });
          setIsLauncherOpen(false);
          return;
        }
      }
    } catch (e) {
      console.warn('Native open dialog skipped, falling back to input:', e);
    }

    // 2. Fallback to HTML input file picker
    fileInputRef.current?.click();
  };

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileName = file.name;
    const isCanvidOrJson = fileName.endsWith('.canvid') || fileName.endsWith('.json');

    if (isCanvidOrJson) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target?.result as string);
          if (!loadProjectFromData(parsed, fileName.replace(/\.(canvid|json)$/i, ''))) {
            alert('Invalid project file format');
          }
        } catch (err) {
          alert('Could not parse project JSON: ' + String(err));
        }
      };
      reader.readAsText(file);
    } else {
      // Raw video file import
      const url = URL.createObjectURL(file);
      updateProject({
        name: fileName.replace(/\.[^/.]+$/, ''),
        videoUrl: url,
      });
      setIsLauncherOpen(false);
    }

    // Reset input so opening same file again works
    e.target.value = '';
  };

  // Export Progress State Modal
  const [exportModal, setExportModal] = useState<{
    isOpen: boolean;
    progress: number;
    status: 'preparing' | 'rendering' | 'saving' | 'done' | 'error';
    message: string;
    outputPath?: string;
  }>({
    isOpen: false,
    progress: 0,
    status: 'preparing',
    message: '',
  });

  // Export Real Final Edited Video (Respects all trims, cuts, zooms, cursors, backgrounds & webcams)
  const handleExport = async () => {
    if (!project.videoUrl) {
      alert('Please record or import a video first before exporting.');
      return;
    }
    setIsExporting(true);
    setExportModal({
      isOpen: true,
      progress: 0,
      status: 'preparing',
      message: 'Initializing video export pipeline...',
    });

    try {
      const res = await exportFinalEditedVideo(
        project,
        (p) => {
          setExportModal({
            isOpen: true,
            progress: p.progress,
            status: p.status,
            message: p.message,
            outputPath: p.outputPath,
          });
        },
        videoRef.current,
        camRef.current
      );

      if (!res.success && res.error && res.error !== 'Save dialog was cancelled or write failed.') {
        alert(`Export note: ${res.error}`);
      }
    } catch (e: any) {
      alert(`Export error: ${e?.message || e}`);
    } finally {
      setIsExporting(false);
    }
  };

  // Full Project Save: packs schema, zooms, clips, custom cursors, and recording
  const handleSaveArchive = async () => {
    try {
      let videoBase64: string | undefined = undefined;
      let videoPath: string | undefined = undefined;

      // If videoUrl is media://local?path=..., extract the actual file path
      if (project.videoUrl?.startsWith('media://local?path=')) {
        try {
          const parsed = new URL(project.videoUrl);
          videoPath = decodeURIComponent(parsed.searchParams.get('path') || '');
        } catch {}
      } else if (project.videoUrl?.startsWith('blob:')) {
        // Convert blob to base64 for persistent storage across app sessions
        try {
          const resp = await fetch(project.videoUrl);
          const blob = await resp.blob();
          const reader = new FileReader();
          videoBase64 = await new Promise<string>((resolve, reject) => {
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        } catch (e) {
          console.warn('Could not serialize video blob:', e);
        }
      }

      const projectData = {
        format: 'canvid-project',
        version: '1.0',
        savedAt: new Date().toISOString(),
        name: project.name,
        duration: project.duration,
        background: project.background,
        cursor: project.cursor,
        webcam: project.webcam,
        zooms: project.zooms,
        clips: project.clips,
        mouseEvents: project.mouseEvents,
        aspectRatio: project.aspectRatio,
        speed: project.speed,
        volume: project.volume,
        targetCrop: project.targetCrop,
        videoPath,
        videoBase64,
        camUrl: project.camUrl,
      };

      const jsonStr = JSON.stringify(projectData, null, 2);
      const defaultName = `${project.name || 'MyProject'}.canvid`;

      // 1. Try Native Electron Save Dialog
      const result = await TauriBridge.saveProjectFile(defaultName, jsonStr);
      if (result.success) {
        console.log('Project saved to:', result.filePath);
        return;
      }

      // 2. Web Fallback: Direct File Download
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const dlUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = dlUrl;
      a.download = defaultName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(dlUrl);
    } catch (e) {
      console.error('Error saving project:', e);
      alert('Error saving project: ' + String(e));
    }
  };

  const selectedZoom = project.zooms.find((z) => z.id === selectedZoomId) || null;

  // 1. Canvid Floating Bar Mode during active recording (desktop pill only)
  if (isRecording) {
    return (
      <div className="h-screen w-screen select-none overflow-hidden m-0 p-0 bg-transparent flex items-center justify-center pointer-events-auto">
        <RecordingFloatingBar
          durationSec={recordingSeconds}
          isPaused={isPaused}
          onTogglePause={handleToggleRecordPause}
          onStopRecording={handleStopRecording}
          micEnabled={micEnabled}
          onToggleMic={() => setMicEnabled(!micEnabled)}
          camEnabled={camEnabled}
          onToggleCam={() => setCamEnabled(!camEnabled)}
        />
      </div>
    );
  }

  return (
    <div className="w-full h-full select-none overflow-hidden m-0 p-0 bg-transparent flex flex-col">
      <div className={`relative w-full h-full bg-[#000000] overflow-hidden flex flex-col ${
        isMaximized
          ? 'border-0 rounded-none'
          : 'border border-zinc-800/80 rounded-[20px] shadow-2xl'
      }`}>
        {/* Hidden File Input for .canvid or video import */}
      <input
        ref={fileInputRef}
        type="file"
        onChange={onFileInputChange}
        accept="video/*,.canvid"
        className="hidden"
      />

      {/* 4. Frameless Custom Title Bar with 3-line Hamburger Menu ALWAYS Visible at Top-Left */}
      <CustomTitleBar
        projectName={project.name}
        isMaximized={isMaximized}
        onToggleMaximize={handleToggleMaximize}
        onNewProject={() => setIsLauncherOpen(true)}
        onOpenProject={handleOpenFile}
        onSaveProject={handleSaveArchive}
        onExport={handleExport}
        isExporting={isExporting}
      />

      {/* 1. Startup Capture Launcher: "What would you like to capture" (Canvid Screenshot 1) */}
      {isLauncherOpen && !isRecording ? (
        <div className="flex-1 relative min-h-0 overflow-hidden w-full">
          <CaptureLauncher
            isOpen={true}
            onSelectCapture={handleSelectCaptureMode}
            onTakeScreenshot={() => handleSelectCaptureMode('region')}
          />
        </div>
      ) : (
        <>
          {/* 5. Main Studio Workspace: Detached Floating Panels with Rounded Borders (Matching Image 1 & 2) */}
          <div className="flex-1 flex flex-col p-2.5 gap-2.5 min-h-0 overflow-hidden bg-[#000000]">
            {/* Middle Row: Left Inspector Card + Center Viewport Card */}
            <div className="flex-1 flex gap-2.5 min-h-0 overflow-hidden">
              <Inspector
                project={project}
                updateProject={updateProject}
                selectedZoom={selectedZoom}
                updateSelectedZoom={handleUpdateSelectedZoom}
                onAutoGenerateZooms={handleAutoGenerateZooms}
              />

              <StudioViewport
                project={project}
                onTimeUpdate={handleTimeUpdate}
                onDurationChange={handleDurationChange}
                videoRef={videoRef}
                camRef={camRef}
                onExport={handleExport}
                isExporting={isExporting}
                onSaveProject={handleSaveArchive}
                onTogglePlay={handleTogglePlay}
                onSeek={handleSeek}
                onAddZoom={handleAddZoom}
                onCutClip={handleCutClip}
                timelineZoomScale={timelineZoomScale}
                setTimelineZoomScale={setTimelineZoomScale}
                aspectRatio={project.aspectRatio}
                setAspectRatio={(ar) => updateProject({ aspectRatio: ar })}
              />
            </div>

            {/* Bottom: Timeline Card */}
            <Timeline
              project={project}
              onSeek={handleSeek}
              onTogglePlay={handleTogglePlay}
              onAddZoom={handleAddZoom}
              onDeleteZoom={handleDeleteZoom}
              onUpdateZoom={handleUpdateZoom}
              onUpdateClip={handleUpdateClip}
              onSetSpeed={handleSetSpeed}
              selectedZoomId={selectedZoomId}
              onSelectZoom={setSelectedZoomId}
              selectedClipId={selectedClipId}
              onSelectClip={setSelectedClipId}
              timelineZoomScale={timelineZoomScale}
              aspectRatio={project.aspectRatio}
              setAspectRatio={(ar) => updateProject({ aspectRatio: ar })}
            />
          </div>
        </>
      )}

      {/* 2. Window Picker Modal: Always mounted on top (z-[100]) */}
      <WindowPickerModal
        isOpen={isWindowPickerOpen}
        isMaximized={isMaximized}
        onClose={() => setIsWindowPickerOpen(false)}
        onSelectWindow={handleSelectWindowFromModal}
      />

      {/* 2b. Interactive Region Snip Selector: Always mounted on top (z-[100]) */}
      <RegionSelectorOverlay
        isOpen={isRegionPickerOpen}
        isMaximized={isMaximized}
        onCancel={handleCancelRegionSelection}
        onConfirm={handleSelectRegionFromModal}
      />

      {/* 3. Real Video Export Progress Modal */}
      <ExportProgressModal
        isOpen={exportModal.isOpen}
        progress={exportModal.progress}
        status={exportModal.status}
        message={exportModal.message}
        outputPath={exportModal.outputPath}
        onClose={() => setExportModal((prev) => ({ ...prev, isOpen: false }))}
      />
      </div>
    </div>
  );
};

export default App;
