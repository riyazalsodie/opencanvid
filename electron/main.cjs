const { app, BrowserWindow, ipcMain, desktopCapturer, session, protocol, net, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const url = require('url');
const { execSync } = require('child_process');

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'media',
    privileges: {
      standard: true,
      secure: true,
      stream: true,
      bypassCSP: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
]);

const logPath = 'e:\\Game Automation\\oxide_stuff\\opencanvid\\electron_debug.log';
fs.writeFileSync(logPath, '--- Electron Startup Log ---\n');
function log(...args) {
  try {
    fs.appendFileSync(logPath, args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ') + '\n');
  } catch (e) {}
}

process.on('uncaughtException', (err) => {
  log('Uncaught Exception:', err.stack || err);
});

app.commandLine.appendSwitch('allow-file-access-from-files');
app.commandLine.appendSwitch('enable-experimental-web-platform-features');
app.commandLine.appendSwitch('enable-features', 'SharedArrayBuffer,WindowsGraphicsCapture');
app.commandLine.appendSwitch('disable-features', 'BlockInsecurePrivateNetworkRequests,UseEcoQoSForBackgroundProcess');
app.commandLine.appendSwitch('disable-renderer-backgrounding');

let mainWindow = null;
let selectedCaptureSourceId = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 100,
    minHeight: 50,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false,
      sandbox: false,
      backgroundThrottling: false,
    },
  });

  // Enable Direct Hardware Capture without ANY browser confirmation dialog
  session.defaultSession.setDisplayMediaRequestHandler((_request, callback) => {
    desktopCapturer.getSources({ types: ['screen', 'window'] }).then((sources) => {
      if (selectedCaptureSourceId) {
        const found = sources.find((s) => s.id === selectedCaptureSourceId);
        if (found) {
          callback({ video: found });
          return;
        }
      }
      // Fallback to first available screen/window
      callback({ video: sources[0] });
    });
  });

  const candidates = [
    path.join(__dirname, '..', 'dist', 'index.html'),
    path.join(__dirname, 'dist', 'index.html'),
    path.join(app.getAppPath(), 'dist', 'index.html'),
  ];
  const distPath = candidates.find((p) => fs.existsSync(p));
  log('Candidates checked:', candidates);
  log('Selected distPath:', distPath);

  if (distPath) {
    mainWindow.loadFile(distPath);
  } else {
    log('Fallback to localhost:5173');
    mainWindow.loadURL('http://localhost:5173');
  }

  mainWindow.webContents.on('did-finish-load', () => {
    log('[DID FINISH LOAD]');
  });

  mainWindow.webContents.on('console-message', (_e, level, message, line, sourceId) => {
    log(`[WEB CONSOLE ${level}] ${message} (Line ${line} in ${sourceId})`);
  });

  mainWindow.webContents.on('did-fail-load', (_e, code, desc) => {
    log(`[FAIL LOAD] ${code}: ${desc}`);
  });

  mainWindow.webContents.on('render-process-gone', (_e, details) => {
    log('[RENDER PROCESS GONE]', details);
  });

  // Window state notification to frontend on discrete state changes (zero-lag snapping)
  mainWindow.on('maximize', () => {
    mainWindow?.webContents.send('window-state-changed', { isMaximized: true });
  });

  mainWindow.on('unmaximize', () => {
    mainWindow?.webContents.send('window-state-changed', { isMaximized: false });
  });

  mainWindow.on('resize', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('window-state-changed', { isMaximized: mainWindow.isMaximized() });
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC Handlers
ipcMain.handle('get-sources', async () => {
  const sources = await desktopCapturer.getSources({
    types: ['window', 'screen'],
    thumbnailSize: { width: 640, height: 360 },
    fetchWindowIcons: true,
  });

  return sources.map((s) => ({
    id: s.id,
    name: s.name,
    thumbnail: s.thumbnail.toDataURL(),
    appIcon: s.appIcon ? s.appIcon.toDataURL() : null,
  }));
});

ipcMain.handle('select-capture-source', (_event, sourceId) => {
  selectedCaptureSourceId = sourceId;
  return true;
});

ipcMain.handle('minimize-window', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.handle('toggle-maximize-window', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
      return false;
    } else {
      mainWindow.maximize();
      return true;
    }
  }
  return false;
});

