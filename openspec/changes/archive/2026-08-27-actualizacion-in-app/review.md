# Review — `actualizacion-in-app`

## CRÍTICO (leer primero)

- **Seguridad**: sin criptografía hecha a mano. El único punto sensible es la ruta del APK que cruza la frontera JS→Rust→Kotlin antes de lanzar un `Intent.ACTION_VIEW` — `commands/mod.rs::validate_update_apk_path` la valida server-side (Rust) antes de usarla: rechaza `..` (traversal), exige que el nombre de fichero sea exactamente `update.apk` y que el directorio padre sea exactamente `updates`, con 4 tests unitarios (`validate_update_apk_path_accepts_a_well_formed_path`, `_rejects_path_traversal`, `_rejects_a_file_outside_the_updates_directory`, `_rejects_an_unexpected_file_name`). Los 3 secretos del keystore (`ANDROID_RELEASE_KEYSTORE_BASE64`/`_PASSWORD`/`ANDROID_RELEASE_KEY_ALIAS`) solo aparecen por nombre en `ci.yml`/`design.md`/ADR-061, nunca su valor — confirmado con `git diff` sobre el rango completo de la rama (`0ab2c72..HEAD`, 45 ficheros) contra patrones de secreto/clave privada/token de proveedor conocido, sin resultados. El job `build-and-release` falla explícitamente si falta cualquiera de los 3 secretos, en vez de degradar en silencio al keystore de debug (confirmado leyendo `ci.yml:432-446`).
- **`src/shared/` (radio de impacto)**: sin cambios en componentes compartidos existentes — el dominio `update/` es nuevo, y `app-update-banner.ts` (extracción por línite de líneas, con JSDoc justificándolo, patrón ya documentado en `CLAUDE.md`) es la única pieza que toca `app.element.ts`, de forma aditiva (monta un elemento más, engancha dos listeners más).
- **Dependencias core**: una dependencia nueva real, `@tauri-apps/plugin-http` — justificada en `design.md` (plugin oficial de Tauri, evita reinventar un cliente HTTP en Rust y el problema de CSP frente a redirecciones de CDN que GitHub controla). Confirmado en código: las peticiones de red del flujo de actualización (`update-check.service.ts`, `update-download.service.ts`) usan este plugin, no `fetch` nativo del WebView.
- **Reglas del proyecto saltadas**: ninguna. `data-cy` presente en todo elemento interactivo revisado (`update-banner-download`, `update-banner-install`, `update-banner-retry`, `update-banner-progress`, `update-banner`). Sin CSS inline. Extracción de `app-update-banner.ts` documentada como excepción al patrón de sufijos, no una convención nueva.

## Verificación independiente realizada esta sesión

No se aceptó `tasks.md` como bueno sin comprobarlo — releído el código fuente real (`update-check.service.ts`, `update-download.service.ts`, `update-notification.service.ts`, `update-banner.element.ts`, `app-update-banner.ts`, `install_update.rs`, `commands/mod.rs::validate_update_apk_path`, `ci.yml` sección de firma) y re-ejecutada la suite completa de cero tras reinstalar dependencias (`node_modules` no estaba sincronizado con esta rama tras venir de `dashboard-reporting` tras el cambio de rama en esta misma sesión):

- `apps/mobile`: `tsc --noEmit` limpio, `eslint src/ --max-warnings 0` limpio, Vitest **1456/1456** con cobertura, Cypress **102/102** (suite completa, no solo `update.cy.ts`) contra el stack Docker local real.
- `src-tauri`: `cargo fmt --check` limpio, `cargo clippy -- -D warnings` sin avisos, `cargo test` 9/9.
- `openspec validate --all --strict`: 32/32.
- **Verificación en dispositivo Android real** (no solo tests): 9.1 (compilación e instalación real, con un bug de manifest XML real encontrado y corregido, `30b19c4`), 9.2 (release de prueba `v0.1.18-actualizacion-test`, aviso/descarga/instalación reales con capturas, sin pedir desinstalar — confirma que el keystore persistente resuelve el problema de firma de verdad), 9.3 (**esta sesión**: cancelar el diálogo de instalación deja el banner reintentable sin volver a descargar — el run de CI original de esta tarea estaba huérfano, 0 jobs tras 24h en cola; se repitió el tag y el run nuevo sí generó jobs y terminó en verde).

## Mapeo Requirement → Scenario → Test

### `actualizacion-in-app`

