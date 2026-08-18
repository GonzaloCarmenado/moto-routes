//! Puente hacia el plugin Android de notificaciones push (FCM):
//! NotificationsPlugin.kt (token, canal del tap) / FcmService.kt (recepción y
//! contenido real de la notificación). En cualquier plataforma que no sea
//! Android es un no-op, mismo criterio que recording_service.rs.
use tauri::{
    plugin::{Builder, TauriPlugin},
    Runtime,
};

#[cfg(target_os = "android")]
use serde::{Deserialize, Serialize};
#[cfg(target_os = "android")]
use tauri::{plugin::PluginHandle, Emitter, Manager};

/// Evento Tauri hacia el que se reemite el tap de una notificación push. Solo
/// se emite/consume en Android, gateado igual que `recording_service::LOCATION_EVENT`.
#[cfg(target_os = "android")]
pub const TAP_EVENT: &str = "notifications://tap";

#[cfg(target_os = "android")]
#[derive(Debug, Deserialize)]
struct GetTokenResponse {
    token: Option<String>,
}

#[cfg(target_os = "android")]
#[derive(Debug, Deserialize)]
struct GetPendingTapScreenResponse {
    screen: Option<String>,
}

#[cfg(target_os = "android")]
#[derive(Debug, Deserialize)]
struct GetPendingTokenRefreshResponse {
    token: Option<String>,
}

#[cfg(target_os = "android")]
#[derive(Serialize)]
struct RegisterTapChannelArgs {
    channel: tauri::ipc::Channel<serde_json::Value>,
}

#[cfg(target_os = "android")]
pub struct NotificationsHandle<R: Runtime> {
    plugin: PluginHandle<R>,
}

#[cfg(target_os = "android")]
impl<R: Runtime> NotificationsHandle<R> {
    pub fn get_token(&self) -> Result<Option<String>, String> {
        self.plugin
            .run_mobile_plugin::<GetTokenResponse>("getToken", ())
            .map(|r| r.token)
            .map_err(|e| e.to_string())
    }

    /// Pantalla pendiente de abrir tras un tap en notificación con la app
    /// cerrada del todo (ver MainActivity.kt::onCreate), o `None` si no hay
    /// ninguna pendiente.
    pub fn get_pending_tap_screen(&self) -> Result<Option<String>, String> {
        self.plugin
            .run_mobile_plugin::<GetPendingTapScreenResponse>("getPendingTapScreen", ())
            .map(|r| r.screen)
            .map_err(|e| e.to_string())
    }

    pub fn clear_pending_tap_screen(&self) -> Result<(), String> {
        self.plugin
            .run_mobile_plugin::<()>("clearPendingTapScreen", ())
            .map_err(|e| e.to_string())
    }

    /// Token FCM pendiente de re-registrar tras una rotación (ver
    /// `NotificationsPlugin.kt::PREF_PENDING_TOKEN`, design.md Decisión 6),
    /// o `None` si no hay ninguno pendiente.
    pub fn get_pending_token_refresh(&self) -> Result<Option<String>, String> {
        self.plugin
            .run_mobile_plugin::<GetPendingTokenRefreshResponse>("getPendingTokenRefresh", ())
            .map(|r| r.token)
            .map_err(|e| e.to_string())
    }

    pub fn clear_pending_token_refresh(&self) -> Result<(), String> {
        self.plugin
            .run_mobile_plugin::<()>("clearPendingTokenRefresh", ())
            .map_err(|e| e.to_string())
    }
}

/// Misma limitación que recording_service.rs (ver AC-009 de
/// specs/features/deuda-tecnica-auditoria.md): nada testeable con #[test] sin
/// un runtime de Tauri real.
pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("notifications")
        .setup(|_app, _api| {
            #[cfg(target_os = "android")]
            {
                let handle =
                    _api.register_android_plugin("com.motoroutes.app", "NotificationsPlugin")?;
                let app = _app.clone();
                let channel = tauri::ipc::Channel::<serde_json::Value>::new(move |body| {
                    // Payload inesperado: se ignora en silencio, mismo criterio
                    // defensivo que recording_service.rs.
                    if let Ok(payload) = body.deserialize::<serde_json::Value>() {
                        let _ = app.emit(TAP_EVENT, payload);
                    }
                    Ok(())
                });
                handle.run_mobile_plugin::<()>(
                    "registerTapChannel",
                    RegisterTapChannelArgs { channel },
                )?;
                _app.manage(NotificationsHandle { plugin: handle });
            }
            Ok(())
        })
        .build()
}
