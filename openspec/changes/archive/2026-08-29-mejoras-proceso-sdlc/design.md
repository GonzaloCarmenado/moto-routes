## Context

Ver `proposal.md` para el porqué. Este documento cubre solo las decisiones técnicas de cómo implementar los seis chequeos, todas derivadas de `memory/metrics/analisis-2026-08-17-2026-08-27.md`.

Estado actual relevante:
- `scripts/pre-commit.sh` ejecuta 9 pasos nombrados en orden fijo (array `STEP_NAMES` + funciones `step_N`), con progreso/timing persistido en `.git/pre-commit-timings.tsv` (no versionado).
- `.husky/pre-commit` tiene un atajo docs-only (salta todo si lo staged es solo markdown/YAML de openspec/JSONL de memory) y si no aplica, invoca `bash scripts/pre-commit.sh`.
- El pre-commit actual **no ejecuta ningún gate de Go** salvo `govulncheck` (step 3) — `gofmt`/`go vet`/`go build`/`go test` solo corren en CI (`.github/workflows/ci.yml`, job "Quality gates — Go"). De ahí que los eventos #11 (gofmt) y #14 (go vet/embed) del log de métricas solo aparecieran en CI.
- El checkout local en Windows tiene `core.autocrlf=true`: cualquier fichero `.go` en el working tree tiene CRLF, así que `gofmt -l`/`-d` contra el fichero en disco marca prácticamente todo como "necesita formato" aunque el contenido que se va a commitear (normalizado a LF por git) esté correcto — falso positivo ya documentado en sesiones anteriores.
- `apps/mobile/package.json` tiene 5 paquetes `@tauri-apps/plugin-*`; los 7 crates `tauri-plugin-*` de `Cargo.toml` están todos referenciados en `lib.rs` vía `.plugin(tauri_plugin_X::init())`. Dos crates Rust (`tauri-plugin-opener`, `tauri-plugin-log`) no tienen paquete JS equivalente — son plugins que no se invocan desde TypeScript.
- Dos directivas `//go:embed` en todo `apps/api`: `internal/webui/webui.go` (`dist`) e `internal/migrate/embed.go` (`migrations`), ambas embeds de directorio.

## Goals / Non-Goals

**Goals:**
- Cerrar los tres patrones recurrentes (P1-P3) y los tres hallazgos de un solo evento del informe con chequeos automáticos, sin depender de que alguien recuerde una lección escrita en memoria.
- Mantener el pre-commit determinista y con el mismo patrón de step nombrado + timing que ya existe, en vez de introducir un mecanismo distinto.
- Que los chequeos nuevos no tengan falsos positivos con el entorno real de este repo (CRLF en Windows, plugins ya registrados, embeds ya trackeados) — deben pasar en verde en `master` tal cual está hoy, antes de que se necesiten para detectar una regresión futura.

**Non-Goals:**
- No se añade `go test` a pre-commit (necesita Postgres+MinIO arrancados y tarda; ningún evento del log implicó un fallo de `go test` en concreto, solo `gofmt`/`go vet`/embed). Sigue siendo solo CI.
- No se toca `.github/workflows/ci.yml` — CI ya corre estos gates de forma independiente y sigue siendo la red de seguridad final.
- No se ejecuta `scripts/verify-prod-env.sh` contra el servidor de producción real en este cambio (decisión explícita del usuario) — el script queda listo pero su primer uso real contra producción es trabajo futuro.
- No se generaliza el chequeo de plugins nativos más allá de Tauri (no hay otro ecosistema de plugins nativos en el proyecto).

## Decisions