ipcMain.handle('is-window-maximized', () => {
  return mainWindow ? mainWindow.isMaximized() : false;
});

ipcMain.handle('close-window', () => {
  if (mainWindow) mainWindow.close();
});

ipcMain.handle('set-fullscreen', (_event, flag) => {
  if (mainWindow) mainWindow.setFullScreen(flag);
});

const { spawn } = require('child_process');
const readline = require('readline');

let trackerProcess = null;
let mouseTrackingInterval = null;
let recordedMouseEvents = [];
let recordingStartTime = 0;
let wgcProcess = null;
let wgcOutputPath = null;

ipcMain.handle('start-wgc-recording', (_event, customPath) => {
  const candidates = [
    path.join(__dirname, 'native', 'wgc_recorder.exe'),
    path.join(app.getAppPath(), 'electron', 'native', 'wgc_recorder.exe'),
    path.join(process.resourcesPath || '', 'app', 'electron', 'native', 'wgc_recorder.exe'),
  ];
  const wgcExe = candidates.find((p) => fs.existsSync(p));
  if (!wgcExe) {
    log('wgc_recorder.exe not found');
    return null;
  }

  const outDir = app.getPath('temp');
  wgcOutputPath = customPath || path.join(outDir, `opencanvid_${Date.now()}.mp4`);

  log('Starting Native WGC Recorder (WithoutCursor):', wgcExe, '->', wgcOutputPath);
  try {
    wgcProcess = spawn(wgcExe, [wgcOutputPath], {
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    wgcProcess.on('error', (err) => {
      log('WGC recorder process error:', err);
    });

    return wgcOutputPath;
  } catch (err) {
    log('Failed spawning wgc_recorder:', err);
    return null;
  }
});

ipcMain.handle('stop-wgc-recording', async () => {
  if (!wgcProcess) return wgcOutputPath;
  return new Promise((resolve) => {
    try {
      wgcProcess.stdin.write('\n');
      wgcProcess.stdin.end();
    } catch (e) {}

    const timeout = setTimeout(() => {
      try { wgcProcess.kill(); } catch (e) {}
      wgcProcess = null;
      resolve(wgcOutputPath);
    }, 2500);

    wgcProcess.on('exit', () => {
      clearTimeout(timeout);
      wgcProcess = null;
      resolve(wgcOutputPath);
    });
  });
});

ipcMain.handle('read-video-file', (_event, filePath) => {
  try {
    if (filePath && fs.existsSync(filePath)) {
      const buf = fs.readFileSync(filePath);
      log('Read video file successfully. Size bytes:', buf.length);
      return buf;
    }
  } catch (e) {
    log('Failed reading video file:', e);
  }
  return null;
});

ipcMain.handle('save-project-file', async (_event, { defaultName, content }) => {
  try {
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'Save Canvid Project',
      defaultPath: defaultName ? (defaultName.endsWith('.canvid') ? defaultName : `${defaultName}.canvid`) : 'Project.canvid',
      filters: [
        { name: 'Canvid Project (*.canvid)', extensions: ['canvid', 'json'] },
        { name: 'All Files (*.*)', extensions: ['*'] },
      ],
    });
    if (canceled || !filePath) return { success: false };
    fs.writeFileSync(filePath, content, 'utf-8');
    log('Project successfully saved to:', filePath);
    return { success: true, filePath };
  } catch (e) {
    log('Error saving project file:', e);
    return { success: false, error: String(e) };
  }
});

