import React from 'react';
import { Download, FolderOpen, Disc } from 'lucide-react';

interface HeaderProps {
  aspectRatio: '16:9' | '9:16' | '4:3' | '1:1';
  setAspectRatio: (ar: '16:9' | '9:16' | '4:3' | '1:1') => void;
  onOpenRecordModal: () => void;
  onExport: () => void;
  onImportFile: () => void;
  onSaveArchive?: () => void;
  ffmpegReady?: boolean;
  isExporting: boolean;
  projectName?: string;
}

export const Header: React.FC<HeaderProps> = ({
  aspectRatio,
  setAspectRatio,
  onOpenRecordModal,
  onExport,
  onImportFile,
  onSaveArchive: _onSaveArchive,
  isExporting,
  projectName = 'OpenCanvid Studio',
}) => {
  return (
    <header className="h-12 border-b border-zinc-800/80 bg-[#121214] px-4 flex items-center justify-between select-none font-sans text-xs">
      {/* Left: Project File Name (Canvid Screenshot 3) */}
      <div className="flex items-center gap-3">
        <span className="text-zinc-400 font-mono text-[11px] truncate max-w-xs">
          *{projectName}.canvid
        </span>

        {/* Aspect Ratio Switcher */}
        <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-lg p-0.5 text-[11px]">
          {(['16:9', '9:16', '4:3', '1:1'] as const).map((ratio) => (
            <button
              key={ratio}
              onClick={() => setAspectRatio(ratio)}
              className={`px-2 py-0.5 rounded transition-colors ${
                aspectRatio === ratio
                  ? 'bg-zinc-800 text-zinc-100 font-medium'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {ratio}
            </button>
          ))}
        </div>
      </div>

      {/* Center: CANVI▷ Logo (Canvid Screenshot 3) */}
      <div className="flex items-center gap-1 font-bold tracking-wider text-sm">
        <span className="text-white">CANVI</span>
        <span className="text-indigo-400 font-extrabold text-base">▷</span>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2.5">
        {/* New Recording Button */}
        <button
          onClick={onOpenRecordModal}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors"
        >
          <Disc className="w-3.5 h-3.5 text-red-400" />
          <span>Record</span>
        </button>

        {/* Import .canvid */}
        <button
          onClick={onImportFile}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-800 transition-colors"
          title="Open .canvid Project"
        >
          <FolderOpen className="w-3.5 h-3.5" />
          <span>Open</span>
        </button>

        {/* Blue Export Button (Canvid Screenshot 3) */}
        <button
          onClick={onExport}
          disabled={isExporting}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium shadow-md shadow-blue-600/30 transition-all hover:scale-102 active:scale-98 disabled:opacity-50"
        >
          <Download className="w-3.5 h-3.5" />
          <span>{isExporting ? 'Exporting...' : 'Export'}</span>
        </button>
      </div>
    </header>
  );
};
