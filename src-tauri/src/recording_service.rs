//! Puente hacia el foreground service Android real (RecordingService.kt /
//! RecordingServicePlugin.kt) que mantiene el GPS activo con la pantalla
//! bloqueada. En cualquier plataforma que no sea Android es un no-op: el
//! comando Tauri simplemente no encuentra el estado gestionado y no hace nada.
//!
//! Fase 2 (AC-021): además de start()/stop(), `start()` construye un
//! `tauri::ipc::Channel` que Kotlin usa para reenviar cada ubicación capturada
//! nativamente (FusedLocationProviderClient / LocationManager, ver
//! RecordingService.kt) de vuelta a Rust, que la reemite como evento Tauri
//! (`recording-service://location`) para que el JS la consuma exactamente
//! igual que un punto de `navigator.geolocation.watchPosition()`.
use tauri::{
    plugin::{Builder, TauriPlugin},
    Runtime,
};

#[cfg(target_os = "android")]
use serde::{Deserialize, Serialize};
#[cfg(target_os = "android")]
use tauri::{plugin::PluginHandle, AppHandle, Emitter, Manager};

/// Evento Tauri hacia el que se reemite cada punto capturado nativamente.
/// Solo se emite/consume en Android; en el resto de plataformas no existe
/// `RecordingServiceHandle`, así que se gatea igual para no generar warnings
/// de "dead code" en builds de escritorio.
#[cfg(target_os = "android")]
pub const LOCATION_EVENT: &str = "recording-service://location";

/// Punto de ubicación capturado nativamente en Android. Los nombres de campo
/// coinciden deliberadamente con `NativeLocationEvent` (TS,
/// cockpit-native-gps.service.ts) — sin `rename_all`, ya coinciden.
#[cfg(target_os = "android")]
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LocationPoint {
    pub lat: f64,
    pub lng: f64,
    pub alt: f64,
    pub speed: f64,
    pub timestamp: i64,
}

#[cfg(target_os = "android")]
#[derive(Serialize)]
struct StartArgs {
    channel: tauri::ipc::Channel<serde_json::Value>,
}

#[cfg(target_os = "android")]
pub struct RecordingServiceHandle<R: Runtime> {
    plugin: PluginHandle<R>,
    app: AppHandle<R>,
}

#[cfg(target_os = "android")]
impl<R: Runtime> RecordingServiceHandle<R> {
    pub fn start(&self) -> Result<(), String> {
        let app = self.app.clone();
        let channel = tauri::ipc::Channel::<serde_json::Value>::new(move |body| {
            // Payload inesperado (o un tick "sin señal" de otra forma): se ignora
            // en silencio en vez de tirar el proceso, mismo criterio defensivo
            // que el resto del puente Kotlin/Rust.
            if let Ok(point) = body.deserialize::<LocationPoint>() {
                let _ = app.emit(LOCATION_EVENT, point);
            }
            Ok(())
        });
        self.plugin
            .run_mobile_plugin::<()>("start", StartArgs { channel })
            .map_err(|e| e.to_string())
    }

    pub fn stop(&self) -> Result<(), String> {
        self.plugin
            .run_mobile_plugin::<()>("stop", ())
            .map_err(|e| e.to_string())
    }

    pub fn pause(&self) -> Result<(), String> {
        self.plugin
            .run_mobile_plugin::<()>("pause", ())
            .map_err(|e| e.to_string())
    }

    pub fn resume(&self) -> Result<(), String> {
        self.plugin
            .run_mobile_plugin::<()>("resume", ())
            .map_err(|e| e.to_string())
    }
}

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("recording-service")
        .setup(|_app, _api| {
            #[cfg(target_os = "android")]
            {
                let handle =
                    _api.register_android_plugin("com.motoroutes.app", "RecordingServicePlugin")?;
                _app.manage(RecordingServiceHandle {
                    plugin: handle,
                    app: _app.clone(),
                });
            }
            Ok(())
        })
        .build()
}
