export interface MouseEventRecord {
  t_ms: number;
  x: number;
  y: number;
  event_type: 'move' | 'lclick' | 'rclick' | 'wheel';
  cursor?: 'arrow' | 'hand' | 'ibeam';
}

export interface ZoomKeyframe {
  id: string;
  start: number; // in milliseconds
  end: number;   // in milliseconds
  level: number; // e.g. 2.0
  focal_x: number; // 0.0 to 1.0 (normalized)
  focal_y: number; // 0.0 to 1.0 (normalized)
  disabled?: boolean;
}

export interface BackgroundConfig {
  type: 'color' | 'gradient' | 'image';
  value: string;
  blur?: number;
}

export interface WebcamConfig {
  enabled: boolean;
  position: 'BOTTOM_RIGHT' | 'BOTTOM_LEFT' | 'TOP_RIGHT' | 'TOP_LEFT';
  shape: 'circle' | 'square' | 'rounded';
  size: number;
  mirrored: boolean;
}

export interface CursorConfig {
  visible: boolean;
  scale: number; // 0.35 to 2.5 (default 1.0)
  theme: 'windows' | 'mac' | 'touch' | 'recorded' | 'neon' | 'dot';
  clickEffect: 'none' | 'ripple';
  smoothing: boolean;
  tilt: boolean;
  motionBlur: boolean;
  alwaysDefault?: boolean;
  animationStyle?: 'molasses' | 'default' | 'gentle' | 'stiff';
  tension?: number;
  friction?: number;
}

export interface ZoomConfig {
  motionBlur: boolean;
  animationStyle: 'molasses' | 'default' | 'gentle' | 'stiff';
  tension: number;
  friction: number;
}

export interface SubtitleWord {
  word: string;
  start: number;
  end: number;
}

export interface SubtitleBlock {
  id: string;
  start: number;
  end: number;
  text: string;
  words?: SubtitleWord[];
}

export interface VideoClip {
  id: string;
  start: number;       // in seconds
  end: number;         // in seconds
  sourceStart: number; // in seconds
  label?: string;
}

export interface ProjectState {
  name: string;
  videoUrl: string | null;
  camUrl: string | null;
  micUrl: string | null;
  duration: number; // in seconds
  currentTime: number;
  isPlaying: boolean;
  aspectRatio: '16:9' | '9:16' | '4:3' | '1:1';
  padding: number; // 0 to 20 (%)
  radius: number;  // 0 to 32 (px)
  backgroundBlur: number; // 0 to 100 (px)
  shadowEnabled: boolean;
  shadowBlur: number;
  background: BackgroundConfig;
  webcam: WebcamConfig;
  cursor: CursorConfig;
  zoomConfig?: ZoomConfig;
  zooms: ZoomKeyframe[];
  clips?: VideoClip[];
  subtitles: SubtitleBlock[];
  speed: number;
  volume: number;
  mouseEvents: MouseEventRecord[];
  targetCrop?: { x: number; y: number; width: number; height: number };
}
