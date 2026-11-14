use std::io::{self, Write};
use std::mem::size_of;
use std::time::Instant;

#[repr(C)]
struct POINT {
    x: i32,
    y: i32,
}

#[repr(C)]
struct CURSORINFO {
    cb_size: u32,
    flags: u32,
    h_cursor: isize,
    pt_screen_pos: POINT,
}

#[link(name = "user32")]
unsafe extern "system" {
    fn GetAsyncKeyState(vKey: i32) -> i16;
    fn GetCursorPos(lpPoint: *mut POINT) -> i32;
    fn GetCursorInfo(pci: *mut CURSORINFO) -> i32;
    fn LoadCursorA(hInstance: isize, lpCursorName: *const u8) -> isize;
    fn SystemParametersInfoA(uiAction: u32, uiParam: u32, pvParam: isize, fWinIni: u32) -> i32;
}

const SPI_SETCURSORS: u32 = 0x0057;
const IDC_IBEAM: usize = 32513;
const IDC_HAND: usize = 32649;

fn detect_cursor_role(h_ibeam: isize, h_hand: isize) -> &'static str {
    let mut ci = CURSORINFO {
        cb_size: size_of::<CURSORINFO>() as u32,
        flags: 0,
        h_cursor: 0,
        pt_screen_pos: POINT { x: 0, y: 0 },
    };
    let ok = unsafe { GetCursorInfo(&mut ci) };
    if ok != 0 && ci.h_cursor != 0 {
        if ci.h_cursor == h_hand || ci.h_cursor == h_ibeam {
            return "hand";
        }
    }
    "arrow"
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    if args.iter().any(|a| a == "--restore-only") {
        unsafe {
            SystemParametersInfoA(SPI_SETCURSORS, 0, 0, 0);
        }
        return;
    }

    // Always ensure user's mouse is completely normal and visible
    unsafe {
        SystemParametersInfoA(SPI_SETCURSORS, 0, 0, 0);
    }

    let h_ibeam = unsafe { LoadCursorA(0, IDC_IBEAM as *const u8) };
    let h_hand = unsafe { LoadCursorA(0, IDC_HAND as *const u8) };

    let start = Instant::now();
    let mut prev_lclick = false;
    let mut prev_rclick = false;
    let mut last_cursor = "";
    let stdout = io::stdout();
    let mut handle = stdout.lock();

    let mut last_x = -99999;
    let mut last_y = -99999;
    let mut last_emit_ms = 0;

    loop {
        let mut pt = POINT { x: 0, y: 0 };
        unsafe { GetCursorPos(&mut pt) };

        let cursor_role = detect_cursor_role(h_ibeam, h_hand);
        let l_down = unsafe { (GetAsyncKeyState(0x01) as u16 & 0x8000) != 0 };
        let r_down = unsafe { (GetAsyncKeyState(0x02) as u16 & 0x8000) != 0 };
        let elapsed = start.elapsed().as_millis();

        if l_down && !prev_lclick {
            let _ = writeln!(
                handle,
                "{{\"t_ms\":{},\"x\":{},\"y\":{},\"event_type\":\"lclick\",\"cursor\":\"{}\"}}",
                elapsed, pt.x, pt.y, cursor_role
            );
            let _ = handle.flush();
            last_emit_ms = elapsed;
        } else if r_down && !prev_rclick {
            let _ = writeln!(
                handle,
                "{{\"t_ms\":{},\"x\":{},\"y\":{},\"event_type\":\"rclick\",\"cursor\":\"{}\"}}",
                elapsed, pt.x, pt.y, cursor_role
            );
            let _ = handle.flush();
            last_emit_ms = elapsed;
        } else if pt.x != last_x
            || pt.y != last_y
            || cursor_role != last_cursor
            || (elapsed - last_emit_ms) >= 33
        {
            let _ = writeln!(
                handle,
                "{{\"t_ms\":{},\"x\":{},\"y\":{},\"event_type\":\"move\",\"cursor\":\"{}\"}}",
                elapsed, pt.x, pt.y, cursor_role
            );
            let _ = handle.flush();
            last_emit_ms = elapsed;
        }

        last_x = pt.x;
        last_y = pt.y;
        last_cursor = cursor_role;
        prev_lclick = l_down;
        prev_rclick = r_down;

        std::thread::sleep(std::time::Duration::from_millis(8));
    }
}
