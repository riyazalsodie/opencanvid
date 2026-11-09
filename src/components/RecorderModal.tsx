import React, { useState, useRef, useEffect } from 'react';
import { Camera, Mic, Disc, X, Square, Pause, Play, Sparkles, Volume2 } from 'lucide-react';
import { SleekCheckbox, SleekSwitch } from './SleekControls';
import { TauriBridge } from '../utils/tauriBridge';
import type { MouseEventRecord, ZoomKeyframe } from '../types/canvid';

interface RecorderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRecordingComplete: (
    screenBlobUrl: string,
    camBlobUrl: string | null,
    events: MouseEventRecord[],
    zooms: ZoomKeyframe[],
    durationSec: number
  ) => void;
}

export const RecorderModal: React.FC<RecorderModalProps> = ({
  isOpen,
  onClose,
  onRecordingComplete,
}) => {
  const [includeCam, setIncludeCam] = useState(true);
  const [includeMic, setIncludeMic] = useState(true);
  const [suppressOsCursor, setSuppressOsCursor] = useState(false);

  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [micAudioLevel, setMicAudioLevel] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const camRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const camChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const screenStreamRef = useRef<MediaStream | null>(null);
  const camStreamRef = useRef<MediaStream | null>(null);
  const camVideoRef = useRef<HTMLVideoElement>(null);
  const startTimeRef = useRef<number>(0);

  // Initialize camera preview & mic meter
  useEffect(() => {
    if (!isOpen) return;

    if (includeCam) {
      navigator.mediaDevices
        .getUserMedia({ video: { width: 480, height: 480 }, audio: false })
        .then((stream) => {
          camStreamRef.current = stream;
          if (camVideoRef.current) {
            camVideoRef.current.srcObject = stream;
          }
        })
        .catch((err) => console.warn('Webcam preview error:', err));
    } else {
      camStreamRef.current?.getTracks().forEach((t) => t.stop());
      camStreamRef.current = null;
    }

    if (includeMic) {
      navigator.mediaDevices
        .getUserMedia({ audio: true })
        .then((stream) => {
          const audioCtx = new AudioContext();
          audioContextRef.current = audioCtx;
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 64;
          const source = audioCtx.createMediaStreamSource(stream);
          source.connect(analyser);

          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          const updateMeter = () => {
            analyser.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
            const avg = sum / dataArray.length;
            setMicAudioLevel(Math.min(100, Math.round((avg / 128) * 100)));
            animFrameRef.current = requestAnimationFrame(updateMeter);
          };
          updateMeter();
        })
        .catch(() => {});
    }

    return () => {
      camStreamRef.current?.getTracks().forEach((t) => t.stop());
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (audioContextRef.current) audioContextRef.current.close().catch(() => {});
    };
  }, [isOpen, includeCam, includeMic]);

  // Recording Timer
  useEffect(() => {
    if (isRecording && !isPaused) {
      timerRef.current = window.setInterval(() => {
        setRecordSeconds((s) => s + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRecording, isPaused]);

  const handleStartRecording = async () => {
    try {
      // 1. Get Screen Stream with OS cursor SUPPRESSION enabled if requested!
      // In Chromium / WebView2, cursor: 'never' suppresses the system cursor from being recorded into video
      const displayMediaOptions: any = {
        video: {
          frameRate: 60,
          cursor: suppressOsCursor ? 'never' : 'always',
        },
        audio: true,
      };

      const screenStream = await navigator.mediaDevices.getDisplayMedia(displayMediaOptions);
      screenStreamRef.current = screenStream;

      // 2. Mix mic if requested
      if (includeMic) {
        try {
          const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          micStream.getAudioTracks().forEach((track) => screenStream.addTrack(track));
        } catch (e) {
          console.warn('Mic permission denied:', e);
        }
      }

      // 3. Start 3-second countdown
      setCountdown(3);
      const cdTimer = setInterval(() => {
        setCountdown((c) => {
          if (c && c > 1) return c - 1;
          clearInterval(cdTimer);
          setCountdown(null);
          beginCapture(screenStream);
          return null;
        });
      }, 1000);
    } catch (err) {
      console.error('Failed to start capture:', err);
    }
  };

  const beginCapture = async (screenStream: MediaStream) => {
    recordedChunksRef.current = [];
    camChunksRef.current = [];
    setRecordSeconds(0);
    startTimeRef.current = performance.now();

    // Start native global mouse tracking
    await TauriBridge.startMouseRecording();

    // MediaRecorder for Screen
    const screenRecorder = new MediaRecorder(screenStream, {
      mimeType: 'video/webm;codecs=vp9,opus',
    });
    screenRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) recordedChunksRef.current.push(e.data);
    };
    mediaRecorderRef.current = screenRecorder;
    screenRecorder.start(250);

    // MediaRecorder for Webcam
    if (includeCam && camStreamRef.current) {
      const camRecorder = new MediaRecorder(camStreamRef.current, {
        mimeType: 'video/webm',
      });
      camRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) camChunksRef.current.push(e.data);
      };
      camRecorderRef.current = camRecorder;
      camRecorder.start(250);
    }

    setIsRecording(true);
    setIsPaused(false);
  };

  const handlePauseResume = () => {
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

  const handleStopRecording = async () => {
    setIsRecording(false);

    // Stop Native Mouse Tracking & compute auto-zooms
    const events: MouseEventRecord[] = await TauriBridge.stopMouseRecording();

    // Stop streams
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    camStreamRef.current?.getTracks().forEach((t) => t.stop());

    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.onstop = async () => {
        try {
          const elapsedSec = Math.max(1, (performance.now() - startTimeRef.current) / 1000.0);
          const screenBlob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
          const screenUrl = URL.createObjectURL(screenBlob);

          let camUrl: string | null = null;
          if (camChunksRef.current.length > 0) {
            const camBlob = new Blob(camChunksRef.current, { type: 'video/webm' });
            camUrl = URL.createObjectURL(camBlob);
          }

          // Auto compute zooms from clicks with 1.6x level
          let zooms: ZoomKeyframe[] = [];
          try {
            zooms = await TauriBridge.computeAutoZooms(events, 1920, 1080, 1.6);
          } catch (e) {
            console.warn('Error computing zooms, proceeding with empty zooms:', e);
          }

          onRecordingComplete(screenUrl, camUrl, events, zooms, elapsedSec);
          onClose();
        } catch (err) {
          console.error('Error finalizing recording:', err);
          onClose();
        }
      };
      mediaRecorderRef.current.stop();
    }

    if (camRecorderRef.current) {
      camRecorderRef.current.stop();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      {/* CANVID-STYLE RECORDER LAUNCHER DIALOG */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl text-zinc-100 flex flex-col">
        {/* Top Header */}
        <div className="px-6 py-4 border-b border-zinc-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="w-3 h-3 rounded-full bg-rose-500 animate-ping"></span>
            <h3 className="font-bold text-sm tracking-wide text-zinc-100">Canvid Screen Recorder</h3>
          </div>
          {!isRecording && countdown === null && (
            <button onClick={onClose} className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6">
          {countdown !== null ? (
            /* COUNTDOWN SCREEN */
            <div className="py-14 flex flex-col items-center justify-center">
              <span className="text-8xl font-black text-transparent bg-clip-text bg-gradient-to-tr from-rose-500 via-indigo-400 to-white animate-pulse">
                {countdown}
              </span>
              <p className="mt-4 text-xs font-medium text-zinc-400">Get ready... recording starts in {countdown}</p>
            </div>
          ) : isRecording ? (
            /* FLOATING IN-RECORDING CONTROLLER WIDGET */
            <div className="py-6 flex flex-col items-center justify-center gap-5">
              <div className="flex items-center gap-3 bg-zinc-950/80 border border-rose-500/30 px-6 py-3 rounded-2xl shadow-xl">
                <span className="w-3.5 h-3.5 rounded-full bg-rose-500 animate-pulse"></span>
                <span className="font-mono text-xl font-bold text-white tracking-wider">
                  {Math.floor(recordSeconds / 60)
                    .toString()
                    .padStart(2, '0')}
                  :{(recordSeconds % 60).toString().padStart(2, '0')}
                </span>
                <span className="text-[11px] text-zinc-400 uppercase tracking-widest ml-2 bg-zinc-800/60 px-2 py-0.5 rounded">
                  {isPaused ? 'PAUSED' : 'RECORDING'}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={handlePauseResume}
                  className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold flex items-center gap-2 border border-zinc-700 transition-all"
                >
                  {isPaused ? <Play className="w-3.5 h-3.5 fill-current" /> : <Pause className="w-3.5 h-3.5 fill-current" />}
                  <span>{isPaused ? 'Resume' : 'Pause'}</span>
                </button>

                <button
                  onClick={handleStopRecording}
                  className="px-6 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-rose-600/30 transition-all scale-105"
                >
                  <Square className="w-3.5 h-3.5 fill-white" />
                  <span>Stop & Open in Studio</span>
                </button>
              </div>

              <p className="text-[11px] text-zinc-500">
                Recording screen with zero OS cursor burn-in + native click tracking active.
              </p>
            </div>
          ) : (
            /* PRE-RECORDING SETUP CONTROLS */
            <>
              {/* Camera Preview Bubble & Audio Meter */}
              <div className="grid grid-cols-3 gap-4">
                {/* Webcam Circular Preview */}
                <div className="col-span-1 h-36 bg-zinc-950 rounded-2xl border border-zinc-800 flex items-center justify-center overflow-hidden relative group">
                  {includeCam ? (
                    <video
                      ref={camVideoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover scale-x-[-1]"
                    />
                  ) : (
                    <div className="text-zinc-500 flex flex-col items-center gap-1 text-[11px]">
                      <Camera className="w-6 h-6" />
                      <span>Camera Off</span>
                    </div>
                  )}
                  <span className="absolute bottom-1.5 left-2 text-[9px] bg-black/60 px-1.5 py-0.5 rounded text-zinc-300">
                    Webcam PIP
                  </span>
                </div>

                {/* Device Status & Audio VU Meter */}
                <div className="col-span-2 bg-zinc-950 rounded-2xl border border-zinc-800 p-4 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-medium">
                      <span className="text-zinc-300 flex items-center gap-1.5">
                        <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                        Microphone Input
                      </span>
                      <span className="text-[11px] text-emerald-400 font-mono">{micAudioLevel}%</span>
                    </div>

                    {/* Live Audio Visualizer Bar */}
                    <div className="w-full h-2.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-indigo-500 transition-all duration-75"
                        style={{ width: `${micAudioLevel}%` }}
                      />
                    </div>
                  </div>

                  <div className="text-[11px] text-zinc-400 bg-zinc-900/60 p-2 rounded-lg border border-zinc-800/60">
                    💡 <span className="text-zinc-200 font-medium">Canvid Auto-Zoom:</span> Windows clicks will be detected and turned into smooth cinematic zoom keyframes automatically.
                  </div>
                </div>
              </div>

              {/* Toggles */}
              <div className="space-y-2.5">
                <div
                  onClick={() => setIncludeCam(!includeCam)}
                  className="flex items-center justify-between p-3 rounded-xl bg-zinc-950/70 border border-zinc-800 hover:border-zinc-700 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
                      <Camera className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-semibold block text-zinc-200">Facecam Floating Bubble (PIP)</span>
                      <span className="text-[10px] text-zinc-500 block">Records synchronized webcam video stream</span>
                    </div>
                  </div>
                  <SleekSwitch
                    checked={includeCam}
                    onChange={(val) => setIncludeCam(val)}
                  />
                </div>

                <div
                  onClick={() => setIncludeMic(!includeMic)}
                  className="flex items-center justify-between p-3 rounded-xl bg-zinc-950/70 border border-zinc-800 hover:border-zinc-700 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                      <Mic className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-semibold block text-zinc-200">Microphone Audio</span>
                      <span className="text-[10px] text-zinc-500 block">Records commentary with volume gain controls</span>
                    </div>
                  </div>
                  <SleekSwitch
                    checked={includeMic}
                    onChange={(val) => setIncludeMic(val)}
                  />
                </div>

                <div
                  onClick={() => setSuppressOsCursor(!suppressOsCursor)}
                  className="flex items-center justify-between p-3 rounded-xl bg-indigo-950/20 border border-indigo-500/30 hover:border-indigo-500/50 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-300">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-semibold block text-indigo-200">
                        Suppress OS Cursor (Editable Vector Cursor)
                      </span>
                      <span className="text-[10px] text-zinc-400 block">
                        Does not burn original mouse into video; lets you change cursor size, theme & smoothing in editor!
                      </span>
                    </div>
                  </div>
                  <SleekCheckbox
                    checked={suppressOsCursor}
                    onChange={(val) => setSuppressOsCursor(val)}
                  />
                </div>
              </div>

              {/* Big Red Pulsing Start Recording Button */}
              <button
                onClick={handleStartRecording}
                className="w-full py-3.5 bg-gradient-to-r from-rose-600 via-rose-500 to-indigo-600 hover:from-rose-500 hover:to-indigo-500 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2.5 shadow-xl shadow-rose-600/30 transition-all transform hover:scale-[1.01]"
              >
                <Disc className="w-5 h-5 text-white animate-pulse" />
                <span>Start Recording</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
