# Review — `ci-cd-pipeline`

Verificación independiente: código releído y suite completa re-ejecutada por mí mismo, más **verificación real en GitHub Actions** (no solo el test estructural local) — 3 gaps reales encontrados y corregidos en vivo durante esa verificación (ver `tasks.md` bloque 5). Resultado íntegro al cierre: **754/754 Vitest**, `tsc --noEmit` limpio, ESLint limpio, PR #87 con `quality-ts`/`quality-tauri` en verde real sobre GitHub (no simulado), tag de prueba `v0.0.1-test` compiló/verificó/publicó el Release correctamente (borrado tras confirmar).

## CRÍTICO

- **Seguridad**: sin secretos nuevos (decisión explícita: APK debug sin firma de release). El único permiso nuevo (`permissions: contents: write` en `.github/workflows/ci.yml`) está acotado al job `build-and-release` únicamente, no a todo el workflow — coherente con ADR-014 (permisos mínimos). `quality-ts`/`quality-tauri` no llevan ningún `permissions:` adicional (heredan el `contents: read` por defecto).
- **Acciones de terceros usadas** (superficie de confianza a tener en cuenta, no bloqueante): `pnpm/action-setup`, `actions/setup-node`, `actions/setup-java`, `actions/cache`, `dtolnay/rust-toolchain`, `Swatinem/rust-cache`, `taiki-e/install-action`, `softprops/action-gh-release` — todas de la comunidad, ampliamente usadas y mantenidas, ninguna con acceso a secretos salvo `softprops/action-gh-release` (recibe `GITHUB_TOKEN`, con permiso ya acotado como se indica arriba).
- **Cambios en `src/shared/`**: 1 fichero nuevo (`src/shared/ci/ci-workflow.spec.ts`), de solo lectura de `.github/workflows/ci.yml` desde disco — sin exports que ningún otro módulo importe, radio de impacto nulo sobre `cockpit`/`routes`/`profile`.
- **Reglas del proyecto saltadas**: ninguna. No se instaló ninguna dependencia npm/Cargo nueva (las 8 acciones de GitHub Actions no son dependencias del proyecto en el sentido de `package.json`/`Cargo.toml`). El hallazgo de `.cargo/config.toml` (ruta de Windows hardcodeada) se resolvió sin tocar ese fichero, tal como exigía el diseño.

## Trazabilidad Requirement/Scenario → verificación

Capability `ci-cd` (única de este cambio), spec en `specs/ci-cd/spec.md`:

| Requirement | Scenario | Verificación | Estado |
|---|---|---|---|
| Gates TS bloquean | tsc / ESLint / cobertura Vitest / Cypress / cobertura docs fallan | `src/shared/ci/ci-workflow.spec.ts` (estructura) + ejecución real en PR #87 (todos los pasos corrieron y pasaron con datos reales, incluido Cypress completo en `ubuntu-latest`) | ✅ automatizado + verificado en vivo |
| Gates TS bloquean | pasa en verde | Run real `30761009506`/`30762214408`, job `quality-ts`: éxito | ✅ verificado en vivo |
| Gates Tauri bloquean | fmt/clippy/test/audit | `ci-workflow.spec.ts` + ejecución real, job `quality-tauri`: éxito | ✅ automatizado + verificado en vivo |
| Release solo por tag | push normal no dispara | `ci-workflow.spec.ts` (`if: refs/tags/v`) — no se forzó un push a `master` sin tag en esta sesión para confirmarlo empíricamente, se confía en la semántica estándar de `github.ref`/`if:` de GitHub Actions | ✅ estructural (mecanismo estándar, no reprobado en vivo) |
| Release solo por tag | tag dispara | 3 pushes reales de `v0.0.1-test` dispararon `build-and-release` cada vez | ✅ verificado en vivo |
| Release solo por tag | no compila si gates fallan | Garantizado por `needs: [quality-ts, quality-tauri]` (mecanismo estructural de GitHub Actions, no se forzó un fallo real para probarlo) | ✅ estructural |
| Release solo por tag | APK publicado como asset | Release real `v0.0.1-test` con asset `moto-routes-v0.0.1-test-arm64-debug.apk`, confirmado con `gh release view` y borrado después | ✅ verificado en vivo |
| Linker sin ruta local | build no falla por ruta inexistente | Build real en `ubuntu-latest` completado con éxito usando el NDK del runner (Windows path nunca referenciado) | ✅ verificado en vivo |
| Caché pnpm/Cargo | los 3 jobs cachean pnpm; quality-tauri/build-and-release cachean Cargo | `ci-workflow.spec.ts` confirma la declaración de caché en los 3 jobs | ✅ automatizado (estructura); el *beneficio* real de velocidad en ejecuciones sucesivas no se midió empíricamente en esta sesión (ver Hallazgos) |

**Cobertura de escenarios: 15/15 declarados, con verificación real en vivo para los más críticos** (los únicos 3 marcados "estructural" dependen de mecanismos nativos de GitHub Actions — `if:`/`needs:`/`github.ref` — no de código propio, coherente con no reprobar deliberadamente el pipeline solo para confirmar un comportamiento ya garantizado por la plataforma).

## Hallazgos

- **[Gaps reales, encontrados y corregidos durante la propia verificación de este cambio — no son un defecto del proceso, es exactamente para lo que servía el paso 5 de `tasks.md`]**: los 3 problemas de `sdkmanager` fuera de `PATH`, la expresión inválida `${{ env.ANDROID_HOME }}`, y el `GITHUB_TOKEN` sin `contents: write` — ninguno se habría detectado sin ejecutar de verdad en GitHub Actions. Los 3 están corregidos, verificados con una ejecución real posterior en verde, y documentados en `tasks.md`/`memory/decisions.md` (ADR-031). Outcome: **fixed**.
- **[Cobertura, menor, no bloqueante]**: el beneficio real de la caché de pnpm/Cargo/Android SDK (tiempo ahorrado en una segunda ejecución) no se midió empíricamente — todas las ejecuciones de esta sesión fueron efectivamente "primera vez" (caché recién creada). La estructura está verificada y es correcta; falta observar una ejecución futura con caché ya poblada para confirmar el ahorro de tiempo esperado. No bloqueante: la caché está bien declarada, y si no aportara beneficio no rompería nada, solo no aceleraría.
- **[Sin hallazgos de seguridad, de convenciones de frontend, ni de calidad]**: sin CSS/`data-cy` implicados (no hay UI), el único fichero TS nuevo sigue el patrón ya establecido por `pre-commit-audit-gate.spec.ts`.

## Veredicto

**APPROVED**

Sin bloqueantes de seguridad, sin normas del proyecto saltadas, cobertura completa de escenarios (con verificación real en GitHub Actions para los casos más críticos, no solo simulada), y los 3 gaps reales encontrados durante la verificación quedaron corregidos y reconfirmados antes de este veredicto. El único punto abierto (beneficio de caché no medido aún) es de seguimiento, no bloqueante.
