## 1. Test de regresión en rojo: el step de versión debe existir en `build-and-release`

- [x] 1.1 En `apps/mobile/src/shared/ci/ci-workflow.spec.ts` (`describe('job build-and-release')`), añadir un test que falle en rojo: el job debe contener un step que derive `version` del tag `v*` y lo escriba en `apps/mobile/src-tauri/tauri.conf.json` antes del step existente que compila con la Tauri CLI (mismo patrón `extractJob`/`toMatch` ya usado para los demás steps de este job).
- [x] 1.2 Confirmar el test en rojo (`pnpm vitest run ci-workflow.spec.ts` dentro de `apps/mobile`) antes de tocar `ci.yml`.

## 2. Implementación: derivar `version` del tag antes de compilar

- [x] 2.1 En `.github/workflows/ci.yml`, job `build-and-release`, añadir un step nuevo antes de la compilación con la Tauri CLI que: toma el tag (`$GITHUB_REF_NAME`, la variable de entorno automática del runner, mismo mecanismo ya usado en el step "Rename APK with the release tag" — no la expresión `${{ github.ref_name }}` de `design.md`, ajustado por consistencia con ese precedente real), le quita el prefijo `v`, y sustituye con `sed` el valor de `"version"` en `apps/mobile/src-tauri/tauri.conf.json` — mismo patrón que el step "Configure production apps/api host" ya existente para `connect-src`.
- [x] 2.2 Confirmar el test de 1.1 en verde.

## 3. Test de regresión en rojo: la verificación del APK debe comprobar el `versionName`

- [x] 3.1 En el mismo spec, añadir un test que falle en rojo: el step existente de verificación del APK empaquetado ("Verify the APK bundles...") debe incluir además una comprobación con `aapt dump badging` del `versionName`, comparándolo contra el tag y fallando el job si no coincide.
- [x] 3.2 Confirmar el test en rojo.

## 4. Implementación: verificar el `versionName` empaquetado

- [x] 4.1 Ampliar el step de verificación existente en `ci.yml` para localizar `aapt` dentro de `$ANDROID_HOME/build-tools/` (mismo patrón ya usado para localizar `sdkmanager`, ADR-031), ejecutar `aapt dump badging` sobre el `.apk` recién compilado, extraer `versionName`, y fallar el job explícitamente (mensaje claro, mismo estilo que los `exit 1` ya existentes en ese step) si no coincide con el tag sin el prefijo `v`.
- [x] 4.2 Confirmar el test de 3.1 en verde y que el resto de la suite de `ci-workflow.spec.ts` sigue en verde (33/33).

## 5. Verificación real, no solo estructural

- [x] 5.1 No viable simular el job completo (`sed` real + `aapt` real sobre un APK compilado) sin ejecutarlo en un runner de GitHub Actions real — documentado como pendiente de confirmar en la próxima release futura que use este mecanismo. **No se ha publicado ningún tag/release nuevo como parte de este cambio** (petición explícita del usuario).
- [x] 5.2 Ejecutada la suite local que no depende de Docker/Postgres: `tsc --noEmit` limpio, ESLint (`eslint src/`) limpio, Vitest con cobertura 967/967 (96.38% líneas, por encima del umbral 80%), `cargo fmt --check`/`cargo clippy -- -D warnings`/`cargo test` limpios. **No ejecutados** por no haber Docker disponible en este entorno: Cypress E2E (`pnpm run test:e2e`, exige backend real vía `docker compose`) y los tests de Go de `apps/api` (exigen Postgres vía `internal/dbtest`) — ninguno de los dos toca ficheros modificados por este cambio (solo `.github/workflows/ci.yml` y `apps/mobile/src/shared/ci/ci-workflow.spec.ts`), pero queda como verificación pendiente antes de dar el cambio por cerrado del todo. **Hallazgo no relacionado, descubierto de pasada**: `cargo audit --ignore RUSTSEC-2023-0071` falla con una vulnerabilidad real nueva (`RUSTSEC-2026-0235`, `rkyv 0.7.46`, no cubierta por la excepción ya documentada) — preexistente, no causada por este cambio (no se ha tocado ninguna dependencia de Cargo). Anotado en `memory/context.md` para investigarlo aparte.

## 6. Cierre

- [x] 6.1 Actualizado `memory/context.md` (estado actual) con el resultado de este cambio y lo pendiente de confirmar en la próxima release real.
- [x] 6.2 Sin gap de diseño real que documentar como ADR — la única corrección fue de redacción (`design.md` mencionaba `${{ github.ref_name }}`, el precedente real del propio job usa la variable de entorno `$GITHUB_REF_NAME`; ajustado en la implementación, anotado en la tarea 2.1). El hallazgo de `cargo audit` (tarea 5.2) es independiente de este diseño — anotado en `memory/context.md`, no amerita ADR por sí solo todavía.
