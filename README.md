# Moto Routes 🏍️

**Ride Tracker Mobile App** — Grabación de rutas GPS para motociclistas. Combina la precisión de un cuadro de instrumentos de competición con la fluidez de una bitácora digital.

---

## Stack Tecnológico

| Componente | Tecnología |
|------------|-----------|
| Frontend | TypeScript 5.7 + Vite 6 + Web Components nativos |
| Backend | Rust (stable, edition 2021) |
| Framework | Tauri 2 (Android, iOS, Desktop) |
| Testing TS | Vitest 3 + jsdom (coverage ≥ 80%) |
| Testing Rust | cargo test |
| Linting TS | ESLint 9 (strictTypeChecked + stylistic) |
| Linting Rust | Clippy (deny warnings) |
| Formato TS | Prettier 3 |
| Formato Rust | rustfmt |
| Git Hooks | Husky 9 |

## Filosofía Visual

- **Concepto**: "Telemetry & Freedom" — precisión técnica + bitácora digital.
- **Modo oscuro obligatorio**: Por seguridad vial (sin deslumbramiento nocturno).
- **Paleta**: Fondo `#0b0c10`, neón verde `#00ff66`, rojo `#ff3131`, azul `#00d2ff`.
- **Accesibilidad**: Hitboxes mínimas de 56×56px para uso con guantes de moto.
- **Design tokens**: Todos los valores CSS están en `src/shared/styles/tokens.css`.
- **Documentación visual completa**: `specs/ui/design-system.md`.

## Scripts Disponibles

```bash
# Desarrollo
npm run dev              # Servidor de desarrollo Vite
npm run tauri:dev        # Tauri modo desarrollo (Android/iOS/Desktop)
npm run tauri:android    # Tauri en Android (emulador/dispositivo)
npm run tauri:ios        # Tauri en iOS (requiere macOS + Xcode)

# Testing
npm test                 # Tests frontend (Vitest)
npm run test:coverage    # Tests con cobertura
npm run rust:test        # Tests backend (cargo test)

# Linting y formato
npm run lint             # ESLint frontend
npm run rust:lint        # Clippy backend
npm run format           # Prettier frontend
npm run rust:format      # rustfmt backend

# Build
npm run build            # Build frontend (tsc + vite)
npm run tauri:build      # Build Tauri producción
npm run rust:audit       # Auditoría de dependencias Rust

# Pre-commit (automático con Husky)
npm run prepare          # Inicializar Husky
```

## Requisitos de Desarrollo

- **Node.js** >= 18
- **Rust** (latest stable) — [rustup.rs](https://rustup.rs)
- **Tauri CLI**: `cargo install tauri-cli`
- **Android (objetivo principal)**:
  - Android Studio (con Android SDK 34+)
  - Android NDK (via SDK Manager)
  - Java 17+
  - Variable `ANDROID_HOME` configurada
- **iOS** (futuro): Xcode + macOS

## Instalación

### 1. Setup básico (frontend + Rust)

```bash
# 1. Instalar dependencias del frontend
npm install

# 2. Inicializar Husky
npm run prepare
```

### 2. Setup Android

```bash
# 1. Setup automático (recomendado)
bash scripts/setup-android.sh

# 2. O manualmente:
npx tauri android init

# 3. Iniciar en dispositivo Android conectado o emulador
npm run tauri:android

# 4. Build de producción Android
npm run tauri:android:build
```

### Requisitos Android adicionales

Asegúrate de tener configurado el entorno Android:

```bash
# En Windows (PowerShell):
[System.Environment]::SetEnvironmentVariable('ANDROID_HOME', "$env:LOCALAPPDATA\Android\Sdk", 'User')

# En Linux/macOS (.bashrc / .zshrc):
export ANDROID_HOME=$HOME/Android/Sdk
export PATH=$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin

# Verificar:
echo $ANDROID_HOME
```

## Estructura del Proyecto

```
src/                          # Frontend (TypeScript + Vite)
├── app/                      # Componente raíz (Cockpit)
├── components/               # Componentes UI
│   └── counter/              # Componente de ejemplo
├── shared/
│   ├── styles/tokens.css     # Design tokens globales
│   ├── utils/                # Utilidades DOM
│   └── tauri/commands.ts     # Wrappers tipados invoke()
├── index.css                 # Estilos base
├── main.ts                   # Entry point
└── vite-env.d.ts             # Type declarations

src-tauri/                    # Backend (Rust)
├── src/
│   ├── main.rs               # Entry point
│   ├── lib.rs                # Librería Tauri
│   └── commands/mod.rs       # Comandos Tauri
├── capabilities/default.json # Permisos mínimos
├── tauri.conf.json           # Configuración Tauri
└── Cargo.toml                # Dependencias Rust

tests/                        # Test setup
specs/                        # Especificaciones SDD
├── features/                 # Features specs
├── api/                      # API contracts
├── data/                     # Data models
└── ui/                       # Design system
agents/                       # Agentes SDD
docs/                         # Documentación arquitectura
memory/                       # Sistema de memoria persistente
```

## Metodología

Este proyecto sigue **Spec-Driven Development (SDD)**:

1. **SPEC** → `specs/features/<feature>.md`
2. **PLAN** → `specs/features/<feature>.plan.md`
3. **TASKS** → GitHub Issues
4. **IMPL** → `src/` + `tests/` (TDD: RED → GREEN → REFACTOR)
5. **REVIEW** → `specs/features/<feature>.review.md`
6. **TEST** → Validación final

## Quality Gates

- ✅ Test pass rate: 100%
- ✅ Code coverage: ≥ 80%
- ✅ AC coverage: 100%
- ✅ ESLint: 0 warnings, 0 errors
- ✅ Clippy: 0 warnings
- ✅ Build: tsc + vite + cargo + tauri sin errores

## Documentación SDD

| Documento | Descripción |
|-----------|-------------|
| `docs/01-arquitectura-sdd.md` | Arquitectura SDD |
| `docs/02-workflow-sdd.md` | Workflow completo |
| `docs/03-agentes-skills.md` | Agentes y skills |
| `docs/04-token-management.md` | Gestión de tokens |
| `docs/05-memory-system.md` | Sistema de memoria |
| `docs/06-seguridad.md` | Seguridad y CSP |
| `docs/07-cypress-e2e.md` | Tests E2E con Cypress |