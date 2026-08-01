# Plan de Implementación: Documentación del código y generación de documentación del proyecto

## Resumen de Tareas

| # | Tarea | Archivos | AC Cubiertos | Complejidad |
|---|-------|----------|--------------|-------------|
| 1 | Instalar dependencias de documentación + scripts npm | `package.json`, `pnpm-lock.yaml` | AC-001, AC-002, AC-008 | Small |
| 2 | Configurar TypeDoc + typedoc-plugin-coverage | `typedoc.json` (nuevo), `package.json` | AC-001, AC-002, AC-006, AC-007 | Small |
| 3 | Configurar sitio VitePress (estructura, home, guías) | `docs/.vitepress/config.ts`, frontmatter en `docs/01-*.md`…`07-*.md`, `docs/index.md` | AC-008, AC-009, AC-010, AC-011 | Medium |
| 4 | Integrar ADRs y Design System en el sitio (referencia, no duplicación) | `docs/.vitepress/`, script `docs:prepare` (nuevo) | AC-009, AC-014 | Small |
| 5 | Añadir JSDoc a `src/shared/` (utils, models, base-element, app-events, tauri) | ~10 archivos fuente | AC-017 (base) | Medium |
| 6 | Añadir JSDoc a `src/shared/services/` y `src/shared/repositories/` | ~12 archivos fuente | AC-017 (base) | Medium |
| 7 | Añadir JSDoc a componentes compartidos (`feedback`, `photo-*`, `route-map`, `tab-bar`) | ~8 archivos fuente | AC-017 (base) | Medium |
| 8 | Añadir JSDoc a `src/cockpit/` | ~12 archivos fuente | AC-017 (base) | Medium |
| 9 | Añadir JSDoc a `src/routes/` y `src/app/` | ~10 archivos fuente | AC-017 (base) | Medium |
| 10 | Activar `eslint-plugin-jsdoc` como regla estricta (error) | `eslint.config.js` | AC-003, AC-004, AC-005, AC-018 | Small |
| 11 | Actualizar normas de agentes (`.clinerules`, `CLAUDE.md`) | `.clinerules`, `CLAUDE.md` | AC-012, AC-013, AC-014 | Small |
| 12 | Backend Rust: script `docs:rust` + script agregado `docs` | `package.json` | AC-015, AC-016 | Small |
| 13 | Validación final (docs:coverage > umbral, lint, tests, clippy, docs:build) | varios | AC-017, AC-018, AC-019 | Medium |

> **Nota de diseño**: Este plan NO activa la regla `jsdoc/require-jsdoc` al principio. El estado actual del código tiene casi ningún export con JSDoc; si se activara antes de documentar, el pre-commit (`npx eslint src/ --max-warnings 0`) rompería en el primer commit. La estrategia es: (1) documentar todo con JSDoc en los pasos 5-9, (2) activar la regla como `error` en el paso 10 —momento en el que `pnpm lint` ya debe pasar—, y (3) el pre-commit queda blindado a partir de entonces.

> **Nota sobre tests en esta feature**: Al ser una feature de documentación/infraestructura, los "tests a escribir" son verificaciones de build y lint (ejecutar scripts sin errores, `pnpm lint` sin warnings, `docs:coverage` superando umbral). No hay tests unitarios nuevos en el sentido clásico, pero cada paso incluye verificación ejecutable. El paso final (13) ejecuta la suite completa para garantizar AC-018 (sin regresiones).

---

## Paso 1: Instalar dependencias de documentación + scripts npm

- **Objetivo**: Tener instaladas las devDependencies necesarias (TypeDoc, typedoc-plugin-coverage, VitePress, eslint-plugin-jsdoc) y los scripts npm `docs:api`, `docs:coverage`, `docs:dev`, `docs:build`, `docs:rust`, `docs:prepare` y `docs`.
- **AC cubiertos**: AC-001, AC-002, AC-008 (parciales — la configuración real llega en pasos siguientes)
- **Tests a escribir / verificaciones**:
  - Verificación: `pnpm ls typedoc typedoc-plugin-coverage vitepress eslint-plugin-jsdoc` lista las 4 dependencias en devDependencies → valida instalación
