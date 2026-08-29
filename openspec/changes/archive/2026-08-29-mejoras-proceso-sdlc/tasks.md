## 1. Chequeo Go: gofmt (blob) + vet + build + `go:embed` rastreado (D1, D2)

- [x] 1.1 Crear `scripts/check-go-quality.sh`: gofmt contra `git show ":<fichero>"` de cada `.go` en stage bajo `apps/api` (nunca contra el fichero en working tree), `go vet ./...`, `go build ./...` (ambos con `cd apps/api`).
- [x] 1.2 Probar el chequeo de gofmt contra un caso roto real: introducir temporalmente una indentación incorrecta en un fichero `.go` de prueba (fuera de `apps/api`, en un scratch dir), confirmar que el script lo detecta (RED) antes de seguir. **Hallazgo real**: `gofmt -l -`/`gofmt -d -` (con el flag `-` explícito para stdin) no funciona en este entorno (`go1.26.6 windows/amd64`) — falla con "El sistema no puede encontrar el archivo especificado". Corregido a `gofmt -l`/`gofmt -d` sin argumento (gofmt lee stdin por defecto cuando no se le pasa ningún path), confirmado con el mismo caso roto.
- [x] 1.3 Añadir a `scripts/check-go-quality.sh` el escaneo de `//go:embed` en `apps/api/**/*.go` y la verificación con `git ls-files` de que el target resuelto está rastreado.
- [x] 1.4 Probar el chequeo de `go:embed` contra un caso roto: simular (en un dir temporal, sin tocar el repo real) un embed cuyo target no está en git, confirmar que el script lo detecta. Confirmado en un repo git aislado (scratchpad): directorio rastreado → OK, directorio no añadido → detectado correctamente.
- [x] 1.5 Ejecutar `scripts/check-go-quality.sh` contra el estado real de `apps/api` en este repo — debe pasar en verde (GREEN): confirma que no hay falsos positivos con el `gofmt`/CRLF ya conocido ni con los dos embeds reales (`internal/webui/dist`, `internal/migrate/migrations`). Confirmado: gofmt/go vet/go build/embed×2 en verde.
- [x] 1.6 Añadir el paso "Quality gates Go (apps/api)" a `STEP_NAMES`/`step_N` de `scripts/pre-commit.sh`, en la posición 4 (justo después de la auditoría de vulnerabilidades Go), renumerando los pasos siguientes.

## 2. Chequeo de plugins nativos Tauri JS↔Rust (D3)

- [x] 2.1 Crear `scripts/check-native-plugins.sh`: extrae `@tauri-apps/plugin-*` de `apps/mobile/package.json`, confirma `tauri-plugin-*` en `Cargo.toml` y `tauri_plugin_*` en `lib.rs` para cada uno.
- [x] 2.2 Probar contra un caso roto: quitar temporalmente (en memoria del script de prueba, sin tocar el repo real — usar copias en un scratch dir) una entrada de `Cargo.toml` y confirmar que el script la detecta. Confirmado con el caso real que motivó el chequeo (notification en package.json, ausente en Cargo.toml) — detectado correctamente, sql (sí registrado) pasa.
- [x] 2.3 Ejecutar `scripts/check-native-plugins.sh` contra el estado real del repo — debe pasar en verde (los 5 plugins JS actuales ya están todos registrados). Confirmado: 5/5 OK.
- [x] 2.4 Añadir el paso "Plugins nativos Tauri registrados (JS↔Rust)" a `scripts/pre-commit.sh`, en la posición 6 (tras ESLint).

## 3. Chequeo de Docker arrancado antes de Cypress (D7)

- [x] 3.1 Crear `scripts/check-docker-running.sh`: `docker compose -f infra/docker/docker-compose.yml ps --status running` filtrando por los servicios `api`/`postgres`, falla con mensaje explícito (incluye el comando exacto para levantarlos) si alguno no está `running`.
- [x] 3.2 Probar con Docker Desktop parado o los contenedores caídos — confirmar el mensaje de error explícito (RED). Confirmado con el estado real de la máquina al empezar esta tarea (Docker Desktop no estaba arrancado — el propio patrón que motivó este chequeo).
- [x] 3.3 Probar con `infra/docker/docker-compose.yml up -d` real — confirmar que pasa en verde (GREEN). Docker Desktop arrancado, `docker compose up -d` ejecutado, confirmado en verde.
- [x] 3.4 Añadir el paso "Comprobando Docker (API+Postgres arrancados)" a `scripts/pre-commit.sh`, justo antes de "Tests E2E (Cypress)" (posición 11 tras la renumeración).

## 4. Lock de pre-commit contra procesos concurrentes (D4)

