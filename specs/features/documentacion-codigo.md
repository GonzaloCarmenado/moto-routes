# Feature: Documentación del código y generación de documentación del proyecto

## Descripción
El proyecto no tiene documentación del código: no hay normas que obliguen a Cline o Claude a documentar el código que escriben, ni un generador de documentación navegable. Esta feature instala TypeDoc + VitePress + eslint-plugin-jsdoc, establece normas verificables (el JSDoc es obligatorio en exports públicos y el commit falla si la cobertura de documentación baja del umbral), y genera la documentación completa del proyecto (guías, ADRs, design system y API reference del código).

## Criterios de Aceptación

### Documentación del código (TS)
- [ ] AC-001: Se instala `typedoc` como devDependency con el entry point `src/index.ts` o `src/main.ts`.
- [ ] AC-002: Se instala `typedoc-plugin-coverage` y se configura un umbral de cobertura de documentación (por defecto: 50% de símbolos exportados documentados, configurable).
- [ ] AC-003: Se instala `eslint-plugin-jsdoc` y se configura `jsdoc/require-jsdoc` para **exports públicos** (funciones/constantes exportadas y clases con visibility pública) con `publicOnly: true`, `require: { FunctionDeclaration: true, ClassDeclaration: true, MethodDefinition: true }`.
- [ ] AC-004: La regla `jsdoc/require-jsdoc` no se aplica a archivos `*.spec.ts` (los tests no requieren JSDoc).
- [ ] AC-005: La regla `jsdoc/require-jsdoc` falla el commit en el pre-commit de Husky si algún export público no tiene JSDoc (ESLint ya ejecuta `--max-warnings 0`).
- [ ] AC-006: El script `pnpm docs:api` genera la API reference HTML con TypeDoc sin errores y sin warnings.
- [ ] AC-007: El script `pnpm docs:coverage` muestra el % de cobertura de documentación y sale con código de error 1 si baja del umbral configurado.

### Documentación del proyecto (VitePress)
- [ ] AC-008: Se instala `vitepress` como devDependency y se crea el sitio bajo `docs/` (ya existente) o `vitepress/` si es necesario.
- [ ] AC-009: El sitio de VitePress incluye al menos 4 secciones: Guías (docs existentes 01-07), API Reference (TypeDoc), ADRs (memory/decisions.md), Design System (specs/ui/design-system.md).
- [ ] AC-010: `pnpm docs:dev` levanta el sitio en modo desarrollo y `pnpm docs:build` genera el HTML estático sin errores.
- [ ] AC-011: La página de inicio del sitio resume el proyecto (identidad, stack, quality gates, enlaces a las secciones).

### Normas para agentes (Cline y Claude)
- [ ] AC-012: Se añade a `.clinerules` (sección "Código") una norma: "Todo símbolo exportado (clase, función, constante, tipo) debe tener JSDoc — el pre-commit lo verifica con eslint-plugin-jsdoc".
- [ ] AC-013: Se añade a `CLAUDE.md` (sección "Convenciones de Frontend") la misma norma de JSDoc obligatorio en exports públicos.
- [ ] AC-014: Se añade a `.clinerules` y `CLAUDE.md` una nota: "La documentación del proyecto se genera con `pnpm docs:build` y se publica en `<sitio>` — consultarla antes de implementar".

### Backend Rust (cargo doc)
- [ ] AC-015: El script `pnpm docs:rust` ejecuta `cargo doc --no-deps` en `src-tauri/` sin errores ni warnings.
- [ ] AC-016: `pnpm docs` (script agregado) genera toda la documentación del proyecto: API reference TS (`docs:api`), sitio VitePress (`docs:build`) y Rust (`docs:rust`).

### Cobertura y calidad
- [ ] AC-017: Tras la implementación, la cobertura de documentación real (typedoc-plugin-coverage) supera el umbral configurado sin esconder símbolos tras `@ignore` (excepto casos justificados documentados en la spec).
- [ ] AC-018: Los 567+ tests Vitest, ESLint y Clippy siguen pasando tras los cambios (sin regresiones).
- [ ] AC-019: `pnpm docs:build` y `pnpm docs:api` se ejecutan sin errores en CI (script de ejemplo en `.github/workflows/`).

## Comportamiento Esperado

