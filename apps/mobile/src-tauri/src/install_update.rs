//! Puente hacia el instalador nativo de Android para `actualizacion-in-app`:
//! lanza `Intent.ACTION_VIEW` sobre el APK ya descargado por
//! `update-download.service.ts`, vía el `FileProvider` ya declarado en el
//! manifest para exportar GPX (`${applicationId}.fileprovider`) — sin tocar
//! el manifest de nuevo, ese `FileProvider` ya cubre todo el directorio de
//! caché. No-op fuera de Android, mismo criterio que `recording_service.rs`/
//! `notifications.rs`.
use tauri::{
    plugin::{Builder, TauriPlugin},
    Runtime,
};

#[cfg(target_os = "android")]
use serde::{Deserialize, Serialize};
#[cfg(target_os = "android")]
use tauri::plugin::PluginHandle;

#[cfg(target_os = "android")]
#[derive(Serialize)]
struct InstallApkArgs {
    path: String,
}

#[cfg(target_os = "android")]
#[derive(Deserialize)]
struct CanInstallResponse {
    #[serde(rename = "canInstall")]
    can_install: bool,
}

#[cfg(target_os = "android")]
pub struct InstallUpdateHandle<R: Runtime> {
    plugin: PluginHandle<R>,
}

#[cfg(target_os = "android")]
impl<R: Runtime> InstallUpdateHandle<R> {
    pub fn install_apk(&self, path: String) -> Result<(), String> {
        self.plugin
            .run_mobile_plugin::<()>("installApk", InstallApkArgs { path })
            .map_err(|e| e.to_string())
    }

    /// `true` si Android ya concede a esta app instalar APKs fuera de Play
    /// Store (`canRequestPackageInstalls()`), `false` si hace falta pedirlo.
    pub fn can_install_packages(&self) -> Result<bool, String> {
        self.plugin
            .run_mobile_plugin::<CanInstallResponse>("canInstallPackages", ())
            .map(|r| r.can_install)
            .map_err(|e| e.to_string())
    }

    pub fn request_install_permission(&self) -> Result<(), String> {
        self.plugin
            .run_mobile_plugin::<()>("requestInstallPermission", ())
            .map_err(|e| e.to_string())
    }
}

/// Misma limitación que `recording_service.rs`/`notifications.rs`: nada
/// testeable con `#[test]` sin un runtime de Tauri real (ver
/// `commands::validate_update_apk_path` para la parte que sí lo es).
pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("install-update")
        .setup(|_app, _api| {
            #[cfg(target_os = "android")]
            {
                use tauri::Manager;
                let handle =
                    _api.register_android_plugin("com.motoroutes.app", "InstallUpdatePlugin")?;
                _app.manage(InstallUpdateHandle { plugin: handle });
            }
            Ok(())
        })
        .build()
}
