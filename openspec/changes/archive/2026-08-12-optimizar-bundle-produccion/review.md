# Review — optimizar-bundle-produccion

## CRÍTICO (leer primero)

- **Seguridad**: sin criptografía ni parseo de tokens hecho a mano, sin secretos nuevos en el diff (revisado explícitamente: `git diff` completo del cambio, sin coincidencias de `password|secret|token|api_key|-----BEGIN` más allá de la referencia ya existente a `secrets.MOBILE_PROD_API_BASE_URL`). El único cambio de firma (`build.gradle.kts`, buildType `release` → `signingConfig = signingConfigs.getByName("debug")`) reutiliza el keystore de depuración efímero que AGP ya genera hoy — no introduce ningún keystore, contraseña ni GitHub Secret nuevo. Confirmado explícitamente con el usuario antes de escribir la propuesta, y verificado en el run real de CI (`31582905618`) que no aparece ningún secret nuevo referenciado.
- **`src/shared/`**: no se ha tocado ningún fichero de `src/shared/` de la app (el cambio es build/CI/tooling, no código de producto). Sin radio de impacto sobre dominios funcionales.
- **Dependencias**: ninguna dependencia npm/Cargo/Go nueva. `apps/mobile/scripts/install-android.sh` es bash puro (mismo patrón que `setup-android.sh` ya existente).
- **Reglas del proyecto saltadas**: ninguna. El único fichero "generado" tocado a mano (`src-tauri/gen/android/app/build.gradle.kts`) ya estaba trackeado en git y hand-tuned antes de este cambio (confirmado con `git check-ignore`/`git ls-files` durante `design.md`), no es una excepción nueva.

## Veredicto: **APPROVED WITH MINOR ISSUES**

## Mapeo Requirement → Scenario → Verificación

### Capability `build-produccion-mobile` (nueva)

**Requirement: El build web de producción no genera ni empaqueta sourcemaps**
- Scenario "El directorio dist de producción no contiene sourcemaps" — ✅ verificado: `pnpm build` local, `find dist -name "*.map"` → 0 resultados (`dist/` 4.7MB→1.6MB).
- Scenario "El APK release no expone sourcemaps" — ✅ verificado dos veces: local (force-sync + `unzip -l` → 0 `.map`) y en el run real de GitHub Actions (`31582905618`, paso "Verify the APK bundles..." con la aserción `MAP_FILES -gt 0` → job en verde).

**Requirement: El APK publicado en un Release usa el buildType release de Android**
- Scenario "El código empaquetado está minificado" — ✅ verificado indirectamente: `isMinifyEnabled = true` ya existía, ahora se invoca de verdad al quitar `--debug`; el build real (local y CI) completó las tareas R8 de Gradle sin error.
- Scenario "Los recursos no usados no se empaquetan" — ✅ verificado: `isShrinkResources = true` añadido, tareas Gradle `optimizeUniversalReleaseResources`/`convertShrunkResourcesToBinaryUniversalRelease` ejecutadas con éxito en el build real.
- Scenario "La biblioteca nativa usa el profile optimizado de Rust" — ✅ medido real: `libapp_lib.so` 148MB (debug, sin stripear) → 6.7MB (release, LTO+strip).
- Scenario "La app instalada sigue funcionando (verificación manual)" — ✅ **verificación manual explícita del usuario** en dispositivo real (`75fe536b`): grabación GPS, mapa y fotos operativas sobre el build minificado. Reforzado con verificación automática previa (proceso en foreground, puente JNI Rust↔Kotlin sin excepciones en logcat).

**Requirement: El APK de producción no requiere gestionar un keystore de firma nuevo**
- Scenario "No aparece ningún secreto de firma nuevo" — ✅ verificado: diff completo revisado, sin secretos nuevos; `signingConfig` reutiliza el de `debug`.

**Requirement: El tamaño del APK release está sujeto a un presupuesto verificado automáticamente**
- Scenario "El umbral se documenta junto al mecanismo" — ✅ `MAX_APK_SIZE_MB: 20` en `ci.yml`, comentario cita la medición real (9MB, run `31582905618`).
- Scenario "Un APK dentro del presupuesto no se bloquea" — ✅ verificado real: 9MB < 20MB, el job continuó y publicó el Release.
- Scenario "Un APK que supera el presupuesto bloquea la release" — ⚠️ **no verificado con un caso real que exceda el umbral** (solo se ejecutó el camino donde el tamaño está dentro de presupuesto). La lógica (`if [ "$SIZE_MB" -gt "$MAX_APK_SIZE_MB" ]; then exit 1; fi`) es idéntica en estructura a los otros dos checks ya probados y confiables del mismo job (verificación de `versionName` y de host CSP), pero no se disparó deliberadamente un caso de fallo. Ver hallazgo en Cobertura.

### Capability `ci-cd` (modificada)

**Requirement: El build y release de Android solo se dispara con un tag de versión**
- Scenario "El APK resultante se publica como asset del GitHub Release, compilado en modo release optimizado" — ✅ verificado real end-to-end: tag `v0.0.1-optimizar-bundle-test`, run `31582905618`, job `Build & release Android APK` en verde (18m44s), asset `moto-routes-v0.0.1-optimizar-bundle-test-arm64.apk` publicado (sin sufijo `-debug`), Release y tag borrados después de confirmar.
- Los otros 3 escenarios de este requirement (trigger por tag, no-trigger en push normal, dependencia de quality gates) no cambian de comportamiento en este cambio — sin regresión, cubiertos por los tests estructurales ya existentes de `ci-workflow.spec.ts` (35/35 en verde, incluye los 2 tests nuevos añadidos en rojo→verde vía TDD para este cambio).

## Hallazgos

### Cobertura
- **[Minor] Camino de fallo del presupuesto de tamaño sin verificar con un caso real.** `.github/workflows/ci.yml`, paso "Check APK size budget". Solo se probó el camino "dentro de presupuesto" (9MB < 20MB). No bloquea el archivado — la lógica es trivial y sigue el mismo patrón ya fiable de los checks vecinos — pero queda como deuda de verificación: si se toca este paso en el futuro, confirmar explícitamente el camino de fallo (p. ej. bajando `MAX_APK_SIZE_MB` a un valor por debajo del real en una PR de prueba) antes de asumir que sigue funcionando.

Sin hallazgos de tipo gap, desviación o calidad. Sin hallazgos de convenciones de frontend (el cambio no toca `src/`).

## Independiente, re-ejecutado en esta revisión (no solo el resumen de la implementación)

- `tsc --noEmit`: 0 errores.
- `eslint src/ --max-warnings 0`: 0 warnings.
- `vitest run --coverage`: 983/983 tests, 105/105 ficheros, cobertura 96.42% líneas / 90.89% branches / 94.41% funciones (umbral 80%).
- `ci-workflow.spec.ts` aislado: 35/35.
- `cargo fmt --check`: limpio.
- `cargo clippy -- -D warnings`: 0 warnings.
- `cargo test` (`src-tauri`): 5/5.
- Cypress E2E (54/54, contra `apps/api` real vía Docker): confirmado dos veces por el hook `pre-commit` real durante la implementación (no re-ejecutado en esta revisión por ser lento y ya confirmado dos veces con backend real).
- Run real de GitHub Actions (`31582905618`, tag de prueba): `Build & release Android APK` verde en 18m44s; `Quality gates — TypeScript` y `Quality gates — Rust/Tauri` verdes.
