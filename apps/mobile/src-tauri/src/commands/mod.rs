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

/// Token de notificaciones push (FCM) del dispositivo actual, o `None` si no
/// está disponible (web/desktop, sin Google Play Services). No comprueba el
/// permiso del sistema — eso lo hace el plugin oficial `plugin-notification`
/// desde JS antes de llamar a este comando (ver device-token.service.ts).
#[tauri::command]
pub fn get_notification_token(_app_handle: tauri::AppHandle) -> Result<Option<String>, String> {
    #[cfg(target_os = "android")]
    {
        use tauri::Manager;
        if let Some(handle) =
            _app_handle.try_state::<crate::notifications::NotificationsHandle<tauri::Wry>>()
        {
            return handle.get_token();
        }
    }
    Ok(None)
}

/// Pantalla pendiente de abrir dejada por un tap en notificación con la app
/// cerrada del todo (cold start, ver MainActivity.kt::onCreate), o `None` si
/// no hay ninguna. El JS la consulta una vez tiene su propio listener de
/// `notifications://tap` ya registrado, para no perder la señal en la
/// carrera de arranque (ver design.md, gap encontrado tras la Decisión 5).
#[tauri::command]
pub fn get_pending_tap_screen(_app_handle: tauri::AppHandle) -> Result<Option<String>, String> {
    #[cfg(target_os = "android")]
    {
        use tauri::Manager;
        if let Some(handle) =
            _app_handle.try_state::<crate::notifications::NotificationsHandle<tauri::Wry>>()
        {
            return handle.get_pending_tap_screen();
        }
    }
    Ok(None)
}

/// Borra la pantalla pendiente ya consumida (evita reabrirla en el próximo
/// arranque sin un tap nuevo).
#[tauri::command]
pub fn clear_pending_tap_screen(_app_handle: tauri::AppHandle) -> Result<(), String> {
    #[cfg(target_os = "android")]
    {
        use tauri::Manager;
        if let Some(handle) =
            _app_handle.try_state::<crate::notifications::NotificationsHandle<tauri::Wry>>()
        {
            return handle.clear_pending_tap_screen();
        }
    }
    Ok(())
}

/// Token FCM pendiente de re-registrar tras una rotación (design.md Decisión
/// 6: Kotlin no tiene acceso a la sesión y deja el token nuevo en
/// `SharedPreferences`), o `None` si no hay ninguno pendiente.
#[tauri::command]
pub fn get_pending_token_refresh(_app_handle: tauri::AppHandle) -> Result<Option<String>, String> {
    #[cfg(target_os = "android")]
    {
        use tauri::Manager;
        if let Some(handle) =
            _app_handle.try_state::<crate::notifications::NotificationsHandle<tauri::Wry>>()
        {
            return handle.get_pending_token_refresh();
        }
    }
    Ok(None)
}

/// Borra el token pendiente ya re-registrado.
#[tauri::command]
pub fn clear_pending_token_refresh(_app_handle: tauri::AppHandle) -> Result<(), String> {
    #[cfg(target_os = "android")]
    {
        use tauri::Manager;
        if let Some(handle) =
            _app_handle.try_state::<crate::notifications::NotificationsHandle<tauri::Wry>>()
        {
            return handle.clear_pending_token_refresh();
        }
    }
    Ok(())
}

// ─── Tests ──────────────────────────────────────────────
// AC-008 de `specs/features/deuda-tecnica-auditoria.md`: cubre la lógica de
// validación real de `save_file` (rechaza rutas absolutas, exige relativas
// sin `..`, rechaza contenido vacío) y de `greet` (rechaza nombre vacío).
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn save_file_rejects_absolute_path() {
        let args = SaveFileArgs {
            path: if cfg!(windows) {
                "C:\\tmp\\x.txt".to_string()
            } else {
                "/tmp/x.txt".to_string()
            },
            content: "hello".to_string(),
        };

        let result = save_file(args);

        assert!(result.is_err());
    }

    #[test]
    fn save_file_accepts_relative_path_without_dotdot() {
        let path = "target/save_file_test_ok.txt";
        let args = SaveFileArgs {
            path: path.to_string(),
            content: "hello".to_string(),
        };

        let result = save_file(args);

        assert!(result.is_ok());
        assert!(std::fs::read_to_string(path).is_ok_and(|c| c == "hello"));
        let _ = std::fs::remove_file(path);
    }

    #[test]
    fn save_file_rejects_path_traversal() {
        let args = SaveFileArgs {
            path: "../escape.txt".to_string(),
            content: "hello".to_string(),
        };

        let result = save_file(args);

        assert!(result.is_err());
    }

    #[test]
    fn save_file_rejects_empty_content() {
        let args = SaveFileArgs {
            path: "target/save_file_test_empty.txt".to_string(),
            content: String::new(),
        };

        let result = save_file(args);

        assert!(result.is_err());
    }

    #[test]
    fn greet_rejects_empty_name() {
        let result = greet(String::new());

        assert!(result.is_err());
    }
}
