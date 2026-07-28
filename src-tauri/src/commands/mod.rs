use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use thiserror::Error;
use tracing::{error, info, warn};

// ─── Error types ────────────────────────────────────────

#[derive(Error, Debug)]
pub enum AppError {
    #[error("Invalid path: {0}")]
    InvalidPath(String),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Serialization error: {0}")]
    Serde(#[from] serde_json::Error),
}

impl From<AppError> for String {
    fn from(error: AppError) -> Self {
        error.to_string()
    }
}

// ─── Command types (shared with frontend) ───────────────

#[derive(Debug, Serialize, Deserialize)]
pub struct GreetResponse {
    pub message: String,
}

#[derive(Debug, Deserialize)]
pub struct SaveFileArgs {
    pub path: String,
    pub content: String,
}

#[derive(Debug, Serialize)]
pub struct AppInfoResponse {
    pub name: String,
    pub version: String,
}

// ─── Commands ───────────────────────────────────────────

/// Saluda al usuario. Comando de ejemplo.
/// El frontend invoca: invoke('greet', { name: '...' })
#[tauri::command]
pub fn greet(name: String) -> Result<GreetResponse, String> {
    if name.trim().is_empty() {
        warn!("Greet called with empty name");
        return Err("Name cannot be empty".to_string());
    }

    info!("Greeting: {}", name);
    Ok(GreetResponse {
        message: format!("Hello, {}! From Rust 🦀", name.trim()),
    })
}

/// Guarda contenido en un archivo. Ejemplo con path validation.
#[tauri::command]
pub fn save_file(args: SaveFileArgs) -> Result<(), String> {
    let path = PathBuf::from(&args.path);

    if path.is_absolute() {
        error!("Attempted to use absolute path: {}", args.path);
        return Err("Absolute paths are not allowed".to_string());
    }

    if args.path.contains("..") {
        error!("Path traversal attempt detected: {}", args.path);
        return Err("Path traversal is not allowed".to_string());
    }

    if args.content.is_empty() {
        return Err("Content cannot be empty".to_string());
    }

    info!("Saving file: {:?}", path);
    std::fs::write(&path, &args.content).map_err(|e| {
        error!("Failed to write file {:?}: {}", path, e);
        AppError::from(e).to_string()
    })?;

    info!("File saved successfully: {:?}", path);
    Ok(())
}

/// Devuelve información de la app.
#[tauri::command]
pub fn app_info(app_handle: tauri::AppHandle) -> Result<AppInfoResponse, String> {
    let package = app_handle.package_info();
    Ok(AppInfoResponse {
        name: package.name.to_string(),
        version: package.version.to_string(),
    })
}

/// Inicia el foreground service de grabación en Android.
/// Muestra una notificación persistente "Moto Routes ● Grabando ruta..." y
/// mantiene el GPS activo aunque se bloquee la pantalla. No-op fuera de Android
/// (el estado gestionado por recording_service::init() no existe en ese caso).
#[tauri::command]
pub fn start_foreground_service(_app_handle: tauri::AppHandle) -> Result<(), String> {
    info!("Starting foreground recording service (Android)");
    #[cfg(target_os = "android")]
    {
        use tauri::Manager;
        if let Some(service) =
            _app_handle.try_state::<crate::recording_service::RecordingServiceHandle<tauri::Wry>>()
        {
            service.start()?;
        }
    }
    Ok(())
}

/// Detiene el foreground service de grabación en Android.
#[tauri::command]
pub fn stop_foreground_service(_app_handle: tauri::AppHandle) -> Result<(), String> {
    info!("Stopping foreground recording service (Android)");
    #[cfg(target_os = "android")]
    {
        use tauri::Manager;
        if let Some(service) =
            _app_handle.try_state::<crate::recording_service::RecordingServiceHandle<tauri::Wry>>()
        {
            service.stop()?;
        }
    }
    Ok(())
}

/// Pausa la captura nativa de ubicación del foreground service, sin detener el
/// servicio ni la notificación (AC-020/AC-021). No-op fuera de Android.
#[tauri::command]
pub fn pause_recording_location(_app_handle: tauri::AppHandle) -> Result<(), String> {
    info!("Pausing native location capture (Android)");
    #[cfg(target_os = "android")]
    {
        use tauri::Manager;
        if let Some(service) =
            _app_handle.try_state::<crate::recording_service::RecordingServiceHandle<tauri::Wry>>()
        {
            service.pause()?;
        }
    }
    Ok(())
}

/// Reanuda la captura nativa de ubicación del foreground service.
#[tauri::command]
pub fn resume_recording_location(_app_handle: tauri::AppHandle) -> Result<(), String> {
    info!("Resuming native location capture (Android)");
    #[cfg(target_os = "android")]
    {
        use tauri::Manager;
        if let Some(service) =
            _app_handle.try_state::<crate::recording_service::RecordingServiceHandle<tauri::Wry>>()
        {
            service.resume()?;
        }
    }
    Ok(())
}
