use tracing::info;

mod commands;

fn build_app() -> tauri::Builder<tauri::Wry> {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_log::Builder::new().build())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            commands::greet,
            commands::save_file,
            commands::app_info,
            commands::start_foreground_service,
            commands::stop_foreground_service,
        ])
        .setup(|app| {
            info!("🚀 Moto Routes app started: {}", app.package_info().name);
            Ok(())
        })
}

// El wrapper JNI que genera `mobile_entry_point` para Android llama a `run()` descartando
// su valor de retorno, así que en mobile usamos `()` + `.expect()` (patrón oficial de Tauri)
// en vez de `Result`, para no arrastrar un warning `unused_must_use` inevitable del macro.
// En desktop, `main.rs` sigue propagando el error con `?`.
#[cfg(mobile)]
#[tauri::mobile_entry_point]
pub fn run() {
    build_app()
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(not(mobile))]
pub fn run() -> Result<(), Box<dyn std::error::Error>> {
    build_app().run(tauri::generate_context!())?;
    Ok(())
}
