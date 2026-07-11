use tauri::Manager;
use tracing::info;

mod commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() -> Result<(), Box<dyn std::error::Error>> {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_log::Builder::new().build())
        .plugin(tauri_plugin_sql::Builder::default().build())
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
        .run(tauri::generate_context!())?;

    Ok(())
}