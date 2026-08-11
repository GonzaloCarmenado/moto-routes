## Why

`apps/mobile/src-tauri/tauri.conf.json` tiene `"version": "0.1.0"` hardcodeado desde el inicio del proyecto y nunca se ha tocado. El CLI de Tauri usa ese campo para generar `tauri.properties` (`versionName`/`versionCode`) en cada build de Android — así que **todas las releases publicadas hasta ahora (`v0.1.1` a `v0.1.5`) se han compilado con `versionName=0.1.0`** grabado dentro del propio APK, aunque el nombre del asset del GitHub Release sí lleva el tag correcto (`ci.yml` renombra el fichero con el tag, pero nunca actualiza `tauri.conf.json`). Android muestra ese `versionName` obsoleto en "Información de la app", sin relación con qué release se instaló realmente.

Encontrado el 2026-08-11: el usuario, al ver "0.1.0" instalado tras descargar el asset de la release `v0.1.5`, sospechó un problema de etiquetado que podía explicar por qué no conseguía crear una cuenta. Se investigó y se descartó como causa de ese incidente (la causa real fue una ACL de Tailscale Funnel, ver [[ADR-045]] en `memory/decisions.md`), pero la discrepancia de versión es un bug real e independiente que conviene corregir ahora que se ha detectado — deja a cualquiera que reporte un problema (usuario o desarrollador) sin poder confiar en la versión mostrada por Android para saber qué build tiene instalado realmente.

## What Changes

- El job `build-and-release` de `.github/workflows/ci.yml` deriva el `version` de Tauri a partir del tag `v*` que dispara la release (mismo patrón ya usado para `VITE_API_BASE_URL`: parcheado con `sed` en un checkout efímero del runner, nunca escrito de vuelta al repo).
- `apps/mobile/src-tauri/tauri.conf.json` en el repo sigue teniendo un `version` fijo como placeholder de desarrollo local (sin cambio de comportamiento para builds locales) — solo el binario final publicado en cada Release lleva el `versionName`/`versionCode` real derivados del tag.
- El paso existente "Verify the APK bundles..." se amplía para comprobar también que el `versionName` empaquetado coincide con el tag de la release, no solo que el CSP/JS estén actualizados — mismo criterio que ya se aplicó en ADR-035 punto 8 para detectar en CI lo que antes solo se detectaba manualmente.

## Capabilities

### Modified Capabilities
- `ci-cd`: el job `build-and-release` pasa a fijar `versionName`/`versionCode` del APK a partir del tag `v*`, y el paso de verificación existente pasa a comprobarlo.

## Impact

- `.github/workflows/ci.yml` (job `build-and-release`): nuevo step para parchear `tauri.conf.json` con el `version` derivado del tag, antes de compilar; el step de verificación existente se amplía.
- `apps/mobile/src-tauri/tauri.conf.json`: sin cambio de valor por defecto (sigue siendo un placeholder para desarrollo local), pero pasa a ser parcheado en el checkout efímero de CI, igual que ya ocurre con `index.html`/`tauri.conf.json` para `connect-src`.
- `src/shared/ci/ci-workflow.spec.ts`: nueva aserción estructural sobre el step nuevo, mismo patrón que las ya existentes para el step de `VITE_API_BASE_URL`.
- No se crea ninguna release ni tag `v*` como parte de este cambio — el efecto solo es observable en la próxima release que se publique.
