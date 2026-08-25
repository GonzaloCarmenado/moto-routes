## Context

Ver `proposal.md` para la motivación completa. Puntos de partida técnicos relevantes para este diseño:

- `app.getVersion()` (API de Tauri) ya devuelve un valor sincronizado con el tag `v*` de cada release, desde `sincronizar-version-app` (ADR-045) — no hace falta ningún mecanismo nuevo para saber "qué versión tengo instalada".
- Cada release ya publica su APK como asset de un GitHub Release, con nombre `moto-routes-<tag>-arm64.apk` (`.github/workflows/ci.yml`, job `build-and-release`).
- El `${applicationId}.fileprovider` ya declarado en `AndroidManifest.xml` (usado hoy para exportar GPX) expone todo el directorio de caché de la app (`file_paths.xml` → `<cache-path path="." />`) — un APK descargado ahí queda automáticamente alcanzable por ese `FileProvider` sin tocar el manifest de nuevo.
- El proyecto ya tiene dos plugins Rust+Kotlin propios sin equivalente en el ecosistema Tauri (`recording_service.rs`, `notifications.rs`), mismo patrón que necesita este cambio para el lanzamiento del instalador nativo.
- **Hallazgo que condiciona todo el diseño** (ver `proposal.md` § What Changes): el APK "release" actual se firma con el keystore de depuración efímero de cada runner de CI (ADR-031/047). Sin un keystore de release persistente, ningún APK descargado por este flujo podría instalarse "encima" del anterior — Android lo rechazaría por firma incompatible. Confirmado con el usuario: se genera un keystore real, con backup suyo fuera del repo.

## Goals / Non-Goals

**Goals:**
- Detectar una versión más reciente sin salir de la app, con el menor número de piezas nuevas posible (sin servidor de descargas propio).
- Descargar e instalar con la mínima fricción que Android permite fuera de Play Store (un toque para descargar, un toque para confirmar la instalación del sistema).
- Dejar el pipeline de release en un estado donde "actualizar" sea una operación real (mismo certificado de firma entre versiones), no solo una descarga.

**Non-Goals:**
- Instalación 100% silenciosa — Android no lo permite fuera de Play Store, no es un objetivo alcanzable, no solo pospuesto.
- Rollout gradual o por porcentaje de usuarios — GitHub Releases no lo soporta; si hiciera falta en el futuro requeriría el servidor propio que este cambio descarta deliberadamente.
- Soporte iOS o builds de escritorio — el proyecto no publica ninguno de los dos hoy.
- Recuperación automática si el keystore de release se pierde o hay que rotarlo — es una limitación estructural de la firma de Android (rompe compatibilidad con todo lo ya instalado, sea cual sea el mecanismo de actualización), no algo que este diseño pueda evitar.
- Publicación en Google Play — el keystore que se genera aquí es solo para que las releases propias sean consistentes entre sí, no para cumplir los requisitos de firma de la Play Store.

## Decisions

