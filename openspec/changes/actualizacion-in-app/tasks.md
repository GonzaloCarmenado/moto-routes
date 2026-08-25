## 1. Keystore de release y firma en CI

- [x] 1.1 Generar el keystore de release (`keytool -genkeypair`) junto con el usuario; confirmar explícitamente que ha guardado su propia copia de seguridad fuera del repo antes de continuar.
- [x] 1.2 Documentar en `design.md`/la ADR nueva (tarea 10.2) los nombres de los secretos (`ANDROID_RELEASE_KEYSTORE_BASE64`, `ANDROID_RELEASE_KEYSTORE_PASSWORD`, `ANDROID_RELEASE_KEY_ALIAS` — 3, no 4: PKCS12 exige la misma contraseña para keystore y clave) — nunca sus valores.
- [x] 1.3 Añadir los 3 secretos a GitHub Secrets del repositorio.
- [x] 1.4 Test rojo en `src/shared/ci/ci-workflow.spec.ts` (+ `android-release-signing.spec.ts` nuevo para `build.gradle.kts`): el job `build-and-release` decodifica el keystore desde secret antes de firmar, y el workflow falla explícitamente si el secreto no está disponible (sin caer al keystore de debug en silencio).
- [x] 1.5 Editar `.github/workflows/ci.yml`: step nuevo que decodifica el secreto base64 a fichero en el runner efímero.
- [x] 1.6 Editar `apps/mobile/src-tauri/gen/android/app/build.gradle.kts`: `signingConfig` del buildType `release` apunta al keystore nuevo (vía variables inyectadas por el step de CI), deja de apuntar incondicionalmente a `signingConfigs.getByName("debug")` (fallback conservado solo para builds locales sin el secreto).
- [x] 1.7 Actualizar el cuerpo del GitHub Release publicado por `ci.yml` — quitar la advertencia actual de incompatibilidad de firma entre versiones.
- [x] 1.8 Tag de prueba real (`v0.0.1-keystore-test`) para verificar que el job compila, firma con el keystore nuevo y publica correctamente; confirmado con `apksigner verify --print-certs` que el certificado (`881c28dd...4d8de9`) es el nuevo, no el de debug; tag y release de prueba borrados después.
- [x] 1.9 En el dispositivo de pruebas real (`75fe536b`): build local firmado con el keystore nuevo rechazado como `INSTALL_FAILED_UPDATE_INCOMPATIBLE` sobre la versión ya instalada (firmada con un keystore de debug antiguo) — comportamiento esperado, última vez que debe ocurrir. Desinstalado y reinstalado limpio; dispositivo ya en el nuevo esquema de firma.

## 2. Verificación de red: dominio real del asset y scope de `plugin-http`

- [x] 2.1 Investigación: petición real contra la última release del propio repo, capturar el/los host(s) reales a los que redirige la descarga del asset `.apk` (ver Open Question de `design.md`) — confirmado: un único salto a `release-assets.githubusercontent.com`.
- [x] 2.2 Añadir `@tauri-apps/plugin-http` a `package.json` y su crate correspondiente a `Cargo.toml`/`lib.rs`, registrar el plugin.
- [x] 2.3 Configurar `capabilities/default.json` con `http:default` acotado a `api.github.com` (endpoint exacto de releases/latest), `github.com` (ruta de descarga exacta del repo) y `release-assets.githubusercontent.com` — sin wildcardear dominios de más. Validado compilando (`cargo build`, valida capabilities contra el schema).
- [ ] 2.4 Confirmar durante la implementación si el plugin además exige esos hosts en `connect-src` del CSP (`tauri.conf.json`/`index.html`) y añadirlos solo si hace falta de verdad.

## 3. Comprobación de versión (`src/update/`)

- [x] 3.1 Test rojo: `update-check.service.spec.ts` — compara `app.getVersion()` contra el tag de la última release y devuelve si hay actualización disponible.
- [x] 3.2 Implementación mínima: `update-check.types.ts` + `update-check.service.ts`.
- [x] 3.3 Test + implementación: la comprobación no corre fuera de Android/Tauri (mismo criterio que el guard ya usado para seleccionar el proveedor de GPS nativo, replicado en `update/` para no importar cruzado de `cockpit/`).
- [x] 3.4 Test + implementación: sin conexión, error de la API/rate limit, o release sin asset `.apk` → resuelve a "sin actualización disponible", sin lanzar ni bloquear el arranque. 7/7 tests en verde, tsc/ESLint limpios.

## 4. Aviso dentro de la app

- [x] 4.1 Test rojo: `update-banner.element.spec.ts` — visible con la versión nueva cuando hay actualización disponible, oculto en caso contrario.
- [x] 4.2 Implementación: `update-banner.element.ts` + `.element.css` (tokens de `tokens.css`, hitbox mínima 56×56px), `data-cy="update-banner-*"` en cada elemento interactivo. Botón "Descargar" despacha `update-download-requested` (nuevo en `app-events.ts`) en vez de acoplar el banner a la descarga real (grupo 6). 4/4 tests nuevos en verde, tsc/ESLint limpios. Actualizado de paso `capabilities-allowlist.spec.ts` (ADR-014) con `http:default` y un test nuevo de scope exacto sin wildcard.
- [x] 4.3 Montar el banner en `app.element.ts` — extraído a `app-update-banner.ts` (mismo patrón sin sufijo `.element` que `app-route-upload.ts`/`app-username-gate.ts`, necesario para no superar `max-statements`/`max-lines`). Comprobación best-effort en `init()`, posicionado `fixed` en `index.css` con el mismo fix de `safe-area-inset-top` ya usado para `.route-upload-snackbar`. 1425/1425 Vitest, tsc/ESLint limpios.

