# Contexto del Proyecto: Moto Routes

## Identidad
- **Nombre**: Moto Routes (Ride Tracker)
- **Propósito**: Aplicación móvil para motociclistas que combina navegación GPS, grabación de rutas y bitácora multimedia.
- **Repositorio**: d:\Git\Otros\moto-routes

## Stack Tecnológico
- **Lenguaje Frontend**: TypeScript 5.7 (strict mode)
- **Lenguaje Backend**: Rust (stable, edition 2021)
- **Bundler**: Vite 6
- **Desktop/Mobile Framework**: Tauri 2
- **UI**: Web Components nativos (Custom Elements v1)
- **Testing Frontend**: Vitest 3 (jsdom, coverage v8) → 80% threshold
- **Testing Backend**: cargo test (unit + integration)
- **Linting TS**: ESLint 9 (strictTypeChecked + stylistic)
- **Linting Rust**: Clippy (deny warnings)
- **Formatting TS**: Prettier 3
- **Formatting Rust**: rustfmt
- **Git Hooks**: Husky 9 (pre-commit: ESLint + Clippy + rustfmt + tests + cargo audit)
- **Package Manager**: pnpm + Cargo
- **Security**: CSP estricto, permisos mínimos, sin eval, path validation
- **BBDD Local**: SQLite vía `@tauri-apps/plugin-sql` (archivo: `moto-routes.db`)

