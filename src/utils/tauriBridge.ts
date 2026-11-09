import type { MouseEventRecord, ZoomKeyframe } from '../types/canvid';

// Safe environment detection
export const isElectron = (): boolean => {
  return typeof window !== 'undefined' && (window as any).electronBridge !== undefined;
};

export const isTauri = (): boolean => {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
};

export async function invokeTauri<T>(cmd: string, args?: Record<string, any>): Promise<T> {
  if (isTauri()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke<T>(cmd, args);
    } catch (e) {
      console.warn(`[Tauri] Failed calling ${cmd}:`, e);
      throw e;
    }
  }
  throw new Error(`Tauri environment not detected for ${cmd}`);
}

export const TauriBridge = {
  async startMouseRecording(): Promise<string> {
    if (isElectron()) {
      return await (window as any).electronBridge.startMouseRecording();
    }
    if (isTauri()) {
      return await invokeTauri<string>('start_mouse_recording');
    }
    console.log('[Browser Fallback] Mouse recording started');
    return 'Browser mouse simulation active';
  },

  async stopMouseRecording(): Promise<MouseEventRecord[]> {
    if (isElectron()) {
      return await (window as any).electronBridge.stopMouseRecording();
    }
    if (isTauri()) {
      return await invokeTauri<MouseEventRecord[]>('stop_mouse_recording');
    }
    console.log('[Browser Fallback] Mouse recording stopped');
    return [];
  },

  async startWgcRecording(outputPath?: string): Promise<string | null> {
    if (isElectron() && (window as any).electronBridge?.startWgcRecording) {
      return await (window as any).electronBridge.startWgcRecording(outputPath);
    }
    return null;
  },

  async stopWgcRecording(): Promise<string | null> {
    if (isElectron() && (window as any).electronBridge?.stopWgcRecording) {
      return await (window as any).electronBridge.stopWgcRecording();
    }
    return null;
  },

  async readVideoFile(filePath: string): Promise<Uint8Array | null> {
    if (isElectron() && (window as any).electronBridge?.readVideoFile) {
      return await (window as any).electronBridge.readVideoFile(filePath);
    }
    return null;
  },

  async saveProjectFile(defaultName: string, content: string): Promise<{ success: boolean; filePath?: string }> {
    if (isElectron() && (window as any).electronBridge?.saveProjectFile) {
      return await (window as any).electronBridge.saveProjectFile({ defaultName, content });
    }
    return { success: false };
  },

  async prepareExportSession(): Promise<{ success: boolean; tempDir?: string }> {
    if (isElectron() && (window as any).electronBridge?.prepareExportSession) {
      return await (window as any).electronBridge.prepareExportSession();
    }
    return { success: false };
  },

  async writeExportFrameBatch(tempDir: string, frames: { index: number; dataUrl: string }[]): Promise<{ success: boolean }> {
    if (isElectron() && (window as any).electronBridge?.writeExportFrameBatch) {
      return await (window as any).electronBridge.writeExportFrameBatch({ tempDir, frames });
    }
    return { success: false };
  },

  async finalizeExportSession(opts: {
    tempDir: string;
    totalFrames: number;
    fps: number;
    sourceVideoPath?: string;
    defaultName?: string;
  }): Promise<{ success: boolean; filePath?: string; size?: number }> {
    if (isElectron() && (window as any).electronBridge?.finalizeExportSession) {
      return await (window as any).electronBridge.finalizeExportSession(opts);
    }
    return { success: false };
  },

  async saveExportedVideo(defaultName: string, buffer: ArrayBuffer): Promise<{ success: boolean; filePath?: string }> {
    if (isElectron() && (window as any).electronBridge?.saveExportedVideo) {
      return await (window as any).electronBridge.saveExportedVideo({ defaultName, buffer });
    }
    // Browser fallback download
    try {
      const blob = new Blob([buffer], { type: 'video/mp4' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = defaultName.endsWith('.mp4') ? defaultName : `${defaultName}.mp4`;
      a.click();
      URL.revokeObjectURL(url);
      return { success: true, filePath: a.download };
    } catch {
      return { success: false };
    }
  },

  async openProjectFile(): Promise<{ filePath: string; fileName: string; content: string } | null> {
    if (isElectron() && (window as any).electronBridge?.openProjectFile) {
      return await (window as any).electronBridge.openProjectFile();
    }
    return null;
  },

  async computeAutoZooms(
    events: MouseEventRecord[],
    screenWidth: number,
    screenHeight: number,
    level = 1.6
  ): Promise<ZoomKeyframe[]> {
    if (isTauri()) {
      const res = await invokeTauri<any[]>('compute_auto_zooms', {
        events,
        screenWidth,
        screenHeight,
        level,
      });
      return res.map((z, idx) => ({
        id: `zoom-${idx}`,
        start: z.start,
        end: z.end,
        level: z.level,
        focal_x: z.focal_x,
        focal_y: z.focal_y,
        disabled: z.disabled,
      }));
    }

    // Client-side auto-zoom generation with intelligent click clustering & camera centering
    const clicks = events.filter((e) => e.event_type === 'lclick' || e.event_type === 'rclick');
    const zooms: ZoomKeyframe[] = [];

    for (let i = 0; i < clicks.length; i++) {
      const c = clicks[i];
      const startMs = Math.max(0, c.t_ms - 250);
      const endMs = c.t_ms + 1200;
      const fx = screenWidth > 0 ? Math.max(0.02, Math.min(0.98, c.x / screenWidth)) : 0.5;
      const fy = screenHeight > 0 ? Math.max(0.02, Math.min(0.98, c.y / screenHeight)) : 0.5;

      const lastZoom = zooms[zooms.length - 1];
      // Merge overlapping/rapid consecutive clicks into one seamless cinematic camera move
      if (lastZoom && c.t_ms <= lastZoom.end + 200) {
        lastZoom.end = Math.max(lastZoom.end, endMs);
        lastZoom.focal_x = (lastZoom.focal_x + fx) / 2;
        lastZoom.focal_y = (lastZoom.focal_y + fy) / 2;
      } else {
        zooms.push({
          id: `zoom-${zooms.length}`,
          start: startMs,
          end: endMs,
          level,
          focal_x: fx,
          focal_y: fy,
        });
      }
    }

    return zooms;
  },

  async checkFFmpeg(): Promise<boolean> {
    if (isTauri()) {
      try {
        return await invokeTauri<boolean>('check_ffmpeg');
      } catch {
        return false;
      }
    }
    return true;
  },

  async renderExport(options: any): Promise<string> {
    if (isTauri()) {
      return await invokeTauri<string>('render_export', { options });
    }
    return 'Browser mode: rendering via client Canvas/WebCodecs';
  },

  async importCanvid(archivePath: string): Promise<any> {
    if (isTauri()) {
      return await invokeTauri<any>('import_canvid', { archivePath });
    }
    throw new Error('Canvid import requires Tauri runtime');
  },

  async getSystemPaths(): Promise<any> {
    if (isTauri()) {
      return await invokeTauri('get_system_paths');
    }
    return {};
  },

  async hideSystemCursor(): Promise<void> {
    if (isTauri()) {
      try {
        await invokeTauri('hide_system_cursor');
      } catch (e) {
        console.warn('Failed hiding system cursor:', e);
      }
    }
  },

  async restoreSystemCursor(): Promise<void> {
    if (isTauri()) {
      try {
        await invokeTauri('restore_system_cursor');
      } catch (e) {
        console.warn('Failed restoring system cursor:', e);
      }
    }
  },

  async setFullscreenMode(fullscreen: boolean): Promise<void> {
    if (isElectron()) {
      return await (window as any).electronBridge.setFullscreen(fullscreen);
    }
    if (isTauri()) {
      try {
        await invokeTauri('set_fullscreen_mode', { fullscreen });
      } catch (e) {
        console.warn('Failed setting fullscreen:', e);
      }
    }
  },

  async setRecordingFloatingMode(isRecording: boolean): Promise<void> {
    if (isElectron()) {
      return await (window as any).electronBridge.setRecordingFloatingMode(isRecording);
    }
    if (isTauri()) {
      try {
        await invokeTauri('set_recording_floating_mode', { isRecording });
      } catch (e) {
        console.warn('Failed setting recording floating mode:', e);
      }
    }
  },

  async minimizeWindow(): Promise<void> {
    if (isElectron()) {
      return await (window as any).electronBridge.minimizeWindow();
    }
    if (isTauri()) {
      await invokeTauri('minimize_window');
    }
  },

  async toggleMaximizeWindow(): Promise<boolean> {
    if (isElectron()) {
      return await (window as any).electronBridge.toggleMaximizeWindow();
    }
    if (isTauri()) {
      return await invokeTauri<boolean>('toggle_maximize_window');
    }
    return false;
  },

  async isWindowMaximized(): Promise<boolean> {
    if (isElectron()) {
      return await (window as any).electronBridge.isWindowMaximized();
    }
    if (isTauri()) {
      try {
        return await invokeTauri<boolean>('is_window_maximized');
      } catch {
        return false;
      }
    }
    return false;
  },

  async closeWindow(): Promise<void> {
    if (isElectron()) {
      return await (window as any).electronBridge.closeWindow();
    }
    if (isTauri()) {
      await invokeTauri('close_window');
    }
  },

  async listOpenWindows(): Promise<Array<{ hwnd: any; title: string; x: number; y: number; width: number; height: number; thumbnail: string; sourceId?: string }>> {
    if (isElectron()) {
      try {
        const sources = await (window as any).electronBridge.getSources();
        return sources.map((s: any, idx: number) => ({
          hwnd: idx + 1,
          title: s.name,
          x: 0,
          y: 0,
          width: 1920,
          height: 1080,
          thumbnail: s.thumbnail,
          sourceId: s.id,
        }));
      } catch (e) {
        console.warn('Failed listing windows in Electron:', e);
      }
    }
    if (isTauri()) {
      try {
        return await invokeTauri('list_open_windows');
      } catch (e) {
        console.warn('Failed listing windows:', e);
      }
    }
    // Realistic fallback windows if in browser mode
    return [
      { hwnd: 1, title: 'OpenCanvid Studio', x: 0, y: 0, width: 1920, height: 1080, thumbnail: '' },
      { hwnd: 2, title: 'Canva Open Source Clone - Visual Studio Code', x: 100, y: 100, width: 1400, height: 900, thumbnail: '' },
      { hwnd: 3, title: 'Facebook - Thorium Browser', x: 200, y: 150, width: 1200, height: 800, thumbnail: '' },
      { hwnd: 4, title: '#general | OXIDE | BANGLADESH - Discord', x: 50, y: 50, width: 1300, height: 850, thumbnail: '' },
      { hwnd: 5, title: 'NVIDIA GeForce Overlay', x: 0, y: 0, width: 1920, height: 1080, thumbnail: '' },
      { hwnd: 6, title: 'File Explorer - opencanvid', x: 300, y: 200, width: 1100, height: 700, thumbnail: '' },
    ];
  },
};
