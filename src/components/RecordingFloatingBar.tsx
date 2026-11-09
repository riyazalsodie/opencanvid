import React from 'react';
import { Pause, Play, Square, Mic, MicOff, Camera, CameraOff } from 'lucide-react';

interface RecordingFloatingBarProps {
  durationSec: number;
  isPaused: boolean;
  onTogglePause: () => void;
  onStopRecording: () => void;
  micEnabled: boolean;
  onToggleMic: () => void;
  camEnabled: boolean;
  onToggleCam: () => void;
}

export const RecordingFloatingBar: React.FC<RecordingFloatingBarProps> = ({
  durationSec,
  isPaused,
  onTogglePause,
  onStopRecording,
  micEnabled,
  onToggleMic,
  camEnabled,
  onToggleCam,
}) => {
  const formatTime = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${String(mins).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div
      data-tauri-drag-region
      style={{ WebkitAppRegion: 'drag' } as any}
      className="fixed inset-0 z-[999] select-none flex items-center justify-center p-1 bg-transparent pointer-events-auto"
    >
      <div
        style={{ WebkitAppRegion: 'no-drag' } as any}
        className="bg-[#0e0e11] border border-zinc-800/90 rounded-full px-5 py-2 shadow-[0_10px_35px_rgba(0,0,0,0.8)] flex items-center gap-4 text-zinc-100 backdrop-blur-2xl"
      >
        {/* Pulsing Red Recording Dot + Duration */}
        <div className="flex items-center gap-2 pr-3 border-r border-zinc-800" data-tauri-drag-region>
          <span className="relative flex h-3 w-3">
            {!isPaused && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            )}
            <span className={`relative inline-flex rounded-full h-3 w-3 ${isPaused ? 'bg-amber-500' : 'bg-red-500'}`}></span>
          </span>
          <span className="font-mono text-xs font-semibold tracking-wider text-zinc-200">
            {formatTime(durationSec)}
          </span>
        </div>

        {/* Pause / Resume Button */}
        <button
          onClick={onTogglePause}
          className="w-8 h-8 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-200 flex items-center justify-center transition-colors"
          title={isPaused ? 'Resume Recording' : 'Pause Recording'}
        >
          {isPaused ? <Play className="w-3.5 h-3.5 fill-current" /> : <Pause className="w-3.5 h-3.5" />}
        </button>

        {/* Mic Toggle */}
        <button
          onClick={onToggleMic}
          className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
            micEnabled ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200' : 'bg-red-500/20 text-red-400'
          }`}
          title="Toggle Mic"
        >
          {micEnabled ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
        </button>

        {/* Camera Toggle */}
        <button
          onClick={onToggleCam}
          className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
            camEnabled ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200' : 'bg-red-500/20 text-red-400'
          }`}
          title="Toggle Webcam"
        >
          {camEnabled ? <Camera className="w-3.5 h-3.5" /> : <CameraOff className="w-3.5 h-3.5" />}
        </button>

        {/* Stop Recording Red Button */}
        <button
          onClick={onStopRecording}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-red-600 hover:bg-red-500 text-white font-medium text-xs shadow-lg shadow-red-600/30 transition-all hover:scale-105 active:scale-95"
        >
          <Square className="w-3 h-3 fill-current" />
          <span>Stop Recording</span>
        </button>
      </div>
    </div>
  );
};
