## Purpose

Garantizar que el árbol de dependencias, la CSP, los permisos de Tauri y los inputs de los comandos Rust expuestos por IPC se mantienen dentro de los límites de seguridad mínimos definidos en ADR-014, y que una regresión en cualquiera de ellos se detecta automáticamente antes de llegar a `main`.

## Requirements

### Requirement: Auditoría de vulnerabilidades de dependencias bloquea el commit
El pre-commit SHALL ejecutar una auditoría de vulnerabilidades conocidas sobre las dependencias de frontend (pnpm) y de backend (Cargo). En frontend SHALL bloquear el commit ante cualquier vulnerabilidad `high` o `critical` sin resolver ni justificar explícitamente. En backend SHALL bloquear ante cualquier vulnerabilidad real reportada por `cargo audit` que no esté explícitamente ignorada por su ID de advisory con justificación documentada (`cargo audit` no distingue niveles de severidad como `npm audit`; por defecto ya bloquea en cualquier vulnerabilidad real y no bloquea en avisos de `unmaintained`/`unsound`/`yanked`).

#### Scenario: El commit se bloquea si hay una vulnerabilidad frontend de severidad alta
- **WHEN** `pnpm audit --audit-level=high` reporta al menos una vulnerabilidad `high` o `critical` en el árbol de dependencias
- **THEN** el hook de pre-commit termina con código de salida distinto de cero y el commit no se completa

#### Scenario: El commit se bloquea si aparece una vulnerabilidad de Rust nueva y no justificada
- **WHEN** `cargo audit` reporta al menos una vulnerabilidad real en `Cargo.lock` cuyo ID no está en la lista de excepciones documentadas del hook
- **THEN** el hook de pre-commit termina con código de salida distinto de cero y el commit no se completa
- **Nota de verificación**: este escenario se valida ejecutando `cargo audit` real (no hay equivalente Vitest/Cypress para el árbol de dependencias de Rust), igual que el resto de la disciplina Rust del proyecto (`cargo test`, `cargo clippy`).

#### Scenario: El commit no se bloquea por vulnerabilidades frontend de severidad moderada o baja
- **WHEN** `pnpm audit` solo reporta vulnerabilidades `moderate` o `low`
- **THEN** el hook de pre-commit muestra un aviso pero termina con código de salida cero y el commit se completa

#### Scenario: El commit no se bloquea por una vulnerabilidad de Rust explícitamente ignorada y justificada
- **WHEN** `cargo audit` solo reporta vulnerabilidades cuyo ID está en la lista de excepciones documentadas del hook (p. ej. `RUSTSEC-2023-0071`, sin fix disponible y código inalcanzable en runtime)
- **THEN** el hook de pre-commit termina con código de salida cero y el commit se completa

### Requirement: La CSP de producción permanece mínima y sincronizada entre sus dos fuentes
`tauri.conf.json` (`app.security.csp`) e `index.html` (meta tag) SHALL declarar exactamente la misma política, y esa política SHALL seguir sin `unsafe-eval` ni `unsafe-inline` en `script-src`.

#### Scenario: La CSP de tauri.conf.json y la de index.html son idénticas
- **WHEN** se comparan el valor de `app.security.csp` en `tauri.conf.json` y el contenido del meta tag `Content-Security-Policy` en `index.html`
- **THEN** ambos strings son exactamente iguales

#### Scenario: script-src no permite unsafe-eval ni unsafe-inline
- **WHEN** se inspecciona la directiva `script-src` de la CSP vigente
- **THEN** no contiene `unsafe-eval` ni `unsafe-inline`

### Requirement: Los permisos de Tauri (capabilities) se mantienen en una lista explícita y mínima
`src-tauri/capabilities/default.json` SHALL declarar únicamente los permisos necesarios para las funcionalidades existentes (SQLite, fotos en `$APPDATA/photos/**`, ventana), y cualquier permiso añadido fuera de esa lista SHALL requerir actualizar deliberadamente el test de regresión que la verifica.

#### Scenario: La lista de permisos no crece sin que un test lo detecte
- **WHEN** se compara el array `permissions` de `capabilities/default.json` contra la lista explícita conocida en el test de regresión
- **THEN** el test falla si aparece cualquier permiso no incluido en esa lista, obligando a revisar y actualizar el test a propósito

### Requirement: Los comandos Rust expuestos por IPC validan sus inputs
Todo comando Tauri (`#[tauri::command]`) que reciba una ruta de archivo o una cadena de texto de usuario SHALL rechazar rutas absolutas, rutas con `..` (path traversal) y contenido vacío cuando ese campo sea obligatorio.

#### Scenario: save_file rechaza una ruta absoluta
- **WHEN** se invoca `save_file` con una ruta absoluta (p. ej. `C:\tmp\x.txt` o `/tmp/x.txt`)
- **THEN** el comando devuelve un error y no escribe ningún archivo
- **Nota de verificación**: cubierto por `cargo test` (`save_file_rejects_absolute_path`, ya existente en `src-tauri/src/commands/mod.rs`).

#### Scenario: save_file rechaza un intento de path traversal
- **WHEN** se invoca `save_file` con una ruta que contiene `..` (p. ej. `../escape.txt`)
- **THEN** el comando devuelve un error y no escribe ningún archivo
- **Nota de verificación**: cubierto por `cargo test` (`save_file_rejects_path_traversal`, ya existente).

#### Scenario: save_file rechaza contenido vacío
- **WHEN** se invoca `save_file` con `content` vacío
- **THEN** el comando devuelve un error
- **Nota de verificación**: cubierto por `cargo test` (`save_file_rejects_empty_content`, ya existente).

#### Scenario: greet rechaza un nombre vacío
- **WHEN** se invoca `greet` con un nombre vacío o solo espacios
- **THEN** el comando devuelve un error
- **Nota de verificación**: cubierto por `cargo test` (`greet_rejects_empty_name`, ya existente).
