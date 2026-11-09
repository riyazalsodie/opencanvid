import React from 'react';
import { Loader2, X, Film } from 'lucide-react';

interface ExportProgressModalProps {
  isOpen: boolean;
  progress: number;
  status: 'preparing' | 'rendering' | 'saving' | 'done' | 'error';
  message: string;
  outputPath?: string;
  onClose: () => void;
}

export const ExportProgressModal: React.FC<ExportProgressModalProps> = ({
  isOpen,
  progress,
  status,
  message,
  outputPath,
  onClose,
}) => {
  if (!isOpen) return null;

  const isDone = status === 'done';
  const isError = status === 'error';

  return (
    <div className="fixed inset-0 z-[99999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 select-none font-sans">
      <div className="w-full max-w-md rounded-2xl bg-[#0f0f12] border border-zinc-800 shadow-2xl p-6 text-zinc-200 flex flex-col gap-5 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-500/15 text-blue-400">
              <Film className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-100 tracking-tight">
                {isDone ? 'Export Complete' : isError ? 'Export Failed' : 'Exporting Real Edited Video'}
              </h3>
              <p className="text-[11px] text-zinc-500">
                {isDone ? 'Video rendered and saved' : 'Rendering canvas, zooms, trims & vector cursors'}
              </p>
            </div>
          </div>

          {(isDone || isError) && (
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Progress Display */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-400 font-medium truncate max-w-[280px]">
              {message}
            </span>
            <span className="font-mono font-bold text-blue-400 text-sm">
              {progress}%
            </span>
          </div>

          {/* Progress Bar */}
          <div className="w-full h-2 rounded-full bg-zinc-800/80 overflow-hidden relative">
            <div
              className={`h-full transition-all duration-300 ease-out rounded-full ${
                isDone
                  ? 'bg-gradient-to-r from-emerald-500 to-green-400'
                  : isError
                  ? 'bg-red-500'
                  : 'bg-gradient-to-r from-blue-600 via-indigo-500 to-blue-400'
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Output path display when done */}
        {isDone && outputPath && (
          <div className="p-3 rounded-xl bg-zinc-900/90 border border-zinc-800/80 flex flex-col gap-1">
            <span className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">
              File Saved To
            </span>
            <span className="text-[11px] font-mono text-zinc-300 break-all select-all">
              {outputPath}
            </span>
          </div>
        )}

        {/* Action Button */}
        <div className="flex items-center justify-end gap-2 pt-1">
          {isDone ? (
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md shadow-emerald-600/30 transition-all"
            >
              Done
            </button>
          ) : isError ? (
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium transition-colors"
            >
              Close
            </button>
          ) : (
            <div className="flex items-center gap-2 text-xs text-zinc-400">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
              <span>Processing frames at 60 FPS...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
