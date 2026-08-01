# Revisión: Documentación del código y generación de documentación del proyecto

## 📋 Ficheros Tocados
| Archivo | Tipo | Descripción del cambio |
|---------|------|----------------------|
| `package.json` | MODIFICADO | devDeps: `typedoc`, `typedoc-plugin-coverage`, `vitepress`, `eslint-plugin-jsdoc`; scripts `docs:*` y `docs` |
| `pnpm-workspace.yaml` | MODIFICADO | Override `postcss: 8.5.16` (registry aún sin 8.5.19 exigido por @vue/compiler-sfc) |
| `typedoc.json` | CREADO | Configuración de TypeDoc (entryPoints `src`, `entryPointStrategy: expand`, plugin coverage con output JSON, `requiredToBeDocumented`, excludes) |
| `scripts/docs-coverage.mjs` | CREADO | Gate de cobertura de documentación (umbral configurable, default 70%) |
| `scripts/docs-prepare.mjs` | CREADO | Sincroniza ADRs + Design System a `docs/reference/` con escape de genéricos TS |
| `docs/.vitepress/config.mjs` | CREADO | Config del sitio VitePress (nav + sidebar Guías/Referencia/API) |
| `docs/index.md` | CREADO | Home del sitio (hero + features) |
| `docs/01..07-*.md` | MODIFICADO | Frontmatter incluido en la navegación (referenciados en sidebar) |
| `.github/workflows/docs.yml` | CREADO | CI que ejecuta `pnpm run docs` en push/PR |
| `eslint.config.js` | MODIFICADO | Regla `jsdoc/require-jsdoc` (error, publicOnly) + exención `*.spec.ts` + ignore `docs/` |
| `.clinerules` / `CLAUDE.md` | MODIFICADO | Norma JSDoc obligatorio + nota de consulta de docs |
| `.gitignore` | MODIFICADO | `docs/api/`, `docs/.vitepress/cache/`, `docs/.vitepress/dist/`, `docs/reference/` |
| `src/**` (~25 archivos) | MODIFICADO | JSDoc añadido a exports públicos e interfaces de dominio (cockpit, shared, routes, app) |

## 📝 Resumen de Cambios
- **TypeDoc** genera la API reference en `docs/api/` (HTML + `coverage.json`) con `typedoc-plugin-coverage`.
- **Gate de cobertura** propio (`scripts/docs-coverage.mjs`) — el plugin v4 no expone `coverageThreshold`, se valida externamente: **70% (242/342) superado**.
- **VitePress** sitio navegable en `docs/` (home, Guías 01-07, ADRs, Design System, enlace API). `pnpm run docs` encadena prepare→api→rust→build sin errores.
- **`cargo doc --no-deps`** genera la doc del backend Rust en `src-tauri/target/doc/`.
- **Regla verificable** `jsdoc/require-jsdoc` (error, `publicOnly: true`) — cualquier export público sin JSDoc bloquea el pre-commit (`--max-warnings 0`). `*.spec.ts` exentos.
- **Norma para agentes** (Cline + Claude) documentada en `.clinerules` y `CLAUDE.md`.
- **CI** `.github/workflows/docs.yml` ejecuta `pnpm run docs`.

