# Review: sincronizar-version-app

## CRÍTICO (leer primero)

- **Sin secretos nuevos ni tocados**: el cambio reutiliza `secrets.MOBILE_PROD_API_BASE_URL` ya existente para el `env:` del step de verificación (necesario porque ese step ya lo usaba antes); no se introduce ningún secreto nuevo ni se modifica su valor.
- **Sin cambios en `src/shared/`**: el cambio no toca ningún componente compartido de la app — solo `.github/workflows/ci.yml` (transversal, fuera de `apps/mobile/src`) y `apps/mobile/src/shared/ci/ci-workflow.spec.ts` (test estructural del propio workflow).
- **Sin dependencias nuevas**: no se ha tocado `package.json`, `Cargo.toml` ni `go.mod`.
- **Ninguna regla del proyecto saltada**: TDD real seguido (rojo confirmado antes de cada implementación), sin secretos en claro, sin `any`, sin `unwrap()`/`expect()` nuevo.
- **No se ha publicado ningún tag ni release** — petición explícita del usuario, respetada durante toda la implementación.
- **Gap de verificación real, ya anotado en `tasks.md`/`memory/context.md`, no oculto**: el comportamiento real del `sed`+`aapt` en un runner de GitHub Actions genuino no se ha ejecutado (solo verificado estructuralmente con Vitest) — se confirmará en la próxima release real que use este mecanismo, no antes.

## Verificación independiente realizada

- Releído el diff completo de `.github/workflows/ci.yml` (`git diff`) línea por línea — confirmado que el nuevo step "Set app version from release tag" se ejecuta antes de "Build APK" (orden correcto: la Tauri CLI regenera `tauri.properties` a partir de `tauri.conf.json` en ese paso, así que el `version` ya parcheado se propaga correctamente al APK). Confirmado que el step posterior de reempaquetado solo-Gradle no vuelve a tocar `tauri.conf.json`/`tauri.properties`, así que no revierte el parche.
- Confirmado que `tauri.conf.json` solo tiene una clave `"version"` (línea 4 antes del cambio) — el `sed` con `s|"version": "[^"]*"|...|` no puede coincidir accidentalmente con ninguna otra clave.
- Re-ejecutado `pnpm vitest run src/shared/ci/ci-workflow.spec.ts` de forma independiente (no solo confiando en el resultado de la implementación): **33/33 en verde**.
- Re-ejecutado además, fuera de lo que pedía `tasks.md`, `tsc --noEmit`, `eslint src/` (vía `rtk proxy` para evitar el rewrite del hook sobre `pnpm run lint`), `cargo fmt --check`, `cargo clippy -- -D warnings` y `cargo test` — todos en verde.

## Mapeo Requirement → Scenario → Verificación

| Requirement | Scenario | Verificación |
|---|---|---|
| El APK publicado en un Release lleva un versionName/versionCode derivado del tag | Un tag de versión hornea su propio versionName en el APK | Test estructural `derives the packaged app version from the release tag before building` (`ci-workflow.spec.ts`). **No verificado con una release real** — pendiente, ver Gaps. |
| (mismo Requirement) | El repositorio no queda modificado tras la release | No tiene test dedicado — se apoya en la misma garantía estructural que el patrón preexistente (`Configure production apps/api host`, checkout efímero, nunca se hace commit/push desde el runner). Coherente por diseño, no un gap nuevo introducido por este cambio. |
| La verificación del APK empaquetado comprueba también el versionName | El job falla si el versionName empaquetado no coincide con el tag | Test estructural `verifies the packaged versionName matches the release tag` (`ci-workflow.spec.ts`). **El comportamiento real de fallo (`aapt` real sobre un APK real) no verificado** — pendiente, ver Gaps. |

Cobertura de escenarios: 3/3 con al menos un test o justificación explícita; 2/3 son estructurales (Vitest sobre el YAML), no ejecución real de GitHub Actions — mismo patrón y mismo tipo de límite ya aceptado en la spec `ci-cd` existente (ver su propia nota de verificación para el asset del Release).

## Hallazgos

### Gaps (pendientes de verificación real, no de implementación)
1. **[Gap, no bloqueante]** El comportamiento real del `sed` sobre `tauri.conf.json` y de `aapt dump badging` en un runner de GitHub Actions genuino no se ha ejecutado — no era posible sin publicar un tag/release real, expresamente descartado por el usuario para este cambio. Mismo criterio que ADR-031/ADR-035: la estructura se verifica con Vitest, el comportamiento real de Actions se confirma la próxima vez que se dispare el job de verdad. Recomendación: confirmarlo explícitamente en la próxima release (`versionName` real del APK descargado) y anotar el resultado en `memory/context.md`.
2. **[Gap, no bloqueante, entorno de esta sesión]** Cypress E2E y los tests Go de `apps/api` no se ejecutaron por no haber Docker disponible en este entorno. Ninguno de los dos toca ningún fichero modificado por este cambio (`.github/workflows/ci.yml`, `ci-workflow.spec.ts`), por lo que el riesgo de regresión es bajo, pero queda como verificación pendiente antes de considerar el cambio completamente cerrado.

### Hallazgo no relacionado (fuera de alcance de este cambio, no corregido aquí)
3. **[Informativo, fuera de alcance]** `cargo audit --ignore RUSTSEC-2023-0071` falla localmente con `RUSTSEC-2026-0235` (`rkyv 0.7.46`, vulnerabilidad real, no solo advertencia) — preexistente, no causado por este cambio (ninguna dependencia de Cargo tocada). Ya anotado en `memory/context.md` como línea de investigación separada. No se corrige en este cambio (scope creep explícitamente evitado).

### Desviaciones respecto a los artefactos planeados
4. **[Desviación menor, ya corregida en la propia implementación]** `design.md` mencionaba `${{ github.ref_name }}` (expresión de GitHub Actions) como mecanismo para leer el tag; la implementación usa `$GITHUB_REF_NAME` (variable de entorno del runner), que es lo que el precedente real del propio job ("Rename APK with the release tag") ya usaba. Ajuste de redacción, sin impacto de comportamiento — documentado en `tasks.md` tarea 2.1.

No se han encontrado gaps de seguridad, desviaciones de comportamiento no documentadas, ni incumplimientos de las convenciones del proyecto (estructura de ficheros, JSDoc, tipos estrictos).

## Veredicto

**APPROVED WITH MINOR ISSUES**

Justificación: los dos requirements y sus tres scenarios están implementados y cubiertos por test estructural real (TDD rojo→verde confirmado de forma independiente); no hay ningún problema de seguridad, ninguna desviación de comportamiento no documentada y ninguna norma del proyecto saltada. El único motivo por el que no es `APPROVED` sin matices es que la verificación end-to-end real (comportamiento genuino de `sed`/`aapt` en un runner de GitHub Actions, y la suite de Cypress/Go que no pudo ejecutarse en este entorno) queda pendiente de confirmar — inherente a la petición explícita de no publicar ninguna release como parte de este cambio, no un defecto de la implementación.
