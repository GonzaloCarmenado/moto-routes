# Review — `mejoras-proceso-sdlc`

## CRÍTICO (leer primero)

- **Seguridad**: sin hallazgos. `scripts/verify-prod-env.sh` compara únicamente nombres de clave, nunca valores (confirmado leyendo el script línea a línea — usa `grep -oE '^[A-Z_][A-Z0-9_]*='`, jamás captura el valor tras el `=`). Ningún script nuevo imprime, transmite ni embebe un secreto real; se probaron todos contra valores dummy en directorios scratch (tasks 5.2, 6.2, 6.3). Escaneado el diff completo (`scripts/`, `.husky/`) buscando `token|secret|password|api[_-]?key|-----BEGIN`: sin coincidencias fuera de los nombres de variable de entorno ya documentados (`ADMIN_STATUS_TOKEN`, `RESEND_WEBHOOK_SECRET`), que es exactamente lo esperado (D6).
- **Cambios en `src/shared/` o radio de impacto amplio**: ninguno. Este cambio es 100% tooling de proceso (`scripts/`, `.husky/pre-commit`) — cero líneas de `apps/mobile/src`, `apps/api` o `apps/web` tocadas. `skip_specs: true` en `proposal.md` es correcto: no hay comportamiento observable nuevo en ninguna app.
- **Actualizaciones de dependencias core**: ninguna. No se toca `package.json`, `Cargo.toml` ni `go.mod`.
- **Reglas del proyecto saltadas**: ninguna detectada. Rama `feature/mejoras-proceso-sdlc` desde `master`, sin push directo.
- **Fuera de alcance de este cambio, preexistente y no bloqueante**: `apps/mobile/src-tauri/gen/schemas/desktop-schema.json` y `windows-schema.json` aparecen como modificados en `git status` pero `git diff`/`git diff --numstat` no muestran ningún contenido real (probablemente metadata de un build de Tauri anterior a esta sesión). No forman parte del "Impact" declarado en `proposal.md` y ningún script de este cambio los toca — se dejan tal cual, sin incluir en el commit de este cambio.

## Verificación independiente

Releído el código de los 5 scripts nuevos y el diff de `.husky/pre-commit`/`scripts/pre-commit.sh` línea a línea (no solo el resumen de `tasks.md`), contrastado contra las 7 decisiones D1-D7 de `design.md`:

| Decisión | Implementación | Conforme |
|---|---|---|
| D1 — gofmt contra el blob en stage | `check-go-quality.sh`: `git diff --cached --name-only` + `git show ":$f" \| gofmt -l` (sin flag `-` explícito, corregido durante `apply` tras fallar en este entorno) | ✓ |
| D2 — go:embed rastreado por git, no lista fija | `check-go-quality.sh`: `grep -rn '^//go:embed '` + resolución dinámica + `git ls-files` | ✓ |
| D3 — plugins nativos unidireccional JS→Rust | `check-native-plugins.sh`: itera `@tauri-apps/plugin-*` de `package.json`, exige `tauri-plugin-*` en `Cargo.toml` + `tauri_plugin_*` en `lib.rs`; no comprueba al revés | ✓ |
| D4 — lock `mkdir` atómico, no `flock` | `.husky/pre-commit`: `mkdir "$LOCK_DIR"` + `trap 'rmdir "$LOCK_DIR"' EXIT` | ✓ |
| D5 — tag siempre sobre `origin/master` | `tag-release.sh`: `git fetch origin master` + `git tag "$TAG" "$(git rev-parse origin/master)"`, nunca lee `HEAD` | ✓ |
| D6 — verify-prod-env compara nombres, nunca valores | `verify-prod-env.sh`: `grep -oE '^[A-Z_][A-Z0-9_]*='` en ambos ficheros, `comm -23` sobre los nombres | ✓ |
| D7 — orden final de 12 pasos | `scripts/pre-commit.sh::STEP_NAMES`/`step_N` — orden confirmado idéntico a design.md (Go quality gates en 4, plugins en 6, Docker en 11) | ✓ |

Suite completa re-ejecutada de forma independiente (no aceptado el resumen de `tasks.md` sin más), con Docker arrancado:
- **Primera corrida**: 2 tests Vitest fallaron por timeout de 5s (`app-update-banner.spec.ts`, `photo-capture-adapter.service.spec.ts`) — ninguno de los dos toca código de este cambio. Reproducido en solitario (`npx vitest run --coverage --silent`): **1466/1466 en verde**, confirmando que fue flakiness por contención de recursos (Docker Desktop arrancando en paralelo), no una regresión.
- **Segunda corrida, de punta a punta sin interrupciones**: **12/12 pasos en verde en 9m44s**, incluido Cypress **102/102**.
- `openspec validate mejoras-proceso-sdlc --strict`: válido.

## Cobertura de escenarios / tareas

Sin delta specs (`skip_specs: true`, confirmado también por `openspec status --json`: `specs` → `skipped`, `existingOutputPaths: []`) — no hay Requirements/Scenarios EARS que mapear. La verificación real de este cambio son las 6 recomendaciones del informe de métricas, cada una con su propia prueba contra un caso roto real (no solo contra el estado ya sano del repo):

| Recomendación (informe `analisis-metricas-sdlc`) | Prueba contra caso roto real | Test/tarea |
|---|---|---|
| P1 — Docker no arrancado | Docker Desktop realmente parado al empezar la tarea 3.2 | tasks.md 3.2 |
| P2 — segundo proceso compitiendo por el puerto 1420 | Arnés aislado reproduciendo `mkdir`+`trap` con dos procesos concurrentes reales | tasks.md 4.3 |
| P3 — gofmt/go vet/embed solo en CI | Indentación rota + embed no rastreado, ambos simulados en scratch dir aislado | tasks.md 1.2/1.4 |
| Plugin JS sin registrar en Rust | Cargo.toml con una entrada quitada en copia scratch, caso real de `notification` reproducido | tasks.md 2.2 |
| Tag sobre commit equivocado | Tag de prueba real creado/verificado/borrado en local+remoto | tasks.md 5.2 |
| `.env.prod` desincronizado | Claves reales del incidente v0.1.16 quitadas de una copia scratch | tasks.md 6.2 |

Todas de verificación automática — ninguna requiere verificación manual futura salvo el primer uso real de `verify-prod-env.sh` contra producción (documentado como fuera de alcance explícito en `proposal.md`/`design.md` Non-Goals, no un gap de este cambio).

## Hallazgos

Ninguno que bloquee. Dos notas menores, ninguna de las dos requiere acción antes de archivar:

- **[calidad, menor]** `apps/mobile/src-tauri/gen/schemas/desktop-schema.json`/`windows-schema.json` quedan modificados en el working tree sin relación con este cambio (ver CRÍTICO) — a limpiar en una sesión futura que sí toque Tauri, no aquí.
- **[cobertura, menor]** `scripts/verify-prod-env.sh` no tiene aún un uso real contra el `.env.prod` de producción — decisión explícita documentada en `proposal.md`/`design.md`, no un gap de esta revisión.

## Veredicto

**APPROVED**

Las 7 decisiones de diseño están implementadas tal cual se documentaron, sin desviaciones. Suite completa verificada de forma independiente y en verde (12/12, Cypress 102/102). Sin hallazgos de seguridad, sin cambios en código de aplicación, sin secretos en el diff. `openspec validate --strict` limpio.
