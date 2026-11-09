import React, { useState, useRef, useEffect } from 'react';
import { Film, SquareDashed, Maximize2, X } from 'lucide-react';
import { SleekSwitch } from './SleekControls';

interface QuickShareSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave?: (settings: QuickShareSettings) => void;
}

export interface QuickShareSettings {
  preset: 'draft' | 'standard' | 'custom';
  isCustom: boolean;
  frameRate: 30 | 60;
  resolution: '720p' | '1080p' | '1440p' | '4K';
  quality: 'Low' | 'Standard' | 'High' | 'Ultra';
}

export const QuickShareSettingsModal: React.FC<QuickShareSettingsModalProps> = ({
  isOpen,
  onClose,
  onSave: _onSave,
}) => {
  const [preset, setPreset] = useState<'draft' | 'standard'>('draft');
  const [isCustom, setIsCustom] = useState(true);
  const [frameRate, setFrameRate] = useState<30 | 60>(60);
  const [resolution, setResolution] = useState<'720p' | '1080p' | '1440p' | '4K'>('4K');
  const [quality, setQuality] = useState<'Low' | 'Standard' | 'High' | 'Ultra'>('Ultra');

  const containerRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('mousedown', handleClickOutside);
    }
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSelectPreset = (p: 'draft' | 'standard') => {
    setPreset(p);
    if (p === 'draft') {
      setFrameRate(30);
      setResolution('720p');
      setQuality('Low');
    } else {
      setFrameRate(60);
      setResolution('1080p');
      setQuality('Standard');
    }
  };

  return (
    <div
      ref={containerRef}
      className="absolute top-12 right-3 w-[370px] rounded-2xl bg-[#0e0e11]/98 border border-zinc-800/90 shadow-2xl p-5 text-zinc-200 select-none font-sans z-[9999] backdrop-blur-2xl animate-in fade-in slide-in-from-top-2 duration-150"
    >
      {/* Title & Close */}
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-[15px] font-semibold text-zinc-100 tracking-tight">
          Quick Share Settings
        </h3>
        <button
          onClick={onClose}
          className="w-6 h-6 rounded-lg flex items-center justify-center text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/60 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Description text */}
      <p className="text-[12px] text-zinc-400 leading-relaxed mb-4">
        Quick Share allows you to export, upload to cloud and use a share link, all with a single click!
      </p>

      {/* 2 Preset Cards: Draft & Standard */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {/* Draft Card */}
        <button
          type="button"
          onClick={() => handleSelectPreset('draft')}
          className={`flex flex-col items-start p-3.5 rounded-xl border text-left transition-all ${
            preset === 'draft' && !isCustom
              ? 'bg-[#18181c] border-zinc-600 shadow-sm'
              : 'bg-[#121215] border-zinc-800/90 hover:border-zinc-700'
          }`}
        >
          <span className="text-[13px] font-semibold text-zinc-200 mb-1">Draft</span>
          <span className="text-[11px] text-zinc-500 leading-tight">Faster, lower quality</span>
        </button>

        {/* Standard Card */}
        <button
          type="button"
          onClick={() => handleSelectPreset('standard')}
          className={`flex flex-col items-start p-3.5 rounded-xl border text-left transition-all ${
            preset === 'standard' && !isCustom
              ? 'bg-[#18181c] border-zinc-600 shadow-sm'
              : 'bg-[#121215] border-zinc-800/90 hover:border-zinc-700'
          }`}
        >
          <span className="text-[13px] font-semibold text-zinc-200 mb-1">Standard</span>
          <span className="text-[11px] text-zinc-500 leading-tight">Fast, decent quality</span>
        </button>
      </div>

      {/* Custom (Advanced) Toggle Switch */}
      <div className="flex items-center gap-3 py-1 mb-3">
        <SleekSwitch
          checked={isCustom}
          onChange={(val) => setIsCustom(val)}
        />
        <span className="text-[13px] font-semibold text-zinc-200">Custom (Advanced)</span>
      </div>

      {/* Custom Settings Block */}
      {isCustom && (
        <div className="flex flex-col gap-4 pt-1 animate-in fade-in duration-150">
          {/* Frame Rate */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-zinc-300">
              <Film className="w-3.5 h-3.5 text-zinc-400" />
              <span className="text-[12px] font-medium">Frame rate</span>
            </div>
            <div className="flex items-center gap-2">
              {[30, 60].map((fps) => (
                <button
                  key={fps}
                  type="button"
                  onClick={() => setFrameRate(fps as 30 | 60)}
                  className={`px-3 py-1 rounded-full text-[12px] font-medium transition-all ${
                    frameRate === fps
                      ? 'bg-[#222226] text-white shadow-sm font-semibold'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
                  }`}
                >
                  {fps} FPS
                </button>
              ))}
            </div>
          </div>

          {/* Resolution */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-zinc-300">
              <SquareDashed className="w-3.5 h-3.5 text-zinc-400" />
              <span className="text-[12px] font-medium">Resolution</span>
            </div>
            <div className="flex items-center gap-2">
              {(['720p', '1080p', '1440p', '4K'] as const).map((res) => (
                <button
                  key={res}
                  type="button"
                  onClick={() => setResolution(res)}
                  className={`px-3 py-1 rounded-full text-[12px] font-medium transition-all ${
                    resolution === res
                      ? 'bg-[#222226] text-white shadow-sm font-semibold'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
                  }`}
                >
                  {res}
                </button>
              ))}
            </div>
          </div>

          {/* Quality */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-zinc-300">
              <Maximize2 className="w-3.5 h-3.5 text-zinc-400" />
              <span className="text-[12px] font-medium">Quality</span>
            </div>
            <div className="flex items-center gap-2">
              {(['Low', 'Standard', 'High', 'Ultra'] as const).map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setQuality(q)}
                  className={`px-3 py-1 rounded-full text-[12px] font-medium transition-all ${
                    quality === q
                      ? 'bg-[#222226] text-white shadow-sm font-semibold'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
                  }`}
                >
                  {q}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              Highest quality, but large file size.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
