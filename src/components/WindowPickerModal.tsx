import React, { useEffect, useState } from 'react';
import { X, AppWindow, RefreshCw } from 'lucide-react';
import { TauriBridge } from '../utils/tauriBridge';

interface WindowInfo {
  hwnd: number;
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  thumbnail?: string;
}

interface WindowPickerModalProps {
  isOpen: boolean;
  isMaximized?: boolean;
  onClose: () => void;
  onSelectWindow: (win: WindowInfo) => void;
}

export const WindowPickerModal: React.FC<WindowPickerModalProps> = ({
  isOpen,
  isMaximized = false,
  onClose,
  onSelectWindow,
}) => {
  const [windows, setWindows] = useState<WindowInfo[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadWindows();
    }
  }, [isOpen]);

  const loadWindows = async () => {
    setLoading(true);
    try {
      const list = await TauriBridge.listOpenWindows();
      setWindows(list);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className={`absolute inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-6 select-none animate-in fade-in duration-200 font-sans overflow-hidden ${
      isMaximized ? 'rounded-none' : 'rounded-[20px]'
    }`}>
      <div className="w-full max-w-4xl bg-[#141416] border border-zinc-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[85vh]">
        {/* Modal Header */}
        <div className="h-14 px-6 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold text-zinc-100 tracking-wide">Choose a window</h2>
            <button
              onClick={loadWindows}
              className={`text-zinc-500 hover:text-zinc-300 p-1 rounded-md transition-colors ${loading ? 'animate-spin' : ''}`}
              title="Refresh Windows"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Windows Grid (Screenshot 2 Style with Live Thumbnails) */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-3 gap-5">
          {windows.map((w) => (
            <div
              key={w.hwnd}
              onClick={() => onSelectWindow(w)}
              className="group flex flex-col gap-2.5 cursor-pointer"
            >
              {/* Window Preview Container */}
              <div className="w-full aspect-video rounded-2xl bg-zinc-950 border border-zinc-800/90 group-hover:border-indigo-500 group-hover:shadow-xl group-hover:shadow-indigo-500/20 p-2.5 flex flex-col justify-between transition-all duration-150 overflow-hidden relative">
                {/* Simulated window frame dots */}
                <div className="flex items-center gap-1.5 pb-1 border-b border-zinc-800/60 z-10 bg-zinc-950/80 -mx-2.5 -mt-2.5 px-3 pt-2">
                  <span className="w-2 h-2 rounded-full bg-zinc-700 group-hover:bg-red-400 transition-colors"></span>
                  <span className="w-2 h-2 rounded-full bg-zinc-700 group-hover:bg-amber-400 transition-colors"></span>
                  <span className="w-2 h-2 rounded-full bg-zinc-700 group-hover:bg-emerald-400 transition-colors"></span>
                </div>

                {/* Live Window Snapshot or Fallback Icon */}
                <div className="flex-1 w-full h-full flex items-center justify-center overflow-hidden rounded-xl mt-1.5 bg-black/40">
                  {w.thumbnail ? (
                    <img
                      src={w.thumbnail}
                      alt={w.title}
                      className="w-full h-full object-contain rounded-xl"
                    />
                  ) : (
                    <div className="flex items-center justify-center text-zinc-700 group-hover:text-indigo-400 transition-colors">
                      <AppWindow className="w-12 h-12 stroke-[1.25]" />
                    </div>
                  )}
                </div>
              </div>

              {/* Window Title Caption */}
              <span className="text-xs text-zinc-400 group-hover:text-zinc-100 font-medium truncate px-1 transition-colors">
                {w.title}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
