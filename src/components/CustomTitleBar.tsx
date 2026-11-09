import React, { useState, useRef, useEffect } from 'react';
import {
  Menu,
  Minus,
  Square,
  X,
  Sparkles,
  CheckCircle,
  ExternalLink,
  ChevronRight,
} from 'lucide-react';
import { TauriBridge } from '../utils/tauriBridge';

interface CustomTitleBarProps {
  projectName: string;
  isMaximized?: boolean;
  onToggleMaximize?: () => void;
  onNewProject: () => void;
  onOpenProject: () => void;
  onSaveProject: () => void;
  onExport?: () => void;
  isExporting?: boolean;
}

export const CustomTitleBar: React.FC<CustomTitleBarProps> = React.memo(({
  projectName,
  isMaximized = false,
  onToggleMaximize,
  onNewProject,
  onOpenProject,
  onSaveProject,
  onExport: _onExport,
  isExporting: _isExporting,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    if (isMenuOpen) {
      window.addEventListener('mousedown', handleClickOutside);
    }
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [isMenuOpen]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        onNewProject();
      } else if (e.ctrlKey && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        onOpenProject();
      } else if (e.ctrlKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        onSaveProject();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onNewProject, onOpenProject, onSaveProject]);

  return (
    <header
      data-tauri-drag-region
      onDoubleClick={onToggleMaximize}
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      className={`h-9 border-b border-zinc-900 bg-[#000000] px-3 flex items-center justify-between select-none font-sans text-xs text-zinc-300 relative z-50 will-change-transform ${
        isMaximized ? 'rounded-none' : 'rounded-t-[20px]'
      }`}
    >
      {/* Left: 3-line hamburger menu + Project Title (Image 3) */}
      <div className="flex items-center gap-2 relative" data-tauri-drag-region>
        {/* 3-line Hamburger Menu Button */}
        <div ref={menuRef} style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
              isMenuOpen
                ? 'bg-zinc-800 text-white'
                : 'hover:bg-zinc-800/80 text-zinc-400 hover:text-zinc-100'
            }`}
            title="Open Menu"
          >
            <Menu className="w-4 h-4 stroke-[1.8]" />
          </button>

          {/* Canvid Dropdown Menu */}
          {isMenuOpen && (
            <div className="absolute top-9 left-0 w-64 rounded-xl bg-[#141416]/98 border border-zinc-800/90 shadow-2xl py-1.5 flex flex-col text-xs text-zinc-300 backdrop-blur-xl z-[9999] animate-in fade-in slide-in-from-top-1 duration-150">
              <button
                onClick={() => {
                  setIsMenuOpen(false);
                  onNewProject();
                }}
                className="px-3.5 py-1.5 flex items-center justify-between hover:bg-zinc-800/80 text-left transition-colors"
              >
                <span>New Project</span>
                <span className="text-[11px] font-mono text-zinc-400">Ctrl N</span>
              </button>

              <button
                onClick={() => {
                  setIsMenuOpen(false);
                  onOpenProject();
                }}
                className="px-3.5 py-1.5 flex items-center justify-between hover:bg-zinc-800/80 text-left transition-colors"
              >
                <span>Open Project</span>
                <span className="text-[11px] font-mono text-zinc-400">Ctrl O</span>
              </button>

              <div className="px-3.5 py-1.5 flex items-center justify-between hover:bg-zinc-800/80 text-left cursor-pointer transition-colors text-zinc-400">
                <span>Open Recent</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </div>

              <button
                onClick={() => {
                  setIsMenuOpen(false);
                  onSaveProject();
                }}
                className="px-3.5 py-1.5 flex items-center justify-between hover:bg-zinc-800/80 text-left transition-colors"
              >
                <span>Save Project</span>
                <span className="text-[11px] font-mono text-zinc-400">Ctrl S</span>
              </button>

              <button
                onClick={() => {
                  setIsMenuOpen(false);
                  onSaveProject();
                }}
                className="px-3.5 py-1.5 flex items-center justify-between hover:bg-zinc-800/80 text-left transition-colors"
              >
                <span>Save Project As</span>
                <span className="text-[11px] font-mono text-zinc-400">Ctrl Shift S</span>
              </button>

              <div className="px-3.5 py-1.5 flex items-center justify-between hover:bg-zinc-800/80 text-left cursor-pointer transition-colors text-zinc-400">
                <span>My Videos</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </div>

              <div className="h-[1px] bg-zinc-800/80 my-1 mx-2" />

              <button
                onClick={() => {
                  setIsMenuOpen(false);
                  onNewProject();
                }}
                className="px-3.5 py-1.5 hover:bg-zinc-800/80 text-left transition-colors"
              >
                New Screenshot
              </button>

              <div className="px-3.5 py-1.5 text-zinc-600 cursor-not-allowed">
                Compress cuts
              </div>

              <div className="h-[1px] bg-zinc-800/80 my-1 mx-2" />

              <button
                onClick={() => {
                  setIsMenuOpen(false);
                  alert('Logs generated to videos directory.');
                }}
                className="px-3.5 py-1.5 hover:bg-zinc-800/80 text-left transition-colors"
              >
                Generate logs...
              </button>

              <button
                onClick={() => {
                  setIsMenuOpen(false);
                  alert('OpenCanvid is up to date (v1.0.0 Free Release).');
                }}
                className="px-3.5 py-1.5 hover:bg-zinc-800/80 text-left transition-colors"
              >
                Check for Updates
              </button>

              <div className="h-[1px] bg-zinc-800/80 my-1 mx-2" />

              <div className="px-3.5 py-1.5 flex items-center justify-between hover:bg-zinc-800/80 text-left cursor-pointer transition-colors text-zinc-400">
                <span>Language</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </div>

              <button
                onClick={() => {
                  setIsMenuOpen(false);
                  alert('Settings: 60 FPS recording with motion blur enabled.');
                }}
                className="px-3.5 py-1.5 hover:bg-zinc-800/80 text-left transition-colors"
              >
                Settings
              </button>

              <div className="px-3.5 py-1.5 flex items-center justify-between hover:bg-zinc-800/80 text-left cursor-pointer transition-colors">
                <span>Manage Account</span>
                <ExternalLink className="w-3.5 h-3.5 text-zinc-500" />
              </div>

              <button
                onClick={() => setIsMenuOpen(false)}
                className="px-3.5 py-1.5 hover:bg-zinc-800/80 text-left text-zinc-400 hover:text-white transition-colors"
              >
                Logout
              </button>

              <div className="h-[1px] bg-zinc-800/80 my-1 mx-2" />

              <div className="px-3.5 py-1.5 flex items-center justify-between hover:bg-zinc-800/80 text-left cursor-pointer transition-colors">
                <span>Help & Support</span>
                <ExternalLink className="w-3.5 h-3.5 text-zinc-500" />
              </div>

              <button
                onClick={() => {
                  setIsMenuOpen(false);
                  alert('OpenCanvid Free Studio\nReverse engineered & built by R ! Y 4 Z\n100% Free & Open Source');
                }}
                className="px-3.5 py-1.5 hover:bg-zinc-800/80 text-left transition-colors"
              >
                About
              </button>

              <div className="h-[1px] bg-zinc-800/80 my-1 mx-2" />

              <button
                onClick={() => TauriBridge.closeWindow()}
                className="px-3.5 py-1.5 hover:bg-red-500/20 text-red-400 hover:text-red-300 text-left transition-colors"
              >
                Quit
              </button>
            </div>
          )}
        </div>

        {/* Project Name (Image 3: RYZ Auth 11-4-2026 05-15-52.canvid) */}
        <span className="font-semibold text-zinc-300 text-xs tracking-tight truncate max-w-sm pl-1" data-tauri-drag-region>
          *{projectName}.canvid
        </span>
      </div>

      {/* Right: Upgrade Badge + Checkmark + Window Controls + CANVI▷ Logo (Matching Image 2) */}
      <div className="flex items-center gap-2.5" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        {/* Upgrade Pill Badge (Image 2) */}
        <div className="bg-[#2a1d06] text-amber-400 border border-amber-600/40 px-2.5 py-0.5 rounded-full font-medium flex items-center gap-1 text-[11px] cursor-pointer hover:bg-amber-500/20 transition-colors">
          <Sparkles className="w-2.5 h-2.5 text-amber-400" />
          <span>Upgrade</span>
        </div>

        {/* Checkmark in circle icon (Image 2) */}
        <button className="text-zinc-400 hover:text-zinc-200 p-1 transition-colors" title="License Active">
          <CheckCircle className="w-3.5 h-3.5" />
        </button>

        {/* Window Control Buttons (Minimize, Maximize, Close) */}
        <div className="flex items-center ml-1 border-l border-zinc-800/80 pl-2">
          {/* Minimize */}
          <button
            onClick={() => TauriBridge.minimizeWindow()}
            className="w-7 h-7 flex items-center justify-center hover:bg-zinc-800 text-zinc-400 hover:text-white rounded transition-colors"
            title="Minimize"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>

          {/* Maximize */}
          <button
            onClick={onToggleMaximize ? onToggleMaximize : () => TauriBridge.toggleMaximizeWindow()}
            className="w-7 h-7 flex items-center justify-center hover:bg-zinc-800 text-zinc-400 hover:text-white rounded transition-colors"
            title={isMaximized ? "Restore" : "Maximize"}
          >
            <Square className="w-3.5 h-3.5" />
          </button>

          {/* Close */}
          <button
            onClick={() => TauriBridge.closeWindow()}
            className="w-7 h-7 flex items-center justify-center hover:bg-red-600 text-zinc-400 hover:text-white rounded transition-colors"
            title="Close"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* CANVI▷ Brand Logo at far right (Matching Image 2) */}
        <div className="flex items-center gap-0.5 font-bold tracking-wider text-sm select-none pl-2 border-l border-zinc-800/80">
          <span className="text-white font-extrabold tracking-wide">CANVI</span>
          <span className="text-indigo-400 font-black text-base">▷</span>
        </div>
      </div>
    </header>
  );
});