- **Archivos a crear/modificar**:
  - `MODIFICAR package.json` (devDependencies + scripts nuevos)
  - `MODIFICAR pnpm-lock.yaml` (generado por `pnpm add`)
- **Notas**:
  - Comando: `pnpm add -D typedoc typedoc-plugin-coverage vitepress eslint-plugin-jsdoc`
  - Los scripts se añaden vacíos/apuntados (los detalles de flags en pasos 2-4 y 12):
    - `"docs:api": "typedoc"`, `"docs:coverage": "typedoc --plugin typedoc-plugin-coverage"` (placeholder hasta paso 2)
    - `"docs:dev": "vitepress dev docs"`, `"docs:build": "vitepress build docs"` (placeholder hasta pasos 3-4)
    - `"docs:prepare": "node scripts/docs-prepare.mjs"` (script creado en paso 4)
    - `"docs:rust": "cd src-tauri && cargo doc --no-deps"` (paso 12)
    - `"docs": "pnpm docs:prepare && pnpm docs:api && pnpm docs:rust && pnpm docs:build"` (paso 12)
  - No hay tests unitarios que escribir aquí — es infraestructura.

## Paso 2: Configurar TypeDoc + typedoc-plugin-coverage

- **Objetivo**: TypeDoc genera la API reference del código TS (`src/main.ts` como entry point) y `typedoc-plugin-coverage` mide el % de símbolos exportados documentados con umbral configurable.
- **AC cubiertos**: AC-001, AC-002, AC-006, AC-007
- **Tests a escribir / verificaciones**:
  - Verificación: `pnpm docs:api` genera `docs/api/index.html` sin errores ni warnings → valida AC-001, AC-006
  - Verificación: `pnpm docs:coverage` imprime el % de cobertura y sale con código 0 (el umbral inicial se fija bajo para no romper aún) → valida AC-002, AC-007
- **Archivos a crear/modificar**:
  - `CREAR typedoc.json` (configuración raíz)
  - `MODIFICAR package.json` (script `docs:api` y `docs:coverage` definitivos)
  - `CREAR docs/api/.gitignore` (la API reference generada no se commitea — es artefacto de build)
- **Notas**:
  - `typedoc.json`: `{ "entryPoints": ["src/main.ts"], "out": "docs/api", "plugin": ["typedoc-plugin-coverage"], "coverageLabel": "Doc coverage", "coverageThreshold": 50, "excludeExternals": true, "excludePrivate": true, "excludeProtected": true, "skipErrorChecking": true }`
  - `excludeExternals` descarta `src/vite-env.d.ts` y stubs de `__mocks__`/`tauri-plugins` automáticamente (no son nuestro código).
  - `excludePrivate`/`excludeProtected` excluyen miembros privados/protegidos — solo se documentan exports públicos (alineado con la spec).
  - El umbral inicial es 50% (bajo, porque aún no se ha documentado nada). Se sube al final (paso 13) cuando la cobertura real sea mayor.
  - `docs/api/` se añade a `.gitignore` — es output generado, no fuente (regla del proyecto: no commitear generados).

## Paso 3: Configurar sitio VitePress (estructura, home, guías)

- **Objetivo**: El sitio navegable de VitePress existe, con la home del proyecto y las guías existentes (`docs/01-*.md`…`07-*.md`) como secciones navegables.
- **AC cubiertos**: AC-008, AC-009, AC-010, AC-011
- **Tests a escribir / verificaciones**:
  - Verificación: `pnpm docs:dev` arranca el servidor en `http://localhost:<puerto>` sin errores → valida AC-010 (parcial)
  - Verificación: `pnpm docs:build` genera `docs/.vitepress/dist/` sin errores → valida AC-010 (definitivo)
  - Verificación: la home (`docs/index.md`) contiene identidad, stack y quality gates → valida AC-011
  - Verificación: la barra lateral (`config.ts`) lista las 7 guías 01-07 → valida AC-009 (parcial)
- **Archivos a crear/modificar**:
  - `CREAR docs/.vitepress/config.ts`
  - `CREAR docs/index.md` (home)
  - `MODIFICAR docs/01-arquitectura-sdd.md` … `docs/07-cypress-e2e.md` (añadir frontmatter YAML mínimo: `title`, `description`)
