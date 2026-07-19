/// Best-effort macOS display name for dev mode (bare binary, no .app bundle).
///
/// In `tauri dev`, macOS uses the executable filename for the Dock label because
/// Info.plist is only applied inside a bundled `.app`. Production builds pick up
/// `src-tauri/Info.plist` automatically.
#[cfg(target_os = "macos")]
pub fn apply(display_name: &str) {
	use std::process::Command;

	let pid = std::process::id().to_string();
	let _ = Command::new("/usr/bin/lsappinfo")
		.args(["setinfo", &pid, "--name", display_name])
		.status();
}

#[cfg(not(target_os = "macos"))]
pub fn apply(_display_name: &str) {}