ipcMain.handle('prepare-export-session', async () => {
  try {
    const tempDir = path.join(app.getPath('temp'), `opencanvid_frames_${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });
    log('Prepared export frames temp dir:', tempDir);
    return { success: true, tempDir };
  } catch (e) {
    log('Failed preparing export session:', e);
    return { success: false, error: String(e) };
  }
});

ipcMain.handle('write-export-frame-batch', async (_event, { tempDir, frames }) => {
  try {
    if (!tempDir || !Array.isArray(frames)) return { success: false };
    for (const f of frames) {
      const commaIdx = f.dataUrl.indexOf(',');
      const b64 = commaIdx !== -1 ? f.dataUrl.slice(commaIdx + 1) : f.dataUrl;
      const buf = Buffer.from(b64, 'base64');
      const filename = `frame_${String(f.index).padStart(6, '0')}.jpg`;
      fs.writeFileSync(path.join(tempDir, filename), buf);
    }
    return { success: true };
  } catch (e) {
    log('Error writing export frame batch:', e);
    return { success: false, error: String(e) };
  }
});

function getFfmpegPath() {
  const candidates = [
    'C:\\Users\\Administrator\\AppData\\Local\\Microsoft\\WinGet\\Links\\ffmpeg.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'WinGet', 'Links', 'ffmpeg.exe'),
    'ffmpeg',
  ];
  for (const c of candidates) {
    try {
      if (fs.existsSync(c)) {
        return c;
      }
    } catch {}
  }
  return 'ffmpeg';
}

ipcMain.handle('finalize-export-session', async (_event, { tempDir, totalFrames, fps, sourceVideoPath, audioOffset, crf, defaultName }) => {
  try {
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'Export Final Edited Video',
      defaultPath: defaultName ? (defaultName.endsWith('.mp4') ? defaultName : `${defaultName}.mp4`) : 'OpenCanvid_Export.mp4',
      filters: [
        { name: 'MP4 Video (*.mp4)', extensions: ['mp4'] },
        { name: 'All Files (*.*)', extensions: ['*'] },
      ],
    });
    if (canceled || !filePath) {
      try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
      return { success: false };
    }

    log(`Stitching ${totalFrames} frames from ${tempDir} at ${fps} fps to ${filePath}...`);

    let audioArgs = '';
    if (sourceVideoPath && fs.existsSync(sourceVideoPath)) {
      const ssArg = (typeof audioOffset === 'number' && audioOffset > 0) ? `-ss ${audioOffset}` : '';
      audioArgs = `${ssArg} -i "${sourceVideoPath}" -map 0:v:0 -map 1:a:0? -c:a aac -b:a 192k -shortest`;
    } else {
      audioArgs = '-map 0:v:0';
    }

    const ffmpegExe = getFfmpegPath();
    const framePattern = path.join(tempDir, 'frame_%06d.jpg');
    const safeCrf = typeof crf === 'number' ? crf : 18;
    const ffmpegCmd = `"${ffmpegExe}" -y -framerate ${fps || 30} -i "${framePattern}" ${audioArgs} -c:v libx264 -preset veryfast -crf ${safeCrf} -pix_fmt yuv420p -movflags +faststart "${filePath}"`;
    log('Running FFmpeg command:', ffmpegCmd);
    execSync(ffmpegCmd, { stdio: 'pipe', windowsHide: true });

    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}

    const stat = fs.statSync(filePath);
    log(`Export succeeded! File size: ${stat.size} bytes: ${filePath}`);
    return { success: true, filePath, size: stat.size };
  } catch (e) {
    log('Error in finalize-export-session:', e);
    try { if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
    return { success: false, error: String(e) };
  }
});

ipcMain.handle('save-exported-video', async (_event, { defaultName, buffer }) => {
  try {
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'Export Final Edited Video',
      defaultPath: defaultName ? (defaultName.endsWith('.mp4') ? defaultName : `${defaultName}.mp4`) : 'OpenCanvid_Export.mp4',
      filters: [
        { name: 'MP4 Video (*.mp4)', extensions: ['mp4'] },
        { name: 'WebM Video (*.webm)', extensions: ['webm'] },
        { name: 'All Files (*.*)', extensions: ['*'] },
      ],
    });
    if (canceled || !filePath) return { success: false };
    fs.writeFileSync(filePath, Buffer.from(buffer));
    log('Exported video successfully written to:', filePath);
    return { success: true, filePath };
  } catch (e) {
    log('Error saving exported video file:', e);
    return { success: false, error: String(e) };
  }
});

ipcMain.handle('open-project-file', async () => {
  try {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: 'Open Canvid Project',
      properties: ['openFile'],
      filters: [
        { name: 'Canvid Project (*.canvid, *.json)', extensions: ['canvid', 'json'] },
        { name: 'Video Files', extensions: ['mp4', 'webm', 'mov', 'mkv'] },
        { name: 'All Files (*.*)', extensions: ['*'] },
      ],
    });
    if (canceled || !filePaths || filePaths.length === 0) return null;
    const filePath = filePaths[0];
    const content = fs.readFileSync(filePath, 'utf-8');
    log('Opened project file:', filePath, 'Bytes:', content.length);
    return { filePath, fileName: path.basename(filePath), content };
  } catch (e) {
    log('Error opening project file:', e);
    return null;
  }
});

ipcMain.handle('start-mouse-recording', () => {
  recordedMouseEvents = [];
  recordingStartTime = Date.now();

  // Try locating native Win32 mouse tracker executable
  const candidates = [
    path.join(__dirname, 'native', 'native_mouse_tracker.exe'),
    path.join(app.getAppPath(), 'electron', 'native', 'native_mouse_tracker.exe'),
    path.join(process.resourcesPath || '', 'app', 'electron', 'native', 'native_mouse_tracker.exe'),
  ];
  const trackerExe = candidates.find((p) => fs.existsSync(p));

  if (trackerExe) {
    try {
      log('Spawning native tracker (pointer visible to user):', trackerExe);
      trackerProcess = spawn(trackerExe, [], {
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'ignore'],
      });

      const rl = readline.createInterface({ input: trackerProcess.stdout });
      rl.on('line', (line) => {
        try {
          const ev = JSON.parse(line.trim());
          recordedMouseEvents.push(ev);
        } catch (e) {}
      });

      trackerProcess.on('error', (err) => {
        log('Tracker process spawn error:', err);
      });
      return 'Native Win32 tracker started';
    } catch (err) {
      log('Tracker process exception:', err);
    }
  }

  // Fallback to electronScreen sampling
  log('Fallback to electronScreen interval tracker');
  const electronScreen = require('electron').screen;
  if (mouseTrackingInterval) clearInterval(mouseTrackingInterval);
  mouseTrackingInterval = setInterval(() => {
    try {
      const pt = electronScreen.getCursorScreenPoint();
      recordedMouseEvents.push({
        t_ms: Date.now() - recordingStartTime,
        x: pt.x,
        y: pt.y,
        event_type: 'move',
      });
    } catch (e) {}
  }, 16);

  return 'Tracking started';
});

ipcMain.handle('stop-mouse-recording', () => {
  if (trackerProcess) {
    try {
      trackerProcess.kill();
    } catch (e) {}
    trackerProcess = null;
  }
  // Guarantee system cursor is restored under any circumstance
  const candidates = [
    path.join(__dirname, 'native', 'native_mouse_tracker.exe'),
    path.join(app.getAppPath(), 'electron', 'native', 'native_mouse_tracker.exe'),
    path.join(process.resourcesPath || '', 'app', 'electron', 'native', 'native_mouse_tracker.exe'),
  ];
  const trackerExe = candidates.find((p) => fs.existsSync(p));
  if (trackerExe) {
    try {
      spawn(trackerExe, ['--restore-only'], { windowsHide: true, detached: true });
    } catch (e) {}
  }

  if (mouseTrackingInterval) {
    clearInterval(mouseTrackingInterval);
    mouseTrackingInterval = null;
  }
  log('Stopped mouse tracking. Total events logged:', recordedMouseEvents.length);
  return recordedMouseEvents;
});

ipcMain.handle('set-recording-floating-mode', (_event, isRecording) => {
  if (!mainWindow) return;
  const electronScreen = require('electron').screen;
  if (isRecording) {
    // Exclude this overlay window from screen recording completely (WDA_EXCLUDEFROMCAPTURE)
    try {
      mainWindow.setContentProtection(true);
      log('[CAPTURE] setContentProtection(true): Window is completely excluded from recordings.');
    } catch (e) {
      log('[CAPTURE] Failed to setContentProtection:', e);
    }

    // Unmaximize and exit fullscreen first to avoid full-screen black window
    if (mainWindow.isFullScreen()) mainWindow.setFullScreen(false);
    if (mainWindow.isMaximized()) mainWindow.unmaximize();

    const primaryDisplay = electronScreen.getPrimaryDisplay();
    const { width: screenW, height: screenH } = primaryDisplay.workAreaSize;
    const barW = 460;
    const barH = 76;
    const x = Math.round((screenW - barW) / 2);
    const y = Math.round(screenH - barH - 32);

    mainWindow.setMinimumSize(100, 50);
    mainWindow.setBounds({ x, y, width: barW, height: barH });
    mainWindow.setAlwaysOnTop(true, 'screen-saver', 1);
    mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    mainWindow.show();
    mainWindow.moveTop();
    mainWindow.focus();
  } else {
    try {
      mainWindow.setContentProtection(false);
    } catch (e) {}

    mainWindow.setAlwaysOnTop(false);
    mainWindow.setSize(1280, 820);
    mainWindow.center();
    mainWindow.show();
    mainWindow.focus();
  }
});

app.whenReady().then(() => {
  protocol.handle('media', (request) => {
    try {
      if (request.method === 'OPTIONS') {
        return new Response(null, {
          status: 204,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
            'Access-Control-Allow-Headers': '*',
          },
        });
      }

      const parsed = new URL(request.url);
      const filePath = parsed.searchParams.get('path');
      if (!filePath || !fs.existsSync(filePath)) {
        log('[MEDIA PROTOCOL] File not found:', filePath);
        return new Response('File not found', {
          status: 404,
          headers: { 'Access-Control-Allow-Origin': '*' },
        });
      }

      const stats = fs.statSync(filePath);
      const range = request.headers.get('range');
      let status = 200;
      let opts = {};
      const headers = {
        'Content-Type': 'video/mp4',
        'Accept-Ranges': 'bytes',
        'Content-Length': stats.size.toString(),
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Expose-Headers': 'Content-Range, Content-Length, Accept-Ranges',
      };

      if (range) {
        status = 206;
        const [x, y] = range.replace('bytes=', '').split('-');
        let start = parseInt(x, 10) || 0;
        let end = parseInt(y, 10) || stats.size - 1;
        if (end >= stats.size) end = stats.size - 1;
        if (start >= stats.size) {
          headers['Content-Range'] = `bytes */${stats.size}`;
          return new Response(null, { status: 416, headers });
        }
        opts = { start, end };
        headers['Content-Range'] = `bytes ${start}-${end}/${stats.size}`;
        headers['Content-Length'] = (end - start + 1).toString();
      }

      log(`[MEDIA PROTOCOL] Serving ${path.basename(filePath)} (${status}) bytes: ${headers['Content-Length']}`);
      const stream = fs.createReadStream(filePath, opts);
      return new Response(stream, { status, headers });
    } catch (e) {
      log('[MEDIA PROTOCOL ERROR]:', e.stack || e);
      return new Response('Internal error', {
        status: 500,
        headers: { 'Access-Control-Allow-Origin': '*' },
      });
    }
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('before-quit', () => {
  if (wgcProcess) {
    try { wgcProcess.kill(); } catch (e) {}
    wgcProcess = null;
  }
  if (trackerProcess) {
    try { trackerProcess.kill(); } catch (e) {}
    trackerProcess = null;
  }
  const candidates = [
    path.join(__dirname, 'native', 'native_mouse_tracker.exe'),
    path.join(app.getAppPath(), 'electron', 'native', 'native_mouse_tracker.exe'),
    path.join(process.resourcesPath || '', 'app', 'electron', 'native', 'native_mouse_tracker.exe'),
  ];
  const trackerExe = candidates.find((p) => fs.existsSync(p));
  if (trackerExe) {
    try { spawn(trackerExe, ['--restore-only'], { windowsHide: true, detached: true }); } catch (e) {}
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
