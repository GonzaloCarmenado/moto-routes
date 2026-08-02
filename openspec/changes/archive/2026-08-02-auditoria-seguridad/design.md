## Context

Ver `proposal.md` → Why para la motivación completa. En resumen: el pre-commit real no audita dependencias pese a que `docs/06-seguridad.md` lo exige, `pnpm audit` ya reporta 10 vulnerabilidades (7 high) sin resolver, y `cargo audit` no está instalado. ADR-014 (`memory/decisions.md`) ya fijó el principio — este cambio lo verifica y lo hace exigible automáticamente en vez de solo documentado.

## Goals / Non-Goals

**Goals:**
- Que una vulnerabilidad `high`/`critical` nueva en frontend o Rust bloquee el commit, no solo se documente como política.
- Cerrar las 10 vulnerabilidades actuales de `pnpm audit` (o documentar por qué alguna se acepta).
- Dejar constancia automatizada (test de regresión) de que CSP y `capabilities/default.json` no se amplían sin querer.

**Non-Goals:**
- No se añade escaneo de secretos (secret scanning) ni SAST — ya cubierto a nivel de plataforma en GitHub (ver `docs/06-seguridad.md` §6) y fuera del alcance que pidió el usuario.
- No se toca la suite E2E de Cypress (confirmado con el usuario, ver proposal.md).
- No se audita el workflow de CI "Docs" (falla por un problema de infraestructura — falta `glib-2.0` en el runner — preexistente y ya conocido, sin relación con dependencias vulnerables).

## Decisions

### 1. `cargo-audit` se instala como herramienta de sistema, no como dependencia de `Cargo.toml`
`cargo-audit` es un subcomando de Cargo (`cargo install cargo-audit`), no aparece en `Cargo.toml`/`Cargo.lock` del proyecto — no aumenta la superficie de dependencias del binario final, solo el entorno de desarrollo/CI. No hay alternativa nativa: es la herramienta estándar del ecosistema Rust (RustSec) y ya está referenciada en `package.json` (`rust:audit`) y en `docs/06-seguridad.md`. Se instala solo tras confirmar con el usuario (regla del proyecto).

### 2. Vulnerabilidades de `pnpm audit`: bump directo donde se pueda, `pnpm-workspace.yaml` → `overrides` donde no
Las 10 vulnerabilidades actuales son transitivas de `vitepress`/`typedoc`/`typedoc-plugin-coverage` (que arrastran `vite`, `esbuild`, `postcss`, `brace-expansion` desactualizados). Ninguna toca el bundle que se sirve en producción (Android/Tauri) — son herramientas de build de documentación, no runtime. Aun así se resuelven porque `docs/06-seguridad.md` no distingue por ese motivo.
Estrategia: primero intentar `pnpm update` directo de los paquetes raíz afectados; si el fix solo existe en una versión transitiva que el padre no ha adoptado todavía, fijarlo con `overrides` en `pnpm-workspace.yaml` — mismo patrón ya usado con `postcss: 8.5.16` (ver `memory/context.md`, sesión `documentacion-codigo`). Alternativa descartada: ignorar las vulnerabilidades con `.npmrc` / `pnpm audit --ignore`, porque contradice la regla de bloquear en high/critical que este mismo cambio introduce.

### 3. El gate de auditoría se añade a `.husky/pre-commit` como dos pasos nuevos, replicando `docs/06-seguridad.md`
**Corrección durante `apply` (2026-08-02)**: el diseño original asumía que `cargo audit` acepta un umbral de severidad tipo `--deny high`, igual que `npm audit --audit-level`. No es así — `cargo audit --deny` solo acepta `warnings`, `unmaintained`, `unsound` o `yanked` (categorías de aviso, no severidades), y `high`/`critical` no son valores válidos. Sin ningún `--deny`, `cargo audit` **ya bloquea por defecto ante cualquier vulnerabilidad real** (exit code ≠ 0) y **no bloquea** ante avisos de `unmaintained`/`unsound`/`yanked` — que es exactamente el comportamiento que se buscaba, sin necesitar ningún flag de severidad.
`cargo audit` (ejecutado sobre `src-tauri/`) encontró **una vulnerabilidad real**: `rsa 0.9.10` (RUSTSEC-2023-0071, Marvin Attack, severidad media 5.9, **sin fix disponible**), arrastrada por `sqlx-mysql` — dependencia transitiva de `tauri-plugin-sql` pese a que este proyecto solo declara `features = ["sqlite"]`. La app nunca abre una conexión MySQL, así que la ruta de código vulnerable (autenticación `caching_sha2_password` de MySQL) nunca se ejecuta — es código muerto en el binario, no una vulnerabilidad explotable en este producto. Se ignora explícitamente con `--ignore RUSTSEC-2023-0071` y un comentario en el propio hook explicando el motivo, siguiendo la mitigación ya prevista en Riesgos.
```bash
pnpm audit --audit-level=high || exit 1
# RUSTSEC-2023-0071 (rsa, vía sqlx-mysql de tauri-plugin-sql): sin fix disponible,
# pero MySQL nunca se usa en runtime (solo SQLite) — código inalcanzable. Reevaluar
# si tauri-plugin-sql cambia de versión o si aparece un fix upstream.
(cd src-tauri && cargo audit --ignore RUSTSEC-2023-0071) || exit 1
```
Se colocan al principio del hook (fallan rápido, antes de gastar tiempo en tests/build). Alternativa descartada: un workflow de GitHub Actions dedicado — el proyecto ya tiene un único workflow (`Docs`) y la disciplina existente es que las verificaciones críticas viven en el pre-commit local, no solo en CI (ningún otro gate del proyecto — ESLint, Vitest, Clippy, cargo test, Cypress — vive solo en CI).