### D1 — `gofmt` contra el blob a commitear, no el fichero en disco
En vez de `gofmt -l apps/api/...` (falso positivo por CRLF, ver Context), el chequeo nuevo toma la lista de ficheros `.go` en stage (`git diff --cached --name-only --diff-filter=ACM -- 'apps/api/*.go'`) y para cada uno hace `git show ":<fichero>" | gofmt -l -` — el contenido que `git show ":<path>"` devuelve para un fichero en stage ya está normalizado a LF (es el blob que se va a commitear), igual que lo que CI ve al hacer checkout. Alternativa descartada: normalizar CRLF→LF a mano antes de pasar por `gofmt` (más código, mismo resultado que ya da `git show` gratis). Alternativa descartada: `gofmt -l .` sobre todo el árbol (ya se sabe por el propio evento #11 que eso genera ruido no relacionado con el commit).

### D2 — Verificación de `go:embed` por rastreo de directorio, no por lista fija
Script nuevo escanea `apps/api/**/*.go` con `grep -rn '^//go:embed'`, extrae el target de cada directiva (quitando un posible prefijo `all:`), lo resuelve relativo al directorio del fichero fuente, y comprueba con `git ls-files <target> | wc -l` que hay al menos un fichero rastreado bajo ese path (ambos embeds actuales son de directorio). Alternativa descartada: hardcodear las dos rutas conocidas (`internal/webui/dist`, `internal/migrate/migrations`) — más simple pero no detectaría un tercer embed futuro con el mismo problema, que es exactamente el tipo de gap que causó el evento #14.

### D3 — Chequeo de plugins nativos: unidireccional JS→Rust, por convención de nombre
Por cada `@tauri-apps/plugin-X` en las dependencies de `apps/mobile/package.json`, el script exige `tauri-plugin-X` en `Cargo.toml` y la cadena `tauri_plugin_X` en `lib.rs`. No se comprueba al revés (crates Rust sin paquete JS, como `opener`/`log`, son válidos y no deben fallar) — unidireccional porque el fallo real observado (evento #5) fue "dependencia JS añadida, lado Rust nunca registrado", nunca al revés. Alternativa descartada: parsear el AST de `lib.rs` para confirmar una llamada `.plugin(...)` real en vez de un `grep` de la cadena `tauri_plugin_X` — sobre-ingeniería para 5-7 plugins; un `grep` ya cubre el caso real y es consistente con cómo se verificó manualmente el propio evento #5 en su momento (`grep` en `Cargo.toml`/`lib.rs`).

### D4 — Lock de pre-commit con `mkdir` atómico, no `flock`
`.husky/pre-commit` crea `.git/precommit.lock/` con `mkdir` (operación atómica tanto en POSIX como en Git Bash sobre Windows) antes de invocar `scripts/pre-commit.sh`, y lo borra con un `trap ... EXIT` que cubre éxito, fallo y `Ctrl+C`. Si `mkdir` falla porque el directorio ya existe, aborta con un mensaje explícito indicando que ya hay un pre-commit en curso. Alternativa descartada: `flock` (no disponible de forma fiable en Git Bash para Windows, que es el entorno real de desarrollo de este proyecto — ver `CLAUDE.md`/Plataforma). Alternativa descartada: verificar el puerto 1420 directamente (`netstat`/`lsof`) en vez de un lock — más frágil, el puerto solo se ocupa en el paso de Cypress, no durante todo el pre-commit, así que no habría protegido el caso real del evento #13 (un `cypress run` manual lanzado mientras otro pre-commit completo, no solo Cypress, seguía vivo).

### D5 — `scripts/tag-release.sh` tag siempre sobre `origin/master`, nunca sobre HEAD local
El script hace `git fetch origin master` y crea/empuja el tag apuntando a `origin/master` (`git tag "$1" origin/master`), sin comprobar ni requerir que el checkout local esté en ese commit. Alternativa descartada: exigir que `HEAD` local coincida con `origin/master` antes de taguear (obligaría a un `checkout`/`pull` innecesario cuando lo único que hace falta es el número de commit correcto).

### D6 — `scripts/verify-prod-env.sh` compara nombres de clave, nunca valores
Extrae claves con `grep -oE '^[A-Z_][A-Z0-9_]*='` de ambos ficheros (ignora comentarios/blancos) y hace un diff de conjuntos — nunca imprime ni compara el valor real de ninguna variable, coherente con la regla de nunca escribir secretos reales en salida de ningún artefacto. Recibe dos rutas de fichero como argumentos en vez de conectarse él mismo por SSH — mantiene el script agnóstico de dónde vive el `.env.prod` real (local, copiado por SCP, o leído en el propio servidor), cumpliendo la decisión explícita de no tocar producción en este cambio.

### D7 — Orden final de pasos en `scripts/pre-commit.sh`
1. Auditando vulnerabilidades (frontend)
2. Auditando vulnerabilidades (Rust)
3. Auditando vulnerabilidades (Go)
4. **Quality gates Go (apps/api): gofmt + vet + build + go:embed rastreado** ← nuevo, agrupado con los pasos de Go existentes
5. ESLint (frontend)
6. **Plugins nativos Tauri registrados (JS↔Rust)** ← nuevo, agrupado con los pasos de frontend/Tauri
7. Tests frontend (Vitest)
8. Formato Rust (cargo fmt --check)
9. Clippy (backend)
10. Tests backend (cargo test)
11. **Comprobando Docker (API+Postgres arrancados)** ← nuevo, justo antes de Cypress, que es el único paso que lo necesita
12. Tests E2E (Cypress)

Ver ADR-062 en `memory/decisions.md` para el resumen de estas siete decisiones como una sola entrada (se evaluaron alternativas reales para cada una y el conjunto es costoso de revertir sin quedar otra vez expuesto a los mismos tres patrones recurrentes).

## Risks / Trade-offs

- **[Riesgo] Cada commit no docs-only tarda más** (3 pasos nuevos, ninguno pesado: gofmt/vet/build sin DB, grep de plugins, `docker ps`) → Mitigación: ninguno de los 3 compila con optimización ni arranca contenedores nuevos; coste esperado bajo un puñado de segundos, no minutos (a diferencia de Cypress o `cargo test`, que ya existían).
- **[Riesgo] El chequeo de Docker puede dar falso negativo si el contenedor `api` está arrancado pero no saludable** (p. ej. crasheado en loop) → Mitigación: comprobar `docker compose ps --status running` filtrando por los servicios reales (`api`, `postgres`), no solo que el daemon de Docker responda.
- **[Riesgo] Un lock huérfano** (proceso matado a mitad, `trap` no llega a ejecutarse — p. ej. `kill -9`) dejaría el directorio de lock y bloquearía todos los commits futuros → Mitigación: el mensaje de error al chocar con un lock existente incluye la ruta exacta (`.git/precommit.lock`) y la instrucción de borrarlo a mano si se confirma que no hay ningún pre-commit vivo; no se automatiza el borrado por edad para no reintroducir la misma condición de carrera que este cambio corrige.
- **[Riesgo] `scripts/verify-prod-env.sh` da falsa sensación de seguridad si nadie lo ejecuta realmente contra producción** (no está automatizado en ningún pipeline, es manual) → Aceptado explícitamente: automatizarlo contra el servidor real requeriría SSH, fuera de alcance de este cambio por decisión del usuario.