- **Notas**:
  - `config.ts` con `base: '/'` (o `'/moto-routes/'` si el deploy final es gh-pages — configurable), `title: 'Moto Routes'`, `themeConfig.sidebar` con las guías.
  - Hay que añadir frontmatter a los 7 docs existentes — es un cambio de formato, no de contenido. No duplicar el contenido.
  - `docs/.vitepress/` debe añadirse al `include` de `tsconfig.json` si se usa `defineConfig` con TS (alternativa: `config.mjs` JS puro para no tocar tsconfig). Recomendado: usar `vitepress/config.ts` y añadir `docs/.vitepress/**` a `tsconfig` solo si `tsc` lo exige. Si complica, usar `docs/.vitepress/config.mjs`.

## Paso 4: Integrar ADRs y Design System en el sitio (referencia, no duplicación)

- **Objetivo**: El sitio incluye las secciones "ADRs" (desde `memory/decisions.md`) y "Design System" (desde `specs/ui/design-system.md`) sin duplicar contenido en el repo.
- **AC cubiertos**: AC-009, AC-014 (este último parcial — la nota para agentes se completa en paso 11)
- **Tests a escribir / verificaciones**:
  - Verificación: `pnpm docs:prepare` copia `memory/decisions.md` → `docs/reference/adr.md` y `specs/ui/design-system.md` → `docs/reference/design-system.md` → valida AC-009
  - Verificación: tras `pnpm docs:build`, existen las páginas `/reference/adr.html` y `/reference/design-system.html` → valida AC-009
- **Archivos a crear/modificar**:
  - `CREAR scripts/docs-prepare.mjs` (copia sincronizada con `fs.copyFileSync`)
  - `MODIFICAR docs/.vitepress/config.ts` (añadir secciones "Referencia" al sidebar con ADR y Design System)
  - `CREAR docs/reference/.gitignore` (los archivos copiados no se commitean — son artifact de build)
- **Notas**:
  - Principio del proyecto (docs/04-token-management.md): "Preferir documentos atómicos y referencias sobre duplicación". Por eso NO se copian manualmente al repo: el script `docs:prepare` los sincroniza en `docs/reference/` **solo en build**. `docs/reference/` se añade a `.gitignore`.
  - `scripts/docs-prepare.mjs` usa `fs.mkdirSync(dir, { recursive: true })` + `fs.copyFileSync` — sin dependencias externas.

## Paso 5: Añadir JSDoc a `src/shared/` (utils, models, base-element, app-events, tauri)

- **Objetivo**: Todos los exports públicos de `src/shared/utils/`, `src/shared/models/`, `src/shared/base-element.ts`, `src/shared/app-events.ts`, `src/shared/tauri/` y `src/shared/tauri-plugins/` tienen JSDoc conciso (qué/porqué).
- **AC cubiertos**: AC-017 (base)
- **Tests a escribir / verificaciones**:
  - Verificación: `pnpm docs:coverage` sube el % de cobertura respecto al paso 2 (medir antes/después) → valida AC-017 progresivo
  - Verificación: `pnpm lint` sigue pasando (0 warnings — no se añadió la regla aún, no debe romper)
- **Archivos a crear/modificar**:
  - `MODIFICAR src/shared/utils/*.ts` (date, errors, format, geo, route-naming)
  - `MODIFICAR src/shared/models/*.ts` (solo si exportan tipos/funciones — los contratos puros pueden necesitar `@interface`/`@property` si TypeDoc los cuenta)
  - `MODIFICAR src/shared/base-element.ts`, `src/shared/app-events.ts`
  - `MODIFICAR src/shared/tauri/commands.ts`, `src/shared/tauri-plugins/*.ts`
- **Notas**:
  - JSDoc conciso: 1-2 líneas. Ej: `/** Calcula la distancia haversine entre dos puntos. */` — no documentar el cómo.
  - Los types/interfaces puros bajo `shared/models/` están excluidos del coverage de Vitest, pero **no** del de TypeDoc — revisar con `docs:coverage` cómo los cuenta y documentar si es necesario.
  - Excluir del gate los stubs `tauri-plugins/plugin-camera.ts` y `plugin-dialog.ts` si causan ruido (son mocks) — verificar y decidir en este paso; si se excluyen, documentarlo aquí.