## Herramientas de Desarrollo
- **GitHub CLI**: `gh` (oficial, ya instalado) → issues, PRs, releases
- **rtk**: Proxy de comandos (https://github.com/rtk-ai/rtk) → reduce tokens 60-90% en comandos repetitivos
- **Cline**: Extensión VSCode con DeepSeek como modelo

## Estructura del Proyecto
```
src/                          # Frontend (TypeScript + Vite)
├── app/
│   └── app.element.ts        # Componente raíz <app-root>, monta <cockpit-view>
├── cockpit/                  # Dominio "cockpit" (grabación de ruta)
│   ├── cockpit.element.ts    # Web Component <cockpit-view>
│   ├── cockpit.element.css   # Estilos del cockpit
│   ├── cockpit.service.ts    # Estado de grabación (GPS, pausas, invisible)
│   └── cockpit.transform.ts  # Formateo/cálculos (distancia, velocidad, duración)
├── assets/
│   └── fonts/                 # Subset .woff2 auto-alojado (Roboto Slab, Barlow, Barlow Semi Condensed)
├── components/
│   └── counter/
│       ├── counter.element.ts    # Ejemplo: <app-counter>
│       ├── counter.element.css   # Estilos del counter
│       └── counter.element.spec.ts
├── routes/                    # Dominio "routes" (listado, detalle, timeline)
├── shared/
│   ├── styles/
│   │   └── tokens.css        # Design tokens globales
│   ├── utils/
│   │   └── dom.ts            # Utilidades DOM
│   ├── repositories/
│   │   ├── sqlite-route.repository.ts  # Repositorio SQLite para rutas
│   │   ├── sqlite-route.factory.ts     # Factory para crear la conexión
│   │   └── sqlite-route.repository.spec.ts
│   ├── models/
│   │   └── route.repository.spec.ts    # Suite de tests compartida
│   └── tauri/
│       └── commands.ts       # Wrappers tipados para invoke()
├── index.css                 # Estilos base globales
├── main.ts                   # Entry point
└── vite-env.d.ts             # Type declarations
src-tauri/                    # Backend (Rust)
├── src/
│   ├── main.rs               # Entry point de Tauri
│   ├── lib.rs                # Librería con comandos
│   └── commands/
│       └── mod.rs            # Comandos Tauri
├── capabilities/
│   └── default.json          # Permisos explícitos (mínimo privilegio)
├── icons/                    # Iconos de la app (generados por tauri icon)
├── Cargo.toml
├── tauri.conf.json
├── build.rs
├── .gitignore
└── .cargo/
    └── config.toml           # Cross-compiler NDK para Android
tests/
└── setup.ts                  # Test setup global
specs/features/               # Especificaciones funcionales por feature
specs/api/                    # Contratos de API
specs/data/                   # Modelos de datos, schemas
specs/ui/
├── design-system.md          # Filosofía visual + design tokens (actualizado)
└── frontend-conventions.md   # Reglas de frontend
agents/                       # Skills de agentes SDD
docs/                         # Documentación SDD
memory/                       # Sistema de memoria persistente
```

## Filosofía Visual: "Asfalto Nocturno"
- **Concepto**: Cuero oscuro, negro asfalto y ámbar cálido. Cuaderno de bitácora, no HUD de competición. **Prohibido**: neón, glassmorphism, azules fríos, diales circulares.
- **Source of truth**: `specs/ui/design-system.md` y `src/shared/styles/tokens.css`.
- **Tokens activos** (`--bg-top`, `--panel`, `--amber`, `--ink`, `--font-display/ui/data`). **No usar** `--color-*`, `--glow-*`, `--neon-*` (eliminados).
- **Modo oscuro obligatorio**: Por seguridad vial, sin modo claro.
- **Hitbox mínima**: 56×56px para uso con guantes de moto.
- **Paleta**: Asfalto/cuero oscuro (`--bg-top`/`--bg-bottom`), ámbar único acento (`--amber`), óxido de apoyo (`--rust-line`).
- **Tipografía**: Roboto Slab (titulares) + Barlow (interfaz) + Barlow Semi Condensed tabular (cifras). Self-hosted en `src/assets/fonts/`.
- **Shadow DOM**: Los estilos globales reales viven en `tokens.css` (importado en cada `*.element.css`). `index.css` solo alcanza DOM ligero.
- **Historial**: Sustituye a "Telemetry & Freedom" (ADR-019). Archivos legacy eliminados (`estilos_base.scss`, `filosofia de diseño.md`).

## Quality Gates
- **Test pass rate**: 100% (frontend + backend)
- **Code coverage (TS)**: 80% (lines, functions, branches, statements)
- **AC coverage**: 100% (cada criterio de aceptación debe tener al menos un test)
- **ESLint**: 0 warnings, 0 errors
- **Clippy**: 0 warnings (deny)
- **rustfmt**: Código formateado
- **cargo audit**: Sin vulnerabilidades conocidas
- **Build**: tsc sin errores + cargo build exitoso + vite build exitoso + tauri build exitoso

## Estado Actual del Proyecto
- **Sesión 2026-07-27 (3) — feature `timeline-ruta` (21/21 AC, 8/8 pasos del plan)**: implementada por SDD con TDD. Nueva pestaña "Timeline" en `<route-detail>` como 4ª pestaña del `<tab-bar>`, que muestra en orden cronológico Salida, paradas detectadas al vuelo (reutilizando `detectStop()` de `cockpit.transform.ts` con el mismo criterio conservador de 30 puntos ≤3 km/h), fotos intercaladas y Llegada, con velocidad media de cada tramo. Cinco archivos creados: `route-timeline.types.ts` (tipos puros), `route-timeline.transform.ts` (lógica pura: `detectStopsFromPoints`, `formatTimelineTime`/`Coords`/`Speed`, `buildTimelineSegments`, `buildTimelineData`), `route-detail-timeline.ts` (constructor DOM), y sus specs. Tres archivos modificados: `route-detail.element.ts` (4ª pestaña, guarda `_routePoints` completos con timestamp/speed, `refreshAllPanels` al cambiar fotos), `route-detail.element.css` (~100 líneas de estilos con tokens Asfalto Nocturno). 21/21 AC cubiertos con 27 tests nuevos. **419/419 tests pasan**, cobertura >80%. Sin cambios en Rust, SQLite ni dependencias. Build Android compilado (`pnpm tauri android build`), instalado en dispositivo real y **verificado visualmente por el usuario** — pestaña Timeline funcional con datos de rutas ya guardadas. Mergeado a `master` (PR #49).
- **Sesión 2026-07-27 (2) — feature `mejoras-guardado-rutas` (18/18 AC, 11/11 pasos del plan)**: nombre de ruta al guardar, notas editables, fix nav-bar. Mergeado a `master` (PR #48).
- **Sesión 2026-07-27 — fix: GPS no grababa en segundo plano**: foreground service real vía JNI. Mergeado a `master` (PR #47).
- **Fase**: APK Android compilado y funcional, con persistencia de rutas y fotos verificada en dispositivo real. Todas las features mergeadas a `master`.
- **Feature activo**: Ninguno en desarrollo activo. `timeline-ruta` (PR #49) mergeado. Pendiente ISSUE-001 del review de `mejoras-fotos-mapa` (verificación visual en Android real + migración ALTER TABLE).

## Desarrollo Web (Vite)
Para lanzar el proyecto en modo web (sin Tauri), usar:
```bash
pnpm run dev
```

**Puerto fijo**: `1420` (configurado en `vite.config.ts` con `strictPort: true`).

## Build Android
```powershell
pnpm tauri android build --target aarch64 --debug
adb install -r src-tauri/gen/android/app/build/outputs/apk/universal/debug/app-universal-debug.apk
```

## Convenciones
- **Estilo de código**: TypeScript strict mode + ESLint strict + Prettier
- **Commits**: Conventional Commits
- **Ramas**: feature/<nombre> desde main
- **Nombrado**: Carpetas en kebab-case, clases/componentes en PascalCase, funciones en camelCase
- **Idioma**: Docs y specs en español, código en inglés