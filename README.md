<div align="center">

# 🎬 OpenCanvid `v0.0.1-beta`
**The Free & Open-Source Screen Recording and Video Studio for Creators**  
*A lightweight, native, and privacy-respecting alternative to Canvid.*

[![Release](https://img.shields.io/badge/Release-v0.0.1--beta-emerald.svg)](https://github.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Windows%2010%2F11-white.svg)](https://www.microsoft.com/)
[![Framework](https://img.shields.io/badge/Built%20with-React%2019%20%7C%20Electron%20%7C%20Vite-61dafb.svg)](https://react.dev)

</div>

---

## 🌟 Overview

**OpenCanvid** is a screen recording and video post-production studio built for creating software tutorials, code walkthroughs, product demos, and social media reels. It records video and mouse telemetry simultaneously, giving you total non-destructive control over cursor styling, camera zoom paths, canvas borders, backgrounds, and motion blur after recording.

---

## ✨ Key Features

### 🎯 1. Zero-Cursor Hardware Screen Capture
- **Hardware-Accelerated WGC**: Records crisp 60 FPS video using the Windows Graphics Capture API without baking the OS cursor into the video stream.
- **Clean Raw Video**: The recorded canvas remains pristine, allowing full post-recording customization of mouse scaling, shape, smoothing, and effects.

### 🖱️ 2. Vector Mouse Telemetry & Authentic Cursors
- **Sub-Pixel Smoothing**: High-frequency mouse coordinates are captured via native low-level hooks and smoothed using spring physics.
- **Genuine OS Cursors**:
  - **Windows Aero**: Pixel-perfect vector reproduction extracted directly from `aero_arrow.cur` and `aero_link.cur`.
  - **macOS Retina**: Authentic Apple Black Pointer and Precision Hand Glove icons with exact hotspot offsets.
- **Click Waveform Ripples**: Automatic animated concentric wave ripples on mouse clicks.
- **Cursor Customization**: Adjust mouse scale, highlight rings, shadows, and click sounds.

### 💨 3. Shutter-Accurate Linear Motion Blur
- **True Optical Blur**: Uses single-pass SVG directional linear Gaussian blur (`feGaussianBlur`) aligned along the cursor's instantaneous velocity vector.
- **No Ghosting**: Eliminates ugly duplicate cursor trails; renders realistic high-speed camera motion blur just like Canvid.

### 🔍 4. Dynamic Auto-Zooms & Timeline Keyframing
- **Smart Focus**: Automatically generates smooth zoom keyframes focused on areas where clicks and cursor dwell events occur.
- **Spring Physics**: Eased zoom transitions (1.2x – 3.0x) with adjustable spring dampening and customizable focus points.
- **Timeline Manipulation**: Add, move, split, resize, and delete zoom pills directly on the timeline.

### ✂️ 5. Non-Linear Timeline & Clip Trimming
- **Interactive Multi-Track Editor**: Dedicated tracks for video clips, auto-zooms, webcam PIP, and audio.
- **Razor / Split Tool (`S` or `C`)**: Cut and trim video clips at the exact playhead position without quality loss.
- **Keyboard Navigation**:
  - `Space` / `K`: Play / Pause toggle
  - `J` / `L`: Fast Seek backward / forward (1s or 5s)
  - `Home` / `End`: Jump to start / end of timeline
  - `Delete` / `Backspace`: Remove selected clip or zoom segment
  - `Ctrl + S`: Quick-save project
  - `Ctrl + O`: Open project

### 💾 6. Project Serialization (`.canvid`)
- Save and restore your entire project state with a single shortcut (`Ctrl + S` / `Ctrl + O`).
- Stores clip cuts, zoom keyframes, cursor styling parameters, audio tracks, and canvas backgrounds.

### 🎨 7. Canvas & Studio Styling
- **Frameless Studio UI**: Dark-themed minimal interface with a persistent 3-line hamburger menu at the top left.
- **Aspect Ratios**: Switch between 16:9 (YouTube), 9:16 (Shorts/Reels), 1:1 (Square), and 4:3.
- **Backgrounds**: Customizable solid colors, high-res wallpapers, gradients, padding, rounded corners, and drop shadows.

---

## 🚀 Quick Start

### Prerequisites
- **Node.js** >= 18.0.0
- **Windows 10 / 11** (for native Windows Graphics Capture and low-level mouse hooks)

### Running the App
Double-click `Run_OpenCanvid.bat` or run in terminal:

```bash
# Clone the repository
git clone https://github.com/your-username/opencanvid.git
cd opencanvid

# Install dependencies
npm install

# Run in development mode
npm run electron

# Or build production frontend and launch
npm run electron:start
```

---

## 🛠️ Project Architecture

```
opencanvid/
├── electron/
│   ├── main.cjs            # Electron main process (WGC native bridge, low-level hooks, dialogs)
│   ├── preload.cjs         # Context isolation bridge (`electronBridge`)
│   └── native/             # Windows native C++ hooks and capture binaries
├── public/
│   ├── cursors/            # Extracted Windows & macOS cursor assets
│   ├── wallpapers/         # Studio background wallpapers
│   └── fonts/              # Typography assets
├── src/
│   ├── components/         # Timeline, VideoPlayer, Toolbar, Settings, CustomTitleBar
│   ├── utils/              # Mouse math, smoothing, WGC bridge, project storage
│   ├── types/              # Type definitions for clips, zooms, and projects
│   ├── App.tsx             # Studio root component
│   └── main.tsx            # React root
├── package.json            # Project manifest (v0.0.1-beta)
└── README.md
```

---

## ⌨️ Shortcut Reference

| Shortcut | Action |
|:---|:---|
| `Space` / `K` | Play / Pause timeline playback |
| `J` | Step / Seek backwards (1s) |
| `L` | Step / Seek forwards (1s) |
| `S` or `C` | Split / Cut active clip at playhead |
| `Delete` / `Backspace` | Delete selected clip or zoom pill |
| `Home` | Move playhead to 0:00 |
| `End` | Move playhead to end of video |
| `Ctrl + N` | New recording / project |
| `Ctrl + O` | Open existing `.canvid` project |
| `Ctrl + S` | Save current project |
| `Ctrl + Shift + S` | Save project as new file |

---

## 📄 License
This project is licensed under the [MIT License](LICENSE).