## Paso 6: Añadir JSDoc a `src/shared/services/` y `src/shared/repositories/`

- **Objetivo**: Todos los exports públicos de `src/shared/services/` (photo-*, route-*, etc.) y `src/shared/repositories/` (sqlite-*, memory-*) tienen JSDoc.
- **AC cubiertos**: AC-017 (base)
- **Tests a escribir / verificaciones**:
  - Verificación: `pnpm docs:coverage` sube el % respecto al paso 5
  - Verificación: `pnpm lint` sigue pasando
- **Archivos a crear/modificar**:
  - `MODIFICAR src/shared/services/*.ts` (~10 archivos: photo-capture-adapter, photo-delete, photo-persist, photo-storage, photo-geolocation, route-deletion, route-polyline, etc.)
  - `MODIFICAR src/shared/repositories/*.ts` (sqlite-route, sqlite-photo, memory-route, memory-photo, factories)
- **Notas**:
  - Los services son el grueso de la lógica — el JSDoc debe capturar la **responsabilidad** del service, no listar sus métodos.
  - Las interfaces de repositorio (`IRouteRepository`, `IPhotoRepository`) ya tienen contratos — el JSDoc de los métodos implementados puede ser breve.

## Paso 7: Añadir JSDoc a componentes compartidos (`feedback`, `photo-*`, `route-map`, `tab-bar`)

- **Objetivo**: Los Web Components compartidos (`confirm-dialog`, `toast`, `photo-capture`, `photo-gallery`, `photo-viewer`, `route-map`, `tab-bar`, `nav-bar`, `counter`) tienen JSDoc en sus clases y métodos públicos.
- **AC cubiertos**: AC-017 (base)
- **Tests a escribir / verificaciones**:
  - Verificación: `pnpm docs:coverage` sube el % respecto al paso 6
  - Verificación: `pnpm lint` sigue pasando
- **Archivos a crear/modificar**:
  - `MODIFICAR src/shared/feedback/*.element.ts` (confirm-dialog, toast)
  - `MODIFICAR src/shared/photo-capture/*.ts`, `src/shared/photo-gallery/*.ts`, `src/shared/photo-viewer/*.ts`
  - `MODIFICAR src/shared/route-map/*.ts` (element, transform, photos, contrast, fullscreen)
  - `MODIFICAR src/shared/tab-bar/*.ts`, `src/components/nav-bar/*.ts`, `src/components/counter/*.ts`
- **Notas**:
  - En Web Components, el `render()` público y el `connectedCallback()`/`disconnectedCallback()` heredados de `HTMLElement` no necesitan JSDoc extenso (el lifecycle es estándar) — TypeDoc los excluye con `excludeProtected`/`excludePrivate` si no son públicos.
  - Documentar el **contrato del componente**: qué atributos/propiedades expone (`disabled`, `limitReached`, etc.) y qué evento de navegación despacha (si aplica `app-events.ts`).

## Paso 8: Añadir JSDoc a `src/cockpit/`

- **Objetivo**: Todos los exports públicos del dominio `cockpit` (element, service, transform, render, gps, persist, photo, stop, long-press, save-route-dialog) tienen JSDoc.
- **AC cubiertos**: AC-017 (base)
- **Tests a escribir / verificaciones**:
  - Verificación: `pnpm docs:coverage` sube el % respecto al paso 7
  - Verificación: `pnpm lint` sigue pasando
- **Archivos a crear/modificar**:
  - `MODIFICAR src/cockpit/cockpit.element.ts`, `cockpit.service.ts`, `cockpit.transform.ts`, `cockpit.render.ts`, `cockpit.types.ts`
  - `MODIFICAR src/cockpit/gps/*.ts`, `src/cockpit/persist/*.ts`, `src/cockpit/photo/*.ts`, `src/cockpit/stop/*.ts`, `src/cockpit/long-press/*.ts`, `src/cockpit/save-route-dialog/*.ts`