- **Origen de versión: la API pública de GitHub Releases** (`GET /repos/crzverde/moto-routes/releases/latest`), sin servidor propio en `apps/api`. Alternativa descartada: endpoint propio de versión — daría más control (listas privadas, rollout) pero es infraestructura nueva sin necesidad real al ritmo de releases actual; se puede migrar más adelante si hace falta, sin cambiar el resto del diseño.
- **Comunicación de red vía `@tauri-apps/plugin-http`** (dependencia npm nueva, justificada: es el plugin oficial de Tauri para esto, evita reinventar un cliente HTTP en Rust) en vez del `fetch` nativo del WebView. Motivo concreto: el asset de una GitHub Release se sirve con una redirección a un host de CDN que GitHub controla y puede cambiar; con `fetch` nativo, cada host de esa cadena de redirección tendría que estar en `connect-src` de la CSP de la página (frágil, se rompería sin aviso si GitHub cambia de CDN). El `scope` del plugin (`capabilities/default.json`) gobierna esto en su lugar, y las peticiones las resuelve Rust (`reqwest`, que sigue redirecciones de forma transparente), no el WebView.
- **Firma de release real y persistente**: keystore generado el 2026-08-25 (`keytool -genkeypair`, RSA 2048, válido hasta 2054, PKCS12), con backup del usuario fuera del repo confirmado antes de continuar. Tres secretos en GitHub Secrets (no cuatro — `keytool` moderno genera PKCS12, que exige la misma contraseña para el keystore y para la clave dentro de él, así que un único valor de contraseña cubre ambas): `ANDROID_RELEASE_KEYSTORE_BASE64` (el fichero `.keystore` codificado en base64), `ANDROID_RELEASE_KEYSTORE_PASSWORD` (usada como `storePassword` y `keyPassword` en Gradle) y `ANDROID_RELEASE_KEY_ALIAS` (`motoroutes`). Nunca sus valores reales en ningún artefacto ni commit. `apps/mobile/src-tauri/gen/android/app/build.gradle.kts` deja de apuntar `signingConfig` del buildType `release` a `signingConfigs.getByName("debug")`. Se documentará como ADR nueva en `memory/decisions.md` durante `apply`/`archive` (reabre parcialmente ADR-031/047 con una motivación que no existía cuando se tomaron).
- **Deduplicación de la notificación por versión vía `localStorage`** (clave `lastNotifiedUpdateVersion`), no una tabla SQLite nueva. Es un único valor de estado ligero del cliente, sin necesidad de migración de esquema — mismo criterio ya usado en el proyecto para estado local simple no crítico.
- **Nuevo plugin Rust+Kotlin propio** (`src-tauri/src/install_update.rs` + su contraparte Kotlin, nombre exacto a definir en `tasks.md`) para lanzar el instalador nativo de Android (`Intent.ACTION_VIEW` sobre el APK vía `FileProvider`, comprobación de `canRequestPackageInstalls()`). Ni el plugin oficial `tauri-plugin-updater` ni ningún plugin comunitario cubren este flujo en Android — confirmado antes de proponer.
- **La comprobación de actualización solo corre en Android/Tauri**, con el mismo guard (`isAndroidTauri()` o equivalente) ya usado para seleccionar el proveedor de GPS nativo — en modo web de desarrollo o cualquier build de escritorio no hay ningún APK que ofrecer.
- **Dominio frontend nuevo `src/update/`** (paralelo a `src/friends/`, `src/achievements/`), no dentro de `shared/` ni de `cockpit/` — es una responsabilidad propia sin relación funcional con grabación de rutas ni con ningún dominio existente.

## Risks / Trade-offs

- **La primera release publicada tras cambiar de keystore es incompatible con cualquier instalación previa** (incluida la del dispositivo de pruebas) → Mitigación: es esperado y de una sola vez, se documenta en el cuerpo de esa release concreta ("desinstala la versión anterior antes de instalar esta"); a partir de ahí, todas las releases futuras son compatibles entre sí. No hay forma de evitarlo — es la propia naturaleza del cambio de firma.
- **El host real de redirección del asset de GitHub Release no está confirmado de antemano** → Mitigación: verificar empíricamente (petición real contra la última release del propio repo) en la primera tarea de implementación, antes de fijar el `scope` del plugin-http — sin asumir ni wildcardear dominios de más.
- **Rate limit de la API pública de GitHub** (60 peticiones/hora sin autenticar, por IP) → Mitigación: una sola consulta por apertura de app y por dispositivo, coste muy por debajo del límite; deliberadamente sin token de GitHub embebido en el cliente (un APK es descompilable, un token ahí sería un secreto expuesto).
- **Un APK a medio descargar si la app se cierra a mitad de la descarga** → Mitigación: escribir a un fichero temporal y solo dejarlo listo para instalar al completarse con éxito; un intento anterior incompleto se sobrescribe en el siguiente, nunca se ofrece instalar un fichero parcial.
- **El progreso de descarga puede no ser exacto** si `@tauri-apps/plugin-http` no expone lectura en streaming del cuerpo de la respuesta (ver Open Questions) → Mitigación aceptada de antemano: degradar a un indicador indeterminado ("descargando…") en vez de escribir un cliente HTTP a medida en Rust solo para tener un porcentaje exacto — no merece la complejidad extra para un fichero de ~9MB.
- **El keystore de release es responsabilidad manual del usuario, sin backend que lo gestione** → Ya asumido explícitamente en la conversación previa a este diseño; se documenta el nombre del secreto (no su valor) en `tasks.md`/ADR, y que perderlo implica el mismo evento de incompatibilidad de firma que el propio cambio de keystore, para cualquier dispositivo con una versión antigua instalada.

## Open Questions

- ¿`@tauri-apps/plugin-http` permite leer el cuerpo de la respuesta en streaming para reportar progreso real de descarga, o solo "en curso"/"completo"? No cambia el enfoque (ver Risk correspondiente) — a confirmar en la primera tarea de implementación del componente de descarga.
- Dominio(s) exactos a los que redirige la descarga de un asset de GitHub Release en este repo concreto — no cambia el enfoque, solo el valor exacto del `scope` del plugin-http; se confirma con una petición real en la primera tarea de implementación.