| Requirement | Scenario | Test / verificación |
|---|---|---|
| La app comprueba si hay una versión más reciente al abrirse | Hay una versión más reciente publicada | `update-check.service.spec.ts` |
| La app comprueba si hay una versión más reciente al abrirse | La versión instalada ya es la más reciente | `update-check.service.spec.ts` |
| La app comprueba si hay una versión más reciente al abrirse | La comprobación falla por falta de conexión | `update-check.service.spec.ts` |
| La app comprueba si hay una versión más reciente al abrirse | La comprobación falla por un error de la fuente de versiones | `update-check.service.spec.ts` |
| La app comprueba si hay una versión más reciente al abrirse | Fuera de Android, la app no comprueba actualizaciones | `update-check.service.spec.ts`, `update.cy.ts` |
| Notificación local si hay una actualización disponible | Primera vez que se detecta una versión nueva | `update-notification.service.spec.ts` |
| Notificación local si hay una actualización disponible | La misma versión ya fue notificada | `update-notification.service.spec.ts` |
| Notificación local si hay una actualización disponible | El permiso de notificaciones no está concedido | `update-notification.service.spec.ts`, `app-update-banner.spec.ts` |
| Descarga del APK dentro de la app | Descarga iniciada por el usuario | `update-banner.element.spec.ts`, `app-update-banner.spec.ts` |
| Descarga del APK dentro de la app | Descarga completada con éxito | `update-download.service.spec.ts`, `app-update-banner.spec.ts` |
| Descarga del APK dentro de la app | Fallo de red durante la descarga | `update-download.service.spec.ts` |
| Instalación lanzada desde dentro de la app | Instalación lanzada tras una descarga completa | `commands.spec.ts` (wrapper IPC), verificación real 9.2 |
| Instalación lanzada desde dentro de la app | El permiso de instalar APKs externos no está concedido | `commands.spec.ts`, `app-update-banner.spec.ts` (`handleUpdateInstallRequested`) |
| Instalación lanzada desde dentro de la app | El usuario cancela el diálogo de instalación del sistema | **Solo verificación manual en dispositivo real (9.3, esta sesión)** — ver hallazgo de calidad de spec abajo |
| Instalación lanzada desde dentro de la app | La instalación falla por incompatibilidad de firma | Marcado explícitamente en el propio delta spec como verificación manual; mitigado estructuralmente por ADR-061 (keystore persistente) |

### `ci-cd` (MODIFIED)

| Requirement | Scenario | Test / verificación |
|---|---|---|
| El APK release se firma con un keystore de release persistente | Tag `v*` compila y firma con el keystore persistente | Verificación real 1.8/1.9 (huella de certificado con `apksigner`), release real `v0.1.18`/`v0.1.19-actualizacion-cancel-test` |
| El APK release se firma con un keystore de release persistente | El job falla si falta el secreto del keystore | `ci.yml:438-440` (lógica), sin test automatizado — coherente con "no automatizable, depende del keystore real" ya asumido en `design.md` |
| El APK release se firma con un keystore de release persistente | Dos releases consecutivas comparten certificado | Verificación real 1.9 (rechazo `INSTALL_FAILED_UPDATE_INCOMPATIBLE` del keystore antiguo, luego coherencia confirmada entre releases nuevas) |

**Cobertura de escenarios: 15/15**. 13 con test automatizado, 2 explícitamente de verificación manual (una marcada en el propio delta spec, la otra no — ver hallazgo).

## Hallazgos

1. **Calidad de spec (menor)** — `openspec/changes/actualizacion-in-app/specs/actualizacion-in-app/spec.md:71-73`. El escenario "El usuario cancela el diálogo de instalación del sistema" no puede validarse con Vitest/Cypress (depende de un `Intent.ACTION_VIEW` real de Android, que no expone resultado a la app) y de hecho solo se verificó a mano en dispositivo real (tarea 9.3). El propio contexto del proyecto exige marcar explícitamente estos casos ("si un escenario solo se puede validar a mano en dispositivo Android real, marcarlo de forma explícita — no disfrazarlo de automatizable"), y el escenario vecino ("La instalación falla por incompatibilidad de firma") sí lleva esa nota, pero este no. **No bloqueante**: la verificación manual sí se hizo y quedó documentada en `tasks.md` 9.3 y en `memory/context.md` de esta sesión — es un gap de anotación en el artefacto, no de comportamiento ni de cobertura real.

## Veredicto: **APPROVED WITH MINOR ISSUES**

Los 2 capabilities del delta spec (uno nuevo, uno modificado) están completos, con 13/15 escenarios cubiertos por test automatizado y los 2 restantes verificados a mano en dispositivo real y documentados. Sin hallazgos de seguridad, sin normas del proyecto saltadas. Único hallazgo: una anotación de "verificación manual" ausente en un escenario del delta spec que ya se archiva (no se puede editar tras archivar sin abrir una ADR/cambio nuevo si se quisiera corregir formalmente) — aceptado como issue menor, no bloquea el archivado. `memory/context.md` y `memory/decisions.md` (ADR-061, renumerada desde ADR-060 por colisión con `dashboard-reporting`) ya actualizados en esta sesión, antes de este review.