- **Notas**:
  - `cockpit.element.ts` es el componente más complejo (~300+ líneas) — documentar las responsabilidades principales (grabación, pausa, long-press para parar, gestión del diálogo de guardado) una sola vez en la doc de la clase, no en cada método.
  - El JSDoc del service debe reflejar el flujo de parada en 3 pasos (`prepareStop`→`confirmSaveRecording`|`discardStop`) de ADR-023 — es un contrato que otros desarrolladores/agentes necesitan entender.

## Paso 9: Añadir JSDoc a `src/routes/` y `src/app/`

- **Objetivo**: Todos los exports públicos de `src/routes/` (list, detail) y `src/app/` (app.element, app-seed.*) tienen JSDoc.
- **AC cubiertos**: AC-017 (base)
- **Tests a escribir / verificaciones**:
  - Verificación: `pnpm docs:coverage` sube el % respecto al paso 8 (objetivo: > 70% real)
  - Verificación: `pnpm lint` pasa y `pnpm test` sin regresiones (567+ tests)
- **Archivos a crear/modificar**:
  - `MODIFICAR src/routes/list/*.ts`, `src/routes/detail/*.ts`
  - `MODIFICAR src/app/app.element.ts`, `src/app/app-seed.service.ts`, `app-seed.transform.ts`, `app-seed.types.ts`
- **Notas**:
  - `app-seed.*` ya tiene JSDoc parcial (del feature `cobertura-e2e`) — revisar y completar si falta.
  - `route-detail.element.ts` es el otro componente grande (400 líneas) — misma estrategia que cockpit: documentar la clase una vez, brevemente en métodos.

## Paso 10: Activar `eslint-plugin-jsdoc` como regla estricta (error)

- **Objetivo**: El lint falla (y por tanto el pre-commit) si un export público de producción no tiene JSDoc. Los `*.spec.ts` quedan exentos.
- **AC cubiertos**: AC-003, AC-004, AC-005, AC-018
- **Tests a escribir / verificaciones**:
  - Verificación: `pnpm lint` pasa con 0 errores y 0 warnings tras activar la regla → valida AC-003, AC-005 (los pasos 5-9 ya documentaron todo)
  - Verificación: crear temporalmente un export sin JSDoc en un archivo de prueba y confirmar que `pnpm lint` falla con `jsdoc/require-jsdoc`; revertirlo → valida la regla funciona
  - Verificación: confirmar que un `*.spec.ts` sin JSDoc NO falla → valida AC-004
- **Archivos a crear/modificar**:
  - `MODIFICAR eslint.config.js` (añadir el plugin, la regla y el override para specs)
- **Notas**:
  - Configuración en flat config:
    ```js
    import jsdoc from 'eslint-plugin-jsdoc';
    // en la config principal:
    plugins: { jsdoc },
    rules: { 'jsdoc/require-jsdoc': ['error', { publicOnly: true, require: { ArrowFunctionExpression: false, ClassDeclaration: true, ClassExpression: true, FunctionDeclaration: true, MethodDefinition: false } }] }
    ```
  - `publicOnly: true` usa `@public` en JSDoc o `export` real. Como nuestro código usa `export` real en todos los servicios, se detectan correctamente.
  - `MethodDefinition: false` — no exigir JSDoc en cada método (reducir ruido; la clase ya está documentada). Si el review lo pide más estricto, se sube después.
  - En el override existente de `**/*.spec.ts`, añadir `'jsdoc/require-jsdoc': 'off'` → valida AC-004.
  - El pre-commit NO necesita cambios: ya ejecuta `npx eslint src/ --max-warnings 0`.
  - Este es el paso de "blindaje": a partir de aquí los agentes están obligados de facto.

## Paso 11: Actualizar normas de agentes (`.clinerules`, `CLAUDE.md`)

- **Objetivo**: Cline y Claude conocen la norma verificable de JSDoc y saben dónde está la documentación generada.
- **AC cubiertos**: AC-012, AC-013, AC-014
- **Tests a escribir / verificaciones**:
  - Verificación manual por el implementador: `.clinerules` sección "Código" contiene la norma de JSDoc → valida AC-012
  - Verificación manual: `CLAUDE.md` sección "Convenciones de Frontend" contiene la misma norma → valida AC-013
  - Verificación manual: ambos contienen la nota de `pnpm docs:build` / consulta de docs antes de implementar → valida AC-014
