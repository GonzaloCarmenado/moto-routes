//! Puente hacia el foreground service Android real (RecordingService.kt /
//! RecordingServicePlugin.kt) que mantiene el GPS activo con la pantalla
//! bloqueada. En cualquier plataforma que no sea Android es un no-op: el
//! comando Tauri simplemente no encuentra el estado gestionado y no hace nada.
use tauri::{
    plugin::{Builder, TauriPlugin},
    Runtime,
};

#[cfg(target_os = "android")]
use tauri::{plugin::PluginHandle, Manager};

#[cfg(target_os = "android")]
pub struct RecordingServiceHandle<R: Runtime>(PluginHandle<R>);

#[cfg(target_os = "android")]
impl<R: Runtime> RecordingServiceHandle<R> {
    pub fn start(&self) -> Result<(), String> {
        self.0
            .run_mobile_plugin::<()>("start", ())
            .map_err(|e| e.to_string())
    }

    pub fn stop(&self) -> Result<(), String> {
        self.0
            .run_mobile_plugin::<()>("stop", ())
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
                _app.manage(RecordingServiceHandle(handle));
            }
            Ok(())
        })
        .build()
}