### 4. Tests de regresión de CSP y de la allowlist de permisos: se extiende `src/shared/http/`, no se crea `src/shared/security/`
**Corrección durante `apply`**: ya existe `src/shared/http/tauri-conf.spec.ts`, que establece exactamente el patrón necesario (lee `src-tauri/tauri.conf.json` desde disco con `readFileSync(resolve(process.cwd(), ...))`, sin depender de que el archivo esté en `test.include`) para verificar `connect-src` de la CSP. En vez de crear un dominio nuevo `src/shared/security/` desde cero (regla del proyecto: no duplicar estructura si ya hay un sitio natural), se añade:
- Un nuevo `describe` en el propio `tauri-conf.spec.ts`: ausencia de `unsafe-eval`/`unsafe-inline` en `script-src`, y comparación de esa misma CSP contra el meta tag de `index.html` (se lee también por `readFileSync`, mismo patrón).
- Un fichero nuevo hermano, `src/shared/http/capabilities-allowlist.spec.ts` (lee `src-tauri/capabilities/default.json` y compara su array `permissions` contra una lista explícita en el propio test).

Estos tests no cubren código de dominio — son de regresión de configuración, sin `.element`/`.service`/`.transform` porque no hay componente al que asociarlos, igual que el `tauri-conf.spec.ts` ya existente. `capabilities-allowlist.spec.ts` no es estrictamente "http", pero se prioriza mantener un único sitio conocido para "tests que leen configuración cruda de Tauri" antes que fragmentar en un directorio nuevo para dos ficheros.
Alternativa descartada: un script Node fuera de Vitest (`scripts/verify-security-config.mjs`) — se prefiere Vitest porque así corre automáticamente con `pnpm test`/pre-commit sin un paso extra que alguien pueda olvidar cablear.

### 5. Los 4 comandos Rust sin validar (`app_info`, `start/stop/pause/resume_foreground_service`) no necesitan cambios
Ninguno recibe un `String` o path de usuario — solo `tauri::AppHandle` (inyectado por el framework, no controlable desde el frontend). El requisito de validación de inputs de la spec se cumple ya vía los tests existentes de `save_file`/`greet`; se mantiene como test de regresión, no como trabajo nuevo.

## Risks / Trade-offs

- **[Riesgo] Actualizar `vite`/`vitepress` puede romper `pnpm run docs`** → Mitigación: tarea explícita de `pnpm run docs` + revisión visual tras cada bump, antes de dar el cambio por bueno (no basta con que `pnpm audit` quede limpio).
- **[Riesgo, ya materializado] `cargo audit` sin excepciones bloquea por RUSTSEC-2023-0071 (`rsa`, sin fix disponible)** → Mitigación aplicada: `--ignore RUSTSEC-2023-0071` con comentario en el hook explicando que es inalcanzable (MySQL nunca se usa en runtime). Revisar esta excepción si `tauri-plugin-sql` cambia de versión.
- **[Riesgo] `src/shared/security/` es nuevo, pero vive bajo `src/shared/` que consumen todos los dominios (cockpit, routes, profile)** → Mitigación real: radio de impacto nulo — son ficheros nuevos, de solo lectura de configuración, sin exports que ningún otro módulo importe; no modifican ningún componente compartido existente.
- **[Riesgo] El pre-commit ya es lento (ESLint + Vitest + Clippy + cargo test + Cypress); añadir dos auditorías de red (pnpm/cargo audit consultan bases de datos de advisories) lo alarga más y puede fallar por falta de red** → Mitigación: se colocan al principio para fallar rápido; es una limitación aceptada, coherente con que `docs/06-seguridad.md` ya lo pedía así desde antes de este cambio.