- [x] 4.1 Editar `.husky/pre-commit`: crear `.git/precommit.lock/` con `mkdir` (atómico) antes de invocar `scripts/pre-commit.sh`, con `trap` que lo borra al salir (éxito, fallo o interrupción).
- [x] 4.2 Si `mkdir` falla porque el lock ya existe, abortar con mensaje explícito (ruta del lock, instrucción de borrarlo a mano si se confirma que no hay ningún pre-commit vivo).
- [x] 4.3 Probar el caso real que motivó esto: lanzar un `git commit` (con cambios que disparen la suite completa) y, mientras sigue corriendo, lanzar un segundo `git commit` en paralelo — confirmar que el segundo aborta de inmediato por el lock en vez de competir por el puerto 1420. Verificado con un arnés aislado que reproduce exactamente el mecanismo (`mkdir` + `trap`) sin pagar el coste de correr la suite pesada dos veces: proceso A adquiere el lock y tarda 4s, proceso B (lanzado 1s después) queda bloqueado de inmediato, A termina y libera el lock — sin residuo.
- [x] 4.4 Confirmar que un `git commit` normal (sin concurrencia) sigue funcionando igual que antes y que el lock desaparece al terminar. Verificado con el mismo arnés en modo single-run: lock adquirido, trabajo, lock borrado correctamente al terminar.

## 5. `scripts/tag-release.sh` (D5)

- [x] 5.1 Crear `scripts/tag-release.sh <tag>`: `git fetch origin master`, luego `git tag "<tag>" origin/master` y `git push origin "<tag>"`.
- [x] 5.2 Probar con un tag de prueba real (`v0.0.1-tag-release-script-test`, creado, verificado y borrado en local+remoto): apuntó exactamente al commit de `origin/master`. El script nunca lee `HEAD`/la rama actual en ningún punto (`TARGET_COMMIT=$(git rev-parse origin/master)`), así que el resultado es el mismo sea cual sea la rama o el commit local en el que se ejecute — verificado por inspección de código además de por la ejecución real.

## 6. `scripts/verify-prod-env.sh` (D6)

- [x] 6.1 Crear `scripts/verify-prod-env.sh <example> <real>`: compara nombres de clave (`grep -oE '^[A-Z_][A-Z0-9_]*='`) entre ambos ficheros, lista lo que falta en `<real>`, nunca imprime valores.
- [x] 6.2 Probar contra `infra/docker/.env.prod.example` y una copia local incompleta (en scratch dir, sin credenciales reales) — confirmar que detecta las claves que faltan. Probado quitando exactamente `ADMIN_STATUS_TOKEN`/`RESEND_WEBHOOK_SECRET` — las mismas dos claves del incidente real de v0.1.16 — detectadas correctamente.
- [x] 6.3 Probar contra `infra/docker/.env.prod.example` y una copia completa — confirmar que pasa en verde. Confirmado con valores dummy (nunca reales) para las mismas claves.
- [x] 6.4 No ejecutar este script contra el `.env.prod` real del servidor de producción en este cambio (fuera de alcance, decisión explícita) — dejar constancia de esto en el propio script (comentario) para quien lo use la primera vez de verdad.

## 7. Verificación end-to-end y cierre

- [x] 7.1 Ejecutar `bash scripts/pre-commit.sh` completo contra el estado real del repo (con Docker arrancado) — debe pasar en verde con los 3 pasos nuevos incluidos, confirmando que ningún paso existente se rompió por la renumeración. Primera corrida: 2 tests Vitest fallaron por timeout de 5s (`app-update-banner.spec.ts`, `photo-capture-adapter.service.spec.ts`, ninguno tocado por este cambio) — reproducido aparte con `npx vitest run --coverage --silent` en solitario: 1466/1466 en verde, confirmando flakiness por contención de recursos (Docker arrancando en paralelo), no una regresión real. Segunda corrida completa, de punta a punta sin interrupciones: **12/12 pasos en verde en 9m44s**, incluido Cypress 102/102.
- [x] 7.2 `chmod +x` en todos los scripts nuevos (o confirmar que ya son ejecutables) y revisar que `scripts/pre-commit.sh` los invoca con la ruta correcta. Los 5 scripts nuevos tenían modo `100644` en el índice de git (`core.fileMode=false` en esta máquina, así que `chmod` local no bastaba) — corregido a `100755` con `git update-index --chmod=+x` en los 5. Confirmado que `pre-commit.sh` invoca los 3 chequeos (`check-go-quality.sh`, `check-native-plugins.sh`, `check-docker-running.sh`) con `bash scripts/...` en los pasos 4, 6 y 11 — ruta correcta.
- [x] 7.3 Actualizar `memory/context.md` (Herramientas de Desarrollo o Quality Gates, según encaje mejor) con los scripts nuevos y cuándo usarlos — en particular `scripts/tag-release.sh` en vez de `git tag` manual para releases. Añadido a "Herramientas de Desarrollo".
- [x] 7.4 `openspec validate --change mejoras-proceso-sdlc --strict` (nombre real: `openspec validate mejoras-proceso-sdlc --strict`). `Change 'mejoras-proceso-sdlc' is valid`.
- [x] 7.5 `/opsx:archive` y PR de `feature/mejoras-proceso-sdlc` → `master`, revisando el diff completo antes de abrir la PR (ningún secreto real en los scripts ni en las pruebas). `review.md` (veredicto APPROVED) escrito antes de archivar. Archivado en `openspec/changes/archive/2026-08-29-mejoras-proceso-sdlc/`.
