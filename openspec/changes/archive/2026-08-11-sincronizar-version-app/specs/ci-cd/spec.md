## ADDED Requirements

### Requirement: El APK publicado en un Release lleva un versionName/versionCode derivado del tag
El job `build-and-release` de `.github/workflows/ci.yml` SHALL fijar el `version` de Tauri (y por tanto el `versionName`/`versionCode` empaquetados en el APK) a partir del tag `v*` que dispara la release, antes de compilar — nunca el valor por defecto versionado en `apps/mobile/src-tauri/tauri.conf.json`. El fichero del repo SHALL NOT modificarse de forma persistente (mismo patrón que el parcheo existente de `connect-src`/`VITE_API_BASE_URL`: se aplica en el checkout efímero del runner).

#### Scenario: Un tag de versión hornea su propio versionName en el APK
- **WHEN** se empuja un tag `v0.2.0` y el job `build-and-release` compila el APK de Android
- **THEN** el `versionName` empaquetado en el APK resultante es `0.2.0`, no el valor por defecto de `tauri.conf.json` en el repo

#### Scenario: El repositorio no queda modificado tras la release
- **WHEN** termina el job `build-and-release` para un tag `v*`
- **THEN** `apps/mobile/src-tauri/tauri.conf.json` en `master`/el repo sigue con su valor de placeholder para desarrollo local, sin ningún commit nuevo generado por el job

### Requirement: La verificación del APK empaquetado comprueba también el versionName
El paso existente que verifica el contenido del APK publicado (`ci.yml`, "Verify the APK bundles...") SHALL comprobar, además de que el HTML/JS empaquetados están actualizados y el CSP incluye el host real, que el `versionName` coincide con el tag de la release — SHALL fallar el job explícitamente si no coincide, en vez de publicar un Release con la versión equivocada en silencio.

#### Scenario: El job falla si el versionName empaquetado no coincide con el tag
- **WHEN** el `versionName` extraído del APK compilado no coincide con el tag `v*` que disparó la release
- **THEN** el job `build-and-release` termina en rojo antes de publicar el Release
- **Nota de verificación**: verificación estructural en `src/shared/ci/ci-workflow.spec.ts` (mismo patrón que las aserciones existentes sobre el step de `VITE_API_BASE_URL`); el resultado real de extraer y comparar el `versionName` de un APK compilado en un runner de GitHub Actions solo se confirma publicando una release real, igual que ya documenta la spec para el asset del Release.