## 5. Notificación local

- [ ] 5.1 Test rojo: no se repite la notificación para una versión ya notificada (dedupe vía `localStorage`, clave `lastNotifiedUpdateVersion`).
- [ ] 5.2 Implementación: `update-notification.service.ts`, reutilizando `@tauri-apps/plugin-notification` ya instalado.
- [ ] 5.3 Test + implementación: sin permiso de notificaciones concedido, el aviso dentro de la app se sigue mostrando con normalidad.

## 6. Descarga del APK dentro de la app

- [ ] 6.1 Test rojo: la descarga solo se inicia por una acción explícita del usuario, nunca automáticamente al detectar la versión.
- [ ] 6.2 Implementación: `update-download.service.ts` — descarga vía `plugin-http`, escritura a fichero temporal en `$APPCACHE/updates/` vía `@tauri-apps/plugin-fs` (ya instalado), rename atómico solo al completar con éxito.
- [ ] 6.3 Añadir el scope `fs:allow-write-file`/`allow-mkdir`/`allow-exists` para `$APPCACHE/updates/**` a `capabilities/default.json` (mismo patrón que `$APPDATA/photos/**` ya existente).
- [ ] 6.4 Test + implementación: progreso de descarga expuesto al componente de UI — real si `plugin-http` permite lectura en streaming del cuerpo (confirmar según Open Question de `design.md`), indicador indeterminado si no.
- [ ] 6.5 Test + implementación: fallo de red a mitad de descarga → error visible, reintento posible, nunca se ofrece instalar un fichero parcial.

## 7. Plugin nativo de instalación (Rust + Kotlin)

- [ ] 7.1 Nuevo módulo Rust `src-tauri/src/install_update.rs` (mismo patrón que `recording_service.rs`/`notifications.rs`), comando `install_update(path: String)`.
- [ ] 7.2 Contraparte Kotlin: `Intent.ACTION_VIEW` sobre el APK vía el `FileProvider` ya declarado (`${applicationId}.fileprovider`), comprobando `canRequestPackageInstalls()` antes de lanzarlo.
- [ ] 7.3 Registrar el plugin en `lib.rs` (`.plugin(install_update::init())`) y el comando en `invoke_handler!`.
- [ ] 7.4 Añadir `android.permission.REQUEST_INSTALL_PACKAGES` a `AndroidManifest.xml`.
- [ ] 7.5 Test Rust (`cargo test`) para la parte pura verificable: el comando rechaza cualquier ruta fuera de `$APPCACHE/updates/` (mismo criterio de validación de path que `commands::save_file`).
- [ ] 7.6 Flujo de solicitud del permiso si no está concedido: dirige a los Ajustes del sistema para esta app concreta (mismo patrón ya usado para el permiso de ubicación).

## 8. Integración end-to-end

- [ ] 8.1 Cypress nuevo `update.cy.ts`: aviso visible cuando hay versión nueva (mock de la respuesta de GitHub Releases), oculto cuando no la hay, botón de descarga dispara el servicio correspondiente — la instalación real queda fuera de Cypress, se cubre en verificación manual (sección 9).
- [ ] 8.2 Test de regresión: en modo web (sin Tauri) no se muestra el aviso ni se dispara ninguna llamada de red relacionada.

## 9. Verificación en dispositivo Android real

- [ ] 9.1 Compilar e instalar en el dispositivo de pruebas la primera versión de esta feature (ya con el keystore nuevo tras la tarea 1.9).
- [ ] 9.2 Publicar una release de prueba posterior y confirmar en el dispositivo real: aviso in-app aparece, notificación local se muestra, descarga con progreso visible, el instalador nativo se lanza y la actualización se instala **sin pedir desinstalar** — confirma que el problema de firma queda resuelto de verdad, no solo en teoría.
- [ ] 9.3 Confirmar que cancelar el diálogo de instalación del sistema deja la app en un estado reintentable, sin volver a descargar el APK.
- [ ] 9.4 Borrar cualquier tag/release de prueba usado en 9.1/9.2 tras confirmar.

## 10. Cierre

- [ ] 10.1 `openspec validate --all --strict` limpio.
- [ ] 10.2 Actualizar `memory/context.md` (estado actual, próximo hito) y añadir la ADR nueva en `memory/decisions.md` sobre el keystore de release persistente (referenciando ADR-031/047).
- [ ] 10.3 Suite completa en verde antes de abrir el PR: `tsc --noEmit`, `eslint --max-warnings 0`, Vitest con cobertura, `cargo fmt --check`/`cargo clippy -- -D warnings`/`cargo test`, Cypress completo (no solo lo nuevo de este cambio).
