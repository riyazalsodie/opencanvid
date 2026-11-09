const { contextBridge, ipcRenderer } = require('electron');

const bridge = {
  getSources: () => ipcRenderer.invoke('get-sources'),
  selectCaptureSource: (sourceId) => ipcRenderer.invoke('select-capture-source', sourceId),
  minimizeWindow: () => ipcRenderer.invoke('minimize-window'),
  toggleMaximizeWindow: () => ipcRenderer.invoke('toggle-maximize-window'),
  isWindowMaximized: () => ipcRenderer.invoke('is-window-maximized'),
  closeWindow: () => ipcRenderer.invoke('close-window'),
  setFullscreen: (flag) => ipcRenderer.invoke('set-fullscreen', flag),
  startMouseRecording: () => ipcRenderer.invoke('start-mouse-recording'),
  stopMouseRecording: () => ipcRenderer.invoke('stop-mouse-recording'),
  startWgcRecording: (outputPath) => ipcRenderer.invoke('start-wgc-recording', outputPath),
  stopWgcRecording: () => ipcRenderer.invoke('stop-wgc-recording'),
  readVideoFile: (filePath) => ipcRenderer.invoke('read-video-file', filePath),
  saveProjectFile: (opts) => ipcRenderer.invoke('save-project-file', opts),
  saveExportedVideo: (opts) => ipcRenderer.invoke('save-exported-video', opts),
  openProjectFile: () => ipcRenderer.invoke('open-project-file'),
  setRecordingFloatingMode: (flag) => ipcRenderer.invoke('set-recording-floating-mode', flag),
  onWindowState: (callback) => {
    ipcRenderer.on('window-state-changed', (_e, state) => callback(state));
  },
};

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('electronBridge', bridge);
} else {
  window.electronBridge = bridge;
}
