use std::io::Write;
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use windows_capture::{
    capture::{Context, GraphicsCaptureApiHandler},
    frame::Frame,
    graphics_capture_api::InternalCaptureControl,
    monitor::Monitor,
    settings::{
        ColorFormat, CursorCaptureSettings, DirtyRegionSettings, DrawBorderSettings,
        MinimumUpdateIntervalSettings, SecondaryWindowSettings, Settings,
    },
};

static STOPPED: AtomicBool = AtomicBool::new(false);

struct RecorderHandler {
    ffmpeg_stdin: Option<std::process::ChildStdin>,
    ffmpeg_process: Option<std::process::Child>,
    width: u32,
    height: u32,
    frames_written: u64,
}

impl GraphicsCaptureApiHandler for RecorderHandler {
    type Flags = (String, u32, u32);
    type Error = Box<dyn std::error::Error + Send + Sync>;

    fn new(ctx: Context<Self::Flags>) -> Result<Self, Self::Error> {
        let (output_path, width, height) = ctx.flags;

        println!("Launching FFmpeg encoder for {}x{} -> {}", width, height, output_path);
        let mut child = Command::new("ffmpeg")
            .args([
                "-y",
                "-f", "rawvideo",
                "-pixel_format", "bgra",
                "-video_size", &format!("{}x{}", width, height),
                "-framerate", "60",
                "-i", "-",
                "-c:v", "libx264",
                "-preset", "ultrafast",
                "-tune", "zerolatency",
                "-movflags", "+faststart",
                "-pix_fmt", "yuv420p",
                &output_path,
            ])
            .stdin(Stdio::piped())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()?;

        let stdin = child.stdin.take();

        Ok(Self {
            ffmpeg_stdin: stdin,
            ffmpeg_process: Some(child),
            width,
            height,
            frames_written: 0,
        })
    }

    fn on_frame_arrived(
        &mut self,
        frame: &mut Frame,
        capture_control: InternalCaptureControl,
    ) -> Result<(), Self::Error> {
        if STOPPED.load(Ordering::SeqCst) {
            capture_control.stop();
            return Ok(());
        }

        if let Some(ref mut stdin) = self.ffmpeg_stdin {
            let mut buffer = frame.buffer()?;
            let _ = stdin.write_all(buffer.as_raw_buffer());
            self.frames_written += 1;
        }

        Ok(())
    }

    fn on_closed(&mut self) -> Result<(), Self::Error> {
        println!("Capture finished. Total frames encoded: {}", self.frames_written);
        self.ffmpeg_stdin = None;
        if let Some(mut child) = self.ffmpeg_process.take() {
            let _ = child.wait();
        }
        Ok(())
    }
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args: Vec<String> = std::env::args().collect();
    let output_path = args.get(1).cloned().unwrap_or_else(|| "output.mp4".to_string());

    println!("Starting Canvid-Style Windows Graphics Capture...");
    println!("Output: {}", output_path);

    // Get primary monitor
    let monitor = Monitor::primary()?;
    let width = monitor.width()?;
    let height = monitor.height()?;
    println!("Primary Monitor: {}x{}", width, height);

    // Configure exact Canvid settings: CursorCaptureSettings::WithoutCursor
    let settings = Settings::new(
        monitor,
        CursorCaptureSettings::WithoutCursor,
        DrawBorderSettings::Default,
        SecondaryWindowSettings::Default,
        MinimumUpdateIntervalSettings::Default,
        DirtyRegionSettings::Default,
        ColorFormat::Bgra8,
        (output_path, width, height),
    );

    // Listen for stop signal on stdin
    std::thread::spawn(|| {
        let mut input = String::new();
        let _ = std::io::stdin().read_line(&mut input);
        println!("Stop signal received.");
        STOPPED.store(true, Ordering::SeqCst);
    });

    RecorderHandler::start(settings)?;

    println!("Recording finished successfully.");
    Ok(())
}