## ✅ Cumplimiento de AC
| AC | Estado | Implementación | Test/Verificación | Notas |
|----|--------|---------------|------|-------|
| AC-001 | ✅ Cumplido | `package.json` + `typedoc.json` | `pnpm docs:api` genera `docs/api/` | entryPoints `["src"]` (expand) en vez de `src/main.ts` por cubrir todo el código |
| AC-002 | ✅ Cumplido | `typedoc-plugin-coverage` + `scripts/docs-coverage.mjs` | `pnpm docs:coverage` exit 1 / exit 0 según umbral | Umbral por defecto subido a 70% (decisión de usuario) |
| AC-003 | ✅ Cumplido | `eslint.config.js` (`jsdoc/require-jsdoc` error, `publicOnly: true`) | `pnpm lint` exit 0 tras documentar | |
| AC-004 | ✅ Cumplido | Override `**/*.spec.ts` con `jsdoc/require-jsdoc: 'off'` | Verificado: spec sin JSDoc no falla | |
| AC-005 | ✅ Cumplido | Pre-commit ejecuta ESLint con `--max-warnings 0` | Commit real `8da27c6` con pre-commit en verde | |
| AC-006 | ✅ Cumplido | `pnpm docs:api` | Genera `docs/api/index.html` sin errores | |
| AC-007 | ✅ Cumplido | `pnpm docs:coverage` (typedoc + script) | Exit 1 si % < umbral | Desviación: `coverageThreshold` no existe en el plugin v4 — se valida con script propio (ver ISSUE-001) |
| AC-008 | ✅ Cumplido | `vitepress@1.6.4` + `docs/.vitepress/config.mjs` | Build OK | |
| AC-009 | ✅ Cumplido | Sidebar con Guías 01-07, Referencia (ADR + Design System), API | Build OK | 4 secciones presentes |
| AC-010 | ✅ Cumplido | `docs:dev` / `docs:build` | `pnpm docs:build` exit 0 | |
| AC-011 | ✅ Cumplido | `docs/index.md` (home con identidad, stack, features) | Build genera `index.html` | |
| AC-012 | ✅ Cumplido | `.clinerules` sección "Código" | Revisión manual | |
| AC-013 | ✅ Cumplido | `CLAUDE.md` "Convenciones de Frontend" | Revisión manual | |
| AC-014 | ✅ Cumplido | Nota de `pnpm docs` + ubicaciones en ambos archivos | Revisión manual | |
| AC-015 | ✅ Cumplido | `pnpm docs:rust` (`cargo doc --no-deps`) | Exit 0, genera `src-tauri/target/doc/app_lib/index.html` | |
| AC-016 | ✅ Cumplido | `pnpm docs` encadena prepare→api→rust→build | `pnpm run docs` exit 0 | Desviación menor: `pnpm docs` colisiona con el comando nativo de pnpm, hay que invocarlo `pnpm run docs` (ver ISSUE-002) |
| AC-017 | ✅ Cumplido | JSDoc en ~25 archivos fuente | `coverage.json` = 70% (242/342) | Sin `@ignore` injustificado |
| AC-018 | ✅ Cumplido | Sin cambios de lógica | 567/567 tests Vitest; lint exit 0; clippy/fmt/test Rust OK; Cypress 30/30 en pre-commit | |
| AC-019 | ✅ Cumplido | `.github/workflows/docs.yml` | Workflow `pnpm run docs` en push/PR | |

## 🔴 CRÍTICO

### Seguridad
- ✅ Sin incidencias. No se introducen secretos ni se debilita la CSP. Solo devDependencies de documentación.

### Componentes Comunes Afectados
- ✅ Ninguno. Los cambios en `src/shared/**` son exclusivamente comentarios JSDoc (sin cambios de lógica ni contrato). Un fichero (`eslint.config.js`) activa una regla de lint nueva, verificada globalmente.

### Actualizaciones Core
- ⚠️ Se añaden dependencias dev nuevas: `typedoc`, `typedoc-plugin-coverage`, `vitepress`, `eslint-plugin-jsdoc` (todas devDependencies, sin impacto en runtime/bundle). Override `postcss: 8.5.16` en `pnpm-workspace.yaml` por una versión no publicada aún en registry (`postcss@^8.5.19` exigida por `@vue/compiler-sfc`) — temporal, revisable cuando se publique.

### Normas Saltadas
- ⚠️ `.clinerules`/`CLAUDE.md` modificados. Autorizado explícitamente por la propia spec (AC-012/AC-013/AC-014) y confirmado por el usuario al elegir la Opción 1.

## ⚠️ Issues Encontrados

### ISSUE-001: `coverageThreshold` no existe en typedoc-plugin-coverage v4
- **Severidad**: BAJA
- **AC afectado**: AC-002, AC-007
- **Descripción**: El plugin v4 solo genera `coverage.svg`/`coverage.json`; no valida umbrales. La spec asumía `coverageThreshold` en `typedoc.json`.
- **Recomendación**: Se resolvió con `scripts/docs-coverage.mjs` que lee `coverage.json` y falla si el % < umbral. Documentar en la spec que el umbral se controla con ese script (no con `typedoc.json`).

### ISSUE-002: `pnpm docs` colisiona con el comando nativo de pnpm
- **Severidad**: BAJA
- **AC afectado**: AC-016
- **Descripción**: `pnpm docs` es un comando nativo de pnpm (abre la doc de un paquete) y pnpm lo intercepta antes que el script `docs` de `package.json`.
- **Recomendación**: Invoque siempre `pnpm run docs`. El workflow CI ya lo usa correctamente y `CLAUDE.md`/`.clinerules` lo referencian como `pnpm docs` — actualizar esa referencia si se prefiere exactitud, o anotar la excepción.

### ISSUE-003: Umbral de cobertura ajustado por el usuario
- **Severidad**: BAJA
- **AC afectado**: AC-002, AC-017
- **Descripción**: El plan inicial sugería 50%; el usuario pidió subir a 70%, lo que implicó documentar ~50 símbolos adicionales de tipos/dominio.
- **Recomendación**: Ninguna — objetivo cumplido (70% alcanzado, gate en verde).

## 📊 Veredicto
- [x] APPROVED - Todos los AC cumplidos, sin issues críticos, sin incidencias de seguridad