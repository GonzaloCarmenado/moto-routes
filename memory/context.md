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
- **Package Manager**: npm + Cargo
- **Security**: CSP estricto, permisos mínimos, sin eval, path validation

## Herramientas de Desarrollo
- **GitHub CLI**: `gh` (oficial, ya instalado) → issues, PRs, releases
- **rtk**: Proxy de comandos (https://github.com/rtk-ai/rtk) → reduce tokens 60-90% en comandos repetitivos
- **Cline**: Extensión VSCode con DeepSeek como modelo

## Estructura del Proyecto
```
src/                          # Frontend (TypeScript + Vite)
├── app/
│   ├── app.element.ts        # Componente raíz <app-root> (Cockpit)
│   └── app.element.css       # Estilos del cockpit
├── components/
│   └── counter/
│       ├── counter.element.ts    # Ejemplo: <app-counter>
│       ├── counter.element.css   # Estilos del counter
│       └── counter.element.spec.ts
├── shared/
│   ├── styles/
│   │   └── tokens.css        # Design tokens globales
│   ├── utils/
│   │   └── dom.ts            # Utilidades DOM
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
└── .gitignore

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

## Filosofía Visual
- **Concepto**: "Telemetry & Freedom" — fusión de cuadro de instrumentos de competición con bitácora digital.
- **Modo oscuro obligatorio**: Por seguridad vial, sin modo claro.
- **Tokens CSS**: Definidos en `src/shared/styles/tokens.css` y documentados en `specs/ui/design-system.md`.
- **Hitbox mínima**: 56×56px para uso con guantes de moto.
- **Paleta**: Fondo #0b0c10, neón verde #00ff66, rojo #ff3131, azul #00d2ff.

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
- **Fase**: Inicial - APK Android compilado
- **Feature activo**: Ninguno (infraestructura base configurada)
- **Último hito completado**: APK debug generado para arm64-v8a en `src-tauri/gen/android/app/build/outputs/apk/arm64/debug/app-arm64-debug.apk`
- **Próximo hito**: Definir primera feature (grabación de rutas)

## Build Android (Windows workaround)
Tauri 2 tiene un bug conocido en Windows con el Kotlin incremental compiler cuando el proyecto está en una unidad diferente a C: (ej: D:). Además, los symlinks no funcionan sin permisos especiales.

**Workaround documentado** en `memory/tokens.md` con el comando exacto para compilar.

**Resumen**: 
1. `pnpm build` (frontend)
2. `cargo build --target aarch64-linux-android` (Rust)
3. Copiar `libapp_lib.so` manualmente a `jniLibs/arm64-v8a/`
4. `gradlew assembleDebug --no-daemon -x :app:rustBuild*` (APK)

## Convenciones
- **Estilo de código**: TypeScript strict mode + ESLint strict + Prettier
- **Commits**: Conventional Commits
- **Ramas**: feature/<nombre> desde main
- **Nombrado**: Carpetas en kebab-case, clases/componentes en PascalCase, funciones en camelCase
- **Idioma**: Docs y specs en español, código en inglés

## Reglas para Cline/DeepSeek
- Siempre cargar este archivo al iniciar sesión
- No escribir código sin una spec en specs/features/
- Seguir el workflow SDD: SPEC → PLAN → TASKS → IMPL → REVIEW → TEST
- Usar TDD: tests antes que implementación
- Mantener este archivo actualizado con el estado del proyecto
- Ser eficiente con tokens: solo cargar archivos necesarios