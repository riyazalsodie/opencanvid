import React, { useState } from 'react';
import {
  Monitor,
  AppWindow,
  Crop,
  Camera,
  Mic,
  Volume2,
  ChevronDown,
} from 'lucide-react';

interface CaptureLauncherProps {
  isOpen: boolean;
  onSelectCapture: (mode: 'display' | 'window' | 'region') => void;
  onTakeScreenshot: () => void;
  onClose?: () => void;
}

export const CaptureLauncher: React.FC<CaptureLauncherProps> = ({
  isOpen,
  onSelectCapture,
  onTakeScreenshot,
}) => {
  const [camEnabled, setCamEnabled] = useState(true);
  const [micEnabled, setMicEnabled] = useState(true);
  const [sysAudioEnabled, setSysAudioEnabled] = useState(true);

  if (!isOpen) return null;

  return (
    <div className="w-full h-full bg-[#000000] flex flex-col items-center justify-between text-zinc-100 select-none font-sans overflow-hidden py-4">
      {/* Main Center Cards Area */}
      <div className="flex-1 flex flex-col items-center justify-center max-w-4xl px-4 w-full">
        <h1 className="text-2xl md:text-3xl font-medium text-zinc-100 mb-9 tracking-tight text-center">
          What would you like to capture
        </h1>

        {/* 3 Main Action Cards */}
        <div className="flex items-center gap-5 md:gap-7">
          {/* Display Card */}
          <button
            onClick={() => onSelectCapture('display')}
            className="group w-40 h-44 md:w-44 md:h-48 rounded-2xl bg-[#0a0a0d] hover:bg-[#121217] border border-zinc-800/90 hover:border-indigo-500/50 flex flex-col items-center justify-center p-4 transition-all duration-200 hover:-translate-y-1.5 shadow-xl shadow-black/60 hover:shadow-2xl hover:shadow-indigo-950/20"
          >
            <div className="w-20 h-16 rounded-xl bg-gradient-to-b from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-950/50 group-hover:scale-105 transition-transform mb-4">
              <Monitor className="w-10 h-10 text-white/95" strokeWidth={1.75} />
            </div>
            <span className="text-sm font-medium text-zinc-200 group-hover:text-white transition-colors">
              Display
            </span>
          </button>

          {/* Window Card */}
          <button
            onClick={() => onSelectCapture('window')}
            className="group w-40 h-44 md:w-44 md:h-48 rounded-2xl bg-[#0a0a0d] hover:bg-[#121217] border border-zinc-800/90 hover:border-indigo-500/50 flex flex-col items-center justify-center p-4 transition-all duration-200 hover:-translate-y-1.5 shadow-xl shadow-black/60 hover:shadow-2xl hover:shadow-indigo-950/20"
          >
            <div className="w-20 h-16 rounded-xl bg-gradient-to-b from-blue-500 to-indigo-600 flex flex-col items-center justify-start pt-1.5 shadow-lg shadow-indigo-950/50 group-hover:scale-105 transition-transform mb-4 overflow-hidden">
              <div className="w-full flex items-center gap-1 px-2 mb-1">
                <span className="w-1.5 h-1.5 rounded-full bg-white/70"></span>
                <span className="w-1.5 h-1.5 rounded-full bg-white/70"></span>
                <span className="w-1.5 h-1.5 rounded-full bg-white/70"></span>
              </div>
              <AppWindow className="w-8 h-8 text-white/95 mt-0.5" strokeWidth={1.75} />
            </div>
            <span className="text-sm font-medium text-zinc-200 group-hover:text-white transition-colors">
              Window
            </span>
          </button>

          {/* Region Card */}
          <button
            onClick={() => onSelectCapture('region')}
            className="group w-40 h-44 md:w-44 md:h-48 rounded-2xl bg-[#0a0a0d] hover:bg-[#121217] border border-zinc-800/90 hover:border-indigo-500/50 flex flex-col items-center justify-center p-4 transition-all duration-200 hover:-translate-y-1.5 shadow-xl shadow-black/60 hover:shadow-2xl hover:shadow-indigo-950/20"
          >
            <div className="w-20 h-16 rounded-xl bg-gradient-to-b from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-950/50 group-hover:scale-105 transition-transform mb-4">
              <Crop className="w-10 h-10 text-white/95" strokeWidth={1.75} />
            </div>
            <span className="text-sm font-medium text-zinc-200 group-hover:text-white transition-colors">
              Region
            </span>
          </button>
        </div>

        {/* 'or' Separator */}
        <div className="text-xs text-zinc-500 my-6 font-normal">or</div>

        {/* Take a Screenshot Pill */}
        <button
          onClick={onTakeScreenshot}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white text-xs font-medium transition-all hover:scale-102 shadow-lg shadow-black/40"
        >
          <Camera className="w-3.5 h-3.5" />
          <span>Take a Screenshot</span>
        </button>
      </div>

      {/* Bottom Bar: Input Device Selectors */}
      <div className="w-full max-w-2xl pb-7 flex items-center justify-center gap-4 text-xs text-zinc-300">
        {/* Camera Toggle */}
        <div className="flex items-center gap-2 bg-zinc-900/90 border border-zinc-800/90 px-3.5 py-1.5 rounded-xl shadow-md">
          <button
            onClick={() => setCamEnabled(!camEnabled)}
            className={`flex items-center gap-1.5 ${camEnabled ? 'text-zinc-100' : 'text-zinc-400'}`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Camera {camEnabled ? '(HD)' : '(Off)'}</span>
          </button>
          <ChevronDown className="w-3 h-3 text-zinc-400" />
        </div>

        {/* Microphone Toggle */}
        <div className="flex items-center gap-2 bg-zinc-900/90 border border-zinc-800/90 px-3.5 py-1.5 rounded-xl shadow-md">
          <button
            onClick={() => setMicEnabled(!micEnabled)}
            className={`flex items-center gap-1.5 ${micEnabled ? 'text-zinc-100' : 'text-zinc-400'}`}
          >
            <Mic className="w-3.5 h-3.5" />
            <span>Default Mic</span>
          </button>
          <ChevronDown className="w-3 h-3 text-zinc-400" />
        </div>

        {/* System Audio Toggle */}
        <div className="flex items-center gap-2 bg-zinc-900/90 border border-zinc-800/90 px-3.5 py-1.5 rounded-xl shadow-md">
          <button
            onClick={() => setSysAudioEnabled(!sysAudioEnabled)}
            className={`flex items-center gap-1.5 ${sysAudioEnabled ? 'text-zinc-100' : 'text-zinc-400'}`}
          >
            <Volume2 className="w-3.5 h-3.5" />
            <span>System Audio</span>
          </button>
        </div>
      </div>
    </div>
  );
};