### Escenario: Un agente (Cline o Claude) escribe código nuevo sin JSDoc
- **Dado** un agente trabajando en el repositorio con un export público sin JSDoc
- **Cuando** intenta hacer commit
- **Entonces** el pre-commit de Husky falla en ESLint con el error `jsdoc/require-jsdoc` indicando el archivo y símbolo sin documentar

### Escenario: El desarrollador genera la documentación
- **Dado** el proyecto con TypeDoc, VitePress y scripts configurados
- **Cuando** ejecuta `pnpm docs`
- **Entonces** se genera la API reference HTML, el sitio VitePress y la documentación Rust, sin errores

### Escenario: Un agente necesita consultar la documentación antes de implementar
- **Dado** un agente (Cline o Claude) con una tarea de implementación
- **Cuando** necesita conocer el contrato de un componente o service
- **Entonces** consulta la API reference generada (o `pnpm docs:dev` en desarrollo) en vez de leer todo el código fuente

### Escenario: La cobertura de documentación baja del umbral
- **Dado** que la cobertura de documentación (typedoc-plugin-coverage) baja del umbral configurado
- **Cuando** se ejecuta `pnpm docs:coverage`
- **Entonces** el comando sale con código de error 1, fallando el pre-commit o CI (configurable en `.husky/pre-commit`)

## Constraints
- Mínimo de dependencias: solo las necesarias para la documentación (TypeDoc, VitePress, typedoc-plugin-coverage, eslint-plugin-jsdoc). No se cambia la lógica de negocio del código.
- El JSDoc debe ser **conciso**: una o dos líneas que describan el **qué** y el **porqué**, no el **cómo**. No se documenta lo obvio (`@param x la x`).
- No se instala documentación en runtime: solo devDependencies.
- No se documenta código interno no exportado (las normas aplican a exports públicos únicamente).
- VitePress y TypeDoc generan documentación estática que puede vivir en un subpath (ej. `gh-pages` o `docs/` publicado), sin servidor en runtime.

## Dependencias
- Dependencia externa: `typedoc` (≥0.27), `typedoc-plugin-coverage`, `vitepress`, `eslint-plugin-jsdoc` (todas como devDependencies).
- Sin dependencia de backend: `cargo doc` ya viene incluido con Rust. No requiere dependencias extra.
- Feature anterior: `cobertura-e2e` (el mecanismo de siembra y `data-cy` no se ven afectados; esta feature solo añade documentación).

## Notas de Implementación
- TypeDoc se integra con `typedoc.json` en la raíz con `entryPoints: ["src/main.ts"]` (o `src/index.ts` si existiera) y `out: "docs/api"` o `docs/.vitepress/dist/api`. En VitePress, la API reference se enlaza con una guía que apunta al HTML generado.
- `eslint-plugin-jsdoc` se configura en `eslint.config.js` (flat config) con la regla `jsdoc/require-jsdoc` y `settings.jsdoc.publicOnly: true`. Los exports públicos se detectan con `@public` en JSDoc o `export` real en el código.
- La regla `jsdoc/require-jsdoc` NO se aplica a `*.spec.ts`. Se desactiva con `files: ["**/*.spec.ts"]` en el override de ESLint existente.
- El pre-commit de Husky ya ejecuta `npx eslint src/ --max-warnings 0` — añadir la regla a ESLint es suficiente para que falle el commit. Otras reglas (como `jsdoc/check-tag-names` o `jsdoc/no-undefined-types`) son opcionales y recomendadas para evitar JSDoc inválido.
- El sitio VitePress: `docs/.vitepress/config.ts` con `base` configurable (para deploy en gh-pages). Las guías existentes (`docs/01-architecture-sdd.md` a `docs/07-cypress-e2e.md`) se copian o se referencian. El design system y ADRs se cargan desde `specs/ui/design-system.md` y `memory/decisions.md` (con markdown-it o include).
- `typedoc-plugin-coverage` necesita `entryPoints` y emite el reporte de cobertura de documentación con `--coverage` y `--coverageLabel` opcionales. El umbral se configura también en `typedoc.json`.
- El script `pnpm docs:coverage` puede fallar si el umbral no se cumple (con `--coverageThreshold`).
- Se debe actualizar `CLAUDE.md` y `.clinerules` para que los agentes (Cline y Claude) conozcan la norma de JSDoc y la ubicación de la documentación generada.
- En el plan se detallarán los pasos con TDD. Un paso final de `review-agent` verificará que la cobertura de documentación cumplió el umbral y que los AC-012 a AC-014 (normas en agentes) quedaron reflejados en los archivos de configuración.