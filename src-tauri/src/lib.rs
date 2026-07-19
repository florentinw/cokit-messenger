use tauri_plugin_co_sdk::library::co_application::CoApplicationSettings;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub async fn run() {
	tauri::async_runtime::set(tokio::runtime::Handle::current());

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
		.run(tauri::generate_context!())
		.expect("error while running tauri application");
}
