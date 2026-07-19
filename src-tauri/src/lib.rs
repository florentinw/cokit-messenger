mod macos_display_name;

use tauri_plugin_co_sdk::library::co_application::CoApplicationSettings;

const DISPLAY_NAME: &str = "CO Messenger";

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub async fn run() {
	tauri::async_runtime::set(tokio::runtime::Handle::current());

	macos_display_name::apply(DISPLAY_NAME);

	// Network is opt-in: `with_network` always enables networking (arg is force_new_peer_id).
	let mut co_settings = CoApplicationSettings::new("cokit-messenger");

	if std::env::var("CO_ENABLE_NETWORK")
		.ok()
		.as_deref()
		.is_some_and(|v| v == "1" || v.eq_ignore_ascii_case("true"))
	{
		co_settings = co_settings.with_network(false);
	}

	if std::env::var("CO_NO_KEYCHAIN").ok().as_deref() != Some("false") {
		co_settings = co_settings.without_keychain();
	}

	if let Ok(path) = std::env::var("CO_BASE_PATH") {
		co_settings = co_settings.with_path(&path);
	}

	tauri::Builder::default()
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
		})
		.run(tauri::generate_context!())
		.expect("error while running tauri application");
}