- **Archivos a crear/modificar**:
  - `MODIFICAR .clinerules` (sección "Código" + nota en "Convenciones de Frontend")
  - `MODIFICAR CLAUDE.md` (sección "Convenciones de Frontend" + nota de docs)
- **Notas**:
  - Texto propuesto para `.clinerules`/`CLAUDE.md`:
    > "Todo símbolo exportado (clase, función, constante, tipo) debe tener JSDoc conciso (qué/porqué, no cómo) — el pre-commit lo verifica con `eslint-plugin-jsdoc` (`publicOnly: true`). Archivos `*.spec.ts` exentos."
  - Nota de docs generadas:
    > "La documentación del proyecto se genera con `pnpm docs` (VitePress en `docs/`, API reference en `docs/api/`, Rust en `src-tauri/target/doc/`). Consúltala antes de implementar."
  - ⚠️ Esto modifica `.clinerules` y `CLAUDE.md` — según las reglas del proyecto requiere avisar/confirmar (la spec AC-012/AC-013 ya lo autorizan explícitamente, que es la autorización de esta feature).

## Paso 12: Backend Rust: script `docs:rust` + script agregado `docs`

- **Objetivo**: `cargo doc --no-deps` genera la documentación del backend Rust, y `pnpm docs` ejecuta toda la cadena de documentación.
- **AC cubiertos**: AC-015, AC-016
- **Tests a escribir / verificaciones**:
  - Verificación: `pnpm docs:rust` ejecuta `cargo doc --no-deps` en `src-tauri/` sin errores ni warnings → valida AC-015
  - Verificación: `pnpm docs` ejecuta prepare → api → rust → build, todo sin errores → valida AC-016
- **Archivos a crear/modificar**:
  - `MODIFICAR package.json` (script `docs:rust` y script agregado `docs` definitivos)
- **Notas**:
  - `cargo doc --no-deps` evita documentar dependencias (más rápido, enfocado a nuestro código).
  - Orden del script agregado: `pnpm docs:prepare && pnpm docs:api && pnpm docs:rust && pnpm docs:build`.
  - La doc Rust genera en `src-tauri/target/doc/` — ya cubierto por `.gitignore` (target/).

## Paso 13: Validación final

- **Objetivo**: La feature cumple todos los AC, sin regresiones, y la cobertura de documentación supera el umbral.
- **AC cubiertos**: AC-017, AC-018, AC-019
- **Tests a escribir / verificaciones**:
  - Verificación: `pnpm docs:coverage` muestra cobertura real > 50% (subir el umbral en `typedoc.json` al valor real alcanzado) → valida AC-002 (umbral ajustado), AC-017
  - Verificación: `pnpm lint` → 0 errores, 0 warnings → valida AC-018
  - Verificación: `pnpm test` → 567+ tests pasan → valida AC-018
  - Verificación: `pnpm rust:lint`, `pnpm rust:format`, `pnpm rust:test` → sin errores → valida AC-018
  - Verificación: `pnpm docs:build` y `pnpm docs:api` sin errores → valida AC-019
  - Verificación: commit real disparando el pre-commit completo (incluye Cypress 30 tests) → valida AC-005 end-to-end y AC-018
- **Archivos a crear/modificar**:
  - `MODIFICAR typedoc.json` (subir `coverageThreshold` al valor real alcanzado)
  - `CREAR .github/workflows/docs.yml` (workflow CI que ejecuta `pnpm docs:build` y `pnpm docs:api`) → valida AC-019
- **Notas**:
  - Si la cobertura real quedara por debajo del 50% inicial (improbable tras pasos 5-9, pero posible por cómo TypeDoc cuenta interfaces), se documentan las exclusiones justificadas (stubs `tauri-plugins`, `vite-env.d.ts`) en la spec y se ajusta el umbral informado.
  - El workflow de CI es un script de ejemplo (AC-019 lo pide como "script de ejemplo") — puede activarse o dejarse descomentado según se quiera.
  - Invocar `review-agent` al final (regla del proyecto: un feature no se cierra sin APPROVED).