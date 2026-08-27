## Why

Hoy, actualizar la app instalada fuera de Google Play exige que el usuario sepa que hay una release nueva en GitHub, descargue el APK a mano y lo instale — sin ningún aviso dentro de la app ni en segundo plano. Con releases cada pocos días (ver `memory/context.md`, más de 15 tags desde `v0.1.0`), la app instalada en el dispositivo de pruebas real (y la del propio usuario) se queda desactualizada salvo que alguien recuerde comprobar `github.com/crzverde/moto-routes/releases` manualmente.

Android no permite una actualización 100% silenciosa fuera de Play Store (`REQUEST_INSTALL_PACKAGES` + confirmación de instalación son obligatorios por diseño del sistema), pero sí permite un flujo dentro de la propia app: comprobar la versión más reciente, descargarla, y lanzar el instalador nativo con un solo toque — sin pasar por Android Studio ni por `adb install`.

## What Changes

- Nueva comprobación de actualización: al abrir la app (arranque en frío) se consulta la API pública de GitHub Releases (`GET /repos/crzverde/moto-routes/releases/latest`) y se compara el tag contra `app.getVersion()` (ya sincronizado con el tag real desde `sincronizar-version-app`/ADR-045). Sin servidor de descargas propio en `apps/api` — se reutiliza la infraestructura de releases ya existente.
- Si hay una versión más nueva: aviso dentro de la app (no bloqueante) con opción de descargar; adicionalmente, una notificación local (vía `@tauri-apps/plugin-notification`, ya instalado y con permiso concedido) si la comprobación detecta la novedad estando la app en segundo plano/recién reabierta — sin servicio en segundo plano nuevo ni polling continuo, una comprobación por apertura de app es suficiente para el ritmo de releases actual.
- Descarga del APK dentro de la app (progreso visible) al directorio de caché de la app, y lanzamiento del instalador nativo de Android vía `Intent.ACTION_VIEW` + `FileProvider` (el `${applicationId}.fileprovider` ya declarado en `AndroidManifest.xml` para exportar GPX ya cubre el directorio de caché — sin manifest nuevo si el fichero se descarga ahí). Requiere el permiso `REQUEST_INSTALL_PACKAGES`, nuevo en el manifest, y su comprobación/solicitud correspondiente (mismo patrón ya usado para el permiso de ubicación).
- **BREAKING para el pipeline de release, no para usuarios finales**: el APK "release" publicado por `build-and-release` deja de firmarse con el keystore de depuración efímero (ADR-031/047) y pasa a firmarse con un **keystore de release real y persistente**, generado una vez y guardado como GitHub Secret. Sin este cambio, Android rechaza cada "actualización" in-app como incompatible (firma distinta en cada build) y obligaría a desinstalar — inviable para el propósito de este cambio. Reabre parcialmente ADR-031/047 con una motivación nueva que no existía cuando se tomaron esas decisiones.
- Comando Rust/Kotlin nuevo (plugin propio, mismo patrón que `RecordingServicePlugin`/`PhotoPlugin` ya existentes) para invocar el instalador nativo — no existe ningún plugin de Tauri (oficial ni comunitario, `tauri-plugin-updater` incluido) que cubra este flujo en Android.

## Capabilities

### New Capabilities
- `actualizacion-in-app`: comprobación de versión contra GitHub Releases, aviso en la app y notificación local si hay una versión más nueva, descarga del APK dentro de la app y lanzamiento del instalador nativo de Android.

### Modified Capabilities
- `ci-cd`: el job `build-and-release` pasa a firmar el APK con un keystore de release real (GitHub Secret) en vez del keystore de depuración efímero; el texto del Release publicado deja de advertir sobre incompatibilidad de firma entre versiones.

## Impact

- **Nuevo dominio frontend** `src/update/` (o ubicación equivalente a definir en design.md): comprobación de versión, UI de aviso, orquestación de descarga+instalación.
- `apps/mobile/src-tauri/`: nuevo comando/plugin Rust+Kotlin para el `Intent` de instalación; `AndroidManifest.xml` gana `REQUEST_INSTALL_PACKAGES`; `capabilities/default.json` gana los permisos nuevos que exija el plugin (http para consultar/descargar desde `api.github.com`/`github.com`/`objects.githubusercontent.com` — confirmar dominios reales de redirección de assets durante `design.md`).
- `index.html` / `tauri.conf.json` (CSP): `connect-src` gana los hosts de GitHub necesarios para consultar la API y descargar el asset.
- `.github/workflows/ci.yml` (job `build-and-release`): nuevo step para generar/decodificar el keystore de release desde un GitHub Secret y apuntar la firma ahí en vez de al keystore de debug; texto del cuerpo de la Release actualizado.
- `apps/mobile/src-tauri/gen/android/app/build.gradle.kts`: `signingConfig` del buildType `release` deja de apuntar a `signingConfigs.getByName("debug")`.
- Un keystore nuevo, generado una sola vez fuera de este flujo automatizado (con backup del usuario fuera del repo) — sin valor real en ningún artefacto versionado, solo su nombre de secreto documentado en `design.md`, mismo criterio que cualquier otro secreto del proyecto.
- Ninguna migración de datos, ninguna dependencia npm nueva más allá de posiblemente `@tauri-apps/plugin-http` (a confirmar en design.md si hace falta o si un `fetch` nativo del WebView ya cubre la consulta a la API pública).
