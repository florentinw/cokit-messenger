mod macos_display_name;

use tauri_plugin_co_sdk::library::co_application::CoApplicationSettings;

const DISPLAY_NAME: &str = "CO Messenger";

fn env_flag(name: &str) -> bool {
	std::env::var(name)
		.ok()
		.as_deref()
		.is_some_and(|v| v == "1" || v.eq_ignore_ascii_case("true"))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub async fn run() {
	tauri::async_runtime::set(tokio::runtime::Handle::current());

	macos_display_name::apply(DISPLAY_NAME);

	// Production defaults: network + keychain on.
	// Dev scripts opt out with CO_DISABLE_NETWORK / CO_NO_KEYCHAIN (+ CO_BASE_PATH).
	let mut co_settings = CoApplicationSettings::new("cokit-messenger");

	if !env_flag("CO_DISABLE_NETWORK") {
		// `with_network` argument is force_new_peer_id, not “enable”.
		co_settings = co_settings.with_network(false);
	}

	if env_flag("CO_NO_KEYCHAIN") {
		co_settings = co_settings.without_keychain();
	}

	if let Ok(path) = std::env::var("CO_BASE_PATH") {
		co_settings = co_settings.with_path(&path);
	}

	let builder = tauri::Builder::default()
		.plugin(tauri_plugin_opener::init())
		.plugin(tauri_plugin_co_sdk::init(co_settings).await)
		.setup(|app| {
			#[cfg(target_os = "macos")]
			{
				use tauri::Manager;
				use window_vibrancy::{apply_vibrancy, NSVisualEffectMaterial};

				if let Some(window) = app.get_webview_window("main") {
					apply_vibrancy(
						&window,
						NSVisualEffectMaterial::Sidebar,
						None,
						Some(8.0),
					)
					.map_err(|err| format!("sidebar vibrancy: {err}"))?;
				}
			}

			Ok(())
		});

	// macOS: Cmd+W / red traffic light should hide the window (app stays in the
	// Dock), matching typical single-window Mac apps. Cmd+Q still quits.
	#[cfg(target_os = "macos")]
	let builder = builder.on_window_event(|window, event| {
		if let tauri::WindowEvent::CloseRequested { api, .. } = event {
			let _ = window.hide();
			api.prevent_close();
		}
	});

	builder
		.build(tauri::generate_context!())
		.expect("error while building tauri application")
		.run(|app, event| {
			#[cfg(target_os = "macos")]
			if let tauri::RunEvent::Reopen {
				has_visible_windows,
				..
			} = event
			{
				if !has_visible_windows {
					use tauri::Manager;
					if let Some(window) = app.get_webview_window("main") {
						let _ = window.show();
						let _ = window.set_focus();
					}
				}
			}

			#[cfg(not(target_os = "macos"))]
			{
				let _ = (app, event);
			}
		});
}
