use std::io::{self, Write};
use std::time::Instant;

#[repr(C)]
struct POINT {
    x: i32,
    y: i32,
}

#[link(name = "user32")]
extern "system" {
    fn GetAsyncKeyState(vKey: i32) -> i16;
    fn GetCursorPos(lpPoint: *mut POINT) -> i32;
    fn SystemParametersInfoA(uiAction: u32, uiParam: u32, pvParam: isize, fWinIni: u32) -> i32;
}

const SPI_SETCURSORS: u32 = 0x0057;

fn main() {
    let args: Vec<String> = std::env::args().collect();
    if args.iter().any(|a| a == "--restore-only") {
        unsafe { SystemParametersInfoA(SPI_SETCURSORS, 0, 0, 0); };
        return;
    }

    // Always ensure user's mouse is completely normal and visible
    unsafe {
        SystemParametersInfoA(SPI_SETCURSORS, 0, 0, 0);
    }

    let start = Instant::now();
    let mut prev_lclick = false;
    let mut prev_rclick = false;
    let stdout = io::stdout();
    let mut handle = stdout.lock();

    let mut last_x = -99999;
    let mut last_y = -99999;
    let mut last_emit_ms = 0;

    loop {
        let mut pt = POINT { x: 0, y: 0 };
        unsafe { GetCursorPos(&mut pt) };

        let l_down = unsafe { (GetAsyncKeyState(0x01) as u16 & 0x8000) != 0 };
        let r_down = unsafe { (GetAsyncKeyState(0x02) as u16 & 0x8000) != 0 };
        let elapsed = start.elapsed().as_millis();

        if l_down && !prev_lclick {
            let _ = writeln!(handle, "{{\"t_ms\":{},\"x\":{},\"y\":{},\"event_type\":\"lclick\"}}", elapsed, pt.x, pt.y);
            let _ = handle.flush();
            last_emit_ms = elapsed;
        } else if r_down && !prev_rclick {
            let _ = writeln!(handle, "{{\"t_ms\":{},\"x\":{},\"y\":{},\"event_type\":\"rclick\"}}", elapsed, pt.x, pt.y);
            let _ = handle.flush();
            last_emit_ms = elapsed;
        } else if pt.x != last_x || pt.y != last_y || (elapsed - last_emit_ms) >= 33 {
            let _ = writeln!(handle, "{{\"t_ms\":{},\"x\":{},\"y\":{},\"event_type\":\"move\"}}", elapsed, pt.x, pt.y);
            let _ = handle.flush();
            last_emit_ms = elapsed;
        }

        last_x = pt.x;
        last_y = pt.y;
        prev_lclick = l_down;
        prev_rclick = r_down;

        std::thread::sleep(std::time::Duration::from_millis(8));
    }
}
