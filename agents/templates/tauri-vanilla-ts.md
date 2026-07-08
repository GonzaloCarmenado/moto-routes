# Template: Tauri Vanilla TypeScript

## Identidad
- **Nombre**: tauri-vanilla-ts
- **Descripción**: Aplicación de escritorio con Tauri (Rust backend) + frontend vanilla con TypeScript estricto, Vite, Web Components nativos, Vitest, ESLint strict, Husky, y buenas prácticas de seguridad de Tauri.
- **Tipo**: Desktop App (Frontend + Backend Rust)
- **Complejidad**: Alta

## Stack Tecnológico
| Componente | Tecnología | Versión |
|------------|-----------|---------|
| Frontend Runtime | TypeScript | ^5.7 |
| Frontend Bundler | Vite | ^6.0 |
| UI | Web Components nativos (Custom Elements v1) | - |
| Desktop Framework | Tauri | ^2.0 |
| Backend | Rust (stable) | latest |
| Frontend Testing | Vitest | ^3.0 |
| Backend Testing | cargo test | latest |
| Linting TS | ESLint | ^9.0 |
| Linting Rust | clippy | latest |
| Formatting TS | Prettier | ^3.0 |
| Formatting Rust | rustfmt | latest |
| Git Hooks | Husky | ^9.0 |
| Package Manager | npm + Cargo | latest |

## Estructura de Carpetas Resultante

```
src/                          # Frontend (TypeScript + Vite)
├── app/
│   └── app.element.ts        # Componente raíz <app-root>
├── components/
│   └── counter/
│       ├── counter.element.ts # Ejemplo: <app-counter>
│       └── counter.element.spec.ts
├── shared/
│   ├── styles/
│   │   └── shared.css
│   ├── utils/
│   │   └── dom.ts
│   └── tauri/
│       └── commands.ts        # Wrappers tipados para invoke()
├── index.css
└── main.ts                    # Entry point

src-tauri/                     # Backend (Rust)
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
└── build.rs

tests/
└── setup.ts                  # Test setup global

specs/features/               # (existente, no modificar)
```

## Principios de Seguridad (Tauri Best Practices)

1. **CSP estricto**: Configurar Content Security Policy sin `unsafe-eval` ni `unsafe-inline`
2. **Permisos mínimos**: Solo habilitar en `capabilities/default.json` los permisos estrictamente necesarios
3. **No usar `window.__TAURI__` directamente**: Usar wrappers tipados con `@tauri-apps/api`
4. **Validación en Rust**: Todo input del frontend se valida en el backend Rust
5. **Sin `eval()`**: Prohibido en CSP y en ESLint
6. **No abrir devtools en producción**: Solo en desarrollo
7. **Sanitizar paths**: Usar `std::path::Path` correctamente, evitar path traversal
8. **Manejo de errores con `Result`**: Nada de `.unwrap()` o `.expect()` en producción
9. **Logging**: Usar `tracing` para logs, no `println!`
10. **Auditar dependencias**: `cargo audit` periódicamente

## Archivos a Crear/Modificar

### 1. package.json

```json
{
  "name": "basic-template",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "lint": "eslint src/",
    "lint:fix": "eslint src/ --fix",
    "format": "prettier --write src/",
    "prepare": "husky",
    "tauri": "tauri",
    "tauri:dev": "tauri dev",
    "tauri:build": "tauri build",
    "rust:test": "cd src-tauri && cargo test",
    "rust:lint": "cd src-tauri && cargo clippy -- -D warnings",
    "rust:format": "cd src-tauri && cargo fmt --check",
    "rust:audit": "cd src-tauri && cargo audit"
  },
  "dependencies": {
    "@tauri-apps/api": "^2.0.0"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "vite": "^6.0.0",
    "vitest": "^3.0.0",
    "@vitest/coverage-v8": "^3.0.0",
    "eslint": "^9.0.0",
    "typescript-eslint": "^8.0.0",
    "prettier": "^3.0.0",
    "husky": "^9.0.0",
    "jsdom": "^25.0.0",
    "@tauri-apps/cli": "^2.0.0"
  }
}
```

### 2. tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "forceConsistentCasingInFileNames": true,
    "isolatedModules": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "sourceMap": true,
    "declaration": true,
    "declarationMap": true,
    "types": ["vitest/globals"]
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist", "src-tauri"]
}
```

### 3. vite.config.ts

```typescript
import { defineConfig } from 'vite';

const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  build: {
    target: 'es2022',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
    chunkSizeWarningLimit: 200,
  },
  server: {
    host: host || false,
    port: 1420,
    strictPort: true,
    hmr: host
      ? {
          protocol: 'ws',
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ['**/src-tauri/**'],
    },
  },
  // CSP para desarrollo: se inyecta en el HTML. En producción lo gestiona Tauri.
  // Nota: no usar unsafe-eval ni unsafe-inline en producción
});
```

### 4. vitest.config.ts

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.spec.ts', 'src/main.ts'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
});
```

### 5. eslint.config.js

```javascript
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['dist/', 'node_modules/', 'coverage/', 'src-tauri/'],
  },
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylistic,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/explicit-function-return-type': 'error',
      '@typescript-eslint/explicit-module-boundary-types': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/prefer-readonly': 'error',
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unnecessary-condition': 'error',
      'no-console': 'warn',
      'prefer-const': 'error',
      'no-var': 'error',
      'no-eval': 'error', // Tauri CSP: no eval permitido
    },
  },
);
```

### 6. .prettierrc

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "arrowParens": "always",
  "endOfLine": "lf"
}
```

### 7. .husky/pre-commit

```bash
#!/usr/bin/env sh

echo "🔍 Ejecutando ESLint (frontend)..."
npx eslint src/ --max-warnings 0 || exit 1

echo "🔍 Ejecutando Clippy (backend Rust)..."
cd src-tauri && cargo clippy -- -D warnings || exit 1
cd ..

echo "🦀 Verificando formato Rust..."
cd src-tauri && cargo fmt --check || exit 1
cd ..

echo "🧪 Ejecutando tests frontend..."
npx vitest run --coverage --silent || exit 1

echo "🧪 Ejecutando tests backend..."
cd src-tauri && cargo test || exit 1
cd ..

echo "🔒 Auditando dependencias Rust..."
cd src-tauri && cargo audit || echo "⚠️  cargo audit no instalado (saltando)"
cd ..

echo "✅ Pre-commit checks superados"
```

### 8. index.html

```html
<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta
      http-equiv="Content-Security-Policy"
      content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' ipc: http://ipc.localhost; font-src 'self'"
    />
    <meta name="description" content="Basic Template SDD - Tauri Desktop App" />
    <title>Basic Template</title>
    <link rel="stylesheet" href="/src/index.css" />
  </head>
  <body>
    <app-root></app-root>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

### 9. src/main.ts

```typescript
import './app/app.element.js';

// Solo montar si estamos en un navegador (evitar errores en SSR/Node)
if (typeof window !== 'undefined') {
  const app = document.createElement('app-root');
  document.body.appendChild(app);
}
```

### 10. src/shared/tauri/commands.ts

```typescript
/**
 * Wrappers tipados para invoke<T>() de Tauri.
 * Centraliza todas las llamadas al backend Rust con tipado estricto.
 * Nunca usar window.__TAURI__ directamente.
 */
import { invoke } from '@tauri-apps/api/core';

// Ejemplo: comando greet en Rust
export interface GreetArgs {
  name: string;
}

export interface GreetResponse {
  message: string;
}

export async function greet(args: GreetArgs): Promise<GreetResponse> {
  return invoke<GreetResponse>('greet', args);
}

// Ejemplo: comando con validación
export interface SaveFileArgs {
  path: string;
  content: string;
}

export async function saveFile(args: SaveFileArgs): Promise<void> {
  // Validación básica en frontend (la validación real está en Rust)
  if (!args.path || !args.content) {
    throw new Error('Path and content are required');
  }
  return invoke<void>('save_file', args);
}
```

### 11. src/app/app.element.ts

```typescript
import { BaseElement } from '../shared/base-element.js';
import { greet } from '../shared/tauri/commands.js';
import styles from './app.element.css?inline';

class AppRoot extends BaseElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback(): void {
    this.render();
  }

  private async handleGreetClick(): Promise<void> {
    try {
      const response = await greet({ name: 'Cline + DeepSeek' });
      this.emit('greet-response', response.message);
    } catch (error) {
      console.error('Failed to greet:', error);
      this.emit('greet-error', String(error));
    }
  }

  protected render(): void {
    if (!this.shadowRoot) return;

    const style = document.createElement('style');
    style.textContent = styles;

    const main = document.createElement('main');
    main.innerHTML = `
      <h1>Basic Template SDD</h1>
      <p>TypeScript + Vite + Web Components + Tauri</p>
      <button id="greet-btn">Greet from Rust</button>
      <p id="greet-output"></p>
    `;

    this.shadowRoot.innerHTML = '';
    this.shadowRoot.appendChild(style);
    this.shadowRoot.appendChild(main);

    this.shadowRoot.getElementById('greet-btn')?.addEventListener('click', () => {
      void this.handleGreetClick();
    });
  }
}

customElements.define('app-root', AppRoot);
```

### 12. src/shared/base-element.ts

```typescript
export abstract class BaseElement extends HTMLElement {
  protected emit<T>(name: string, detail: T): void {
    this.dispatchEvent(
      new CustomEvent<T>(name, {
        detail,
        bubbles: true,
        composed: true,
      }),
    );
  }

  protected abstract render(): void;
}
```

### 13. src/shared/utils/dom.ts

```typescript
export function createElement<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> = {},
  ...children: (string | Node)[]
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  Object.assign(element, props);
  element.append(...children);
  return element;
}
```

### 14. src/index.css

```css
*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html {
  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
    sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

body {
  min-height: 100dvh;
  background-color: #f5f5f5;
  color: #1a1a1a;
}
```

### 15. src/components/counter/counter.element.ts

```typescript
import { BaseElement } from '../../shared/base-element.js';

class AppCounter extends BaseElement {
  static observedAttributes = ['count'];

  private _count = 0;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  get count(): number {
    return this._count;
  }

  set count(value: number) {
    this._count = value;
    this.setAttribute('count', String(value));
    this.render();
  }

  attributeChangedCallback(name: string, _oldValue: string, newValue: string): void {
    if (name === 'count') {
      this._count = Number(newValue) || 0;
      this.render();
    }
  }

  connectedCallback(): void {
    this.render();
  }

  protected render(): void {
    if (!this.shadowRoot) return;

    this.shadowRoot.innerHTML = `
      <button id="decrement" aria-label="Decrement">-</button>
      <span aria-live="polite">${this._count}</span>
      <button id="increment" aria-label="Increment">+</button>
    `;

    this.shadowRoot.getElementById('increment')?.addEventListener('click', () => {
      this.count++;
      this.emit('counter-changed', this.count);
    });

    this.shadowRoot.getElementById('decrement')?.addEventListener('click', () => {
      this.count--;
      this.emit('counter-changed', this.count);
    });
  }
}

customElements.define('app-counter', AppCounter);
```

### 16. src/components/counter/counter.element.spec.ts

```typescript
import { describe, it, expect } from 'vitest';
import './counter.element.js';

describe('AppCounter', () => {
  it('should render with initial value 0', () => {
    const counter = document.createElement('app-counter');
    document.body.appendChild(counter);

    const span = counter.shadowRoot?.querySelector('span');
    expect(span?.textContent).toBe('0');

    document.body.removeChild(counter);
  });

  it('should increment on + click', () => {
    const counter = document.createElement('app-counter');
    document.body.appendChild(counter);

    const incrementBtn = counter.shadowRoot?.getElementById('increment') as HTMLButtonElement;
    incrementBtn?.click();

    const span = counter.shadowRoot?.querySelector('span');
    expect(span?.textContent).toBe('1');

    document.body.removeChild(counter);
  });

  it('should decrement on - click', () => {
    const counter = document.createElement('app-counter');
    document.body.appendChild(counter);

    const decrementBtn = counter.shadowRoot?.getElementById('decrement') as HTMLButtonElement;
    decrementBtn?.click();

    const span = counter.shadowRoot?.querySelector('span');
    expect(span?.textContent).toBe('-1');

    document.body.removeChild(counter);
  });

  it('should emit counter-changed event on change', () => {
    const counter = document.createElement('app-counter');
    document.body.appendChild(counter);

    let emitted = false;
    counter.addEventListener('counter-changed', () => {
      emitted = true;
    });

    const incrementBtn = counter.shadowRoot?.getElementById('increment') as HTMLButtonElement;
    incrementBtn?.click();

    expect(emitted).toBe(true);

    document.body.removeChild(counter);
  });
});
```

### 17. tests/setup.ts

```typescript
import '@testing-library/jest-dom/vitest';
```

### 18. src-tauri/Cargo.toml

```toml
[package]
name = "basic-template"
version = "0.1.0"
edition = "2021"
description = "Basic Template SDD - Tauri Desktop App"
authors = ["you"]
license = "MIT"
repository = ""

[lib]
name = "app_lib"
crate-type = ["staticlib", "cdylib", "rlib"]

[build-dependencies]
tauri-build = { version = "2", features = [] }

[dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-opener = "2"
tauri-plugin-log = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
thiserror = "2"
tracing = "0.1"
tracing-subscriber = "0.3"

[profile.release]
panic = "abort"
codegen-units = 1
lto = true
opt-level = "s"
strip = true
```

### 19. src-tauri/tauri.conf.json

```json
{
  "$schema": "https://raw.githubusercontent.com/tauri-apps/tauri/dev/crates/tauri-cli/schema.json",
  "productName": "Basic Template",
  "version": "0.1.0",
  "identifier": "com.basic-template.app",
  "build": {
    "frontendDist": "../dist",
    "devUrl": "http://localhost:1420",
    "beforeDevCommand": "npm run dev",
    "beforeBuildCommand": "npm run build"
  },
  "app": {
    "withGlobalTauri": false,
    "windows": [
      {
        "title": "Basic Template SDD",
        "width": 1024,
        "height": 768,
        "minWidth": 640,
        "minHeight": 480,
        "resizable": true,
        "fullscreen": false
      }
    ],
    "security": {
      "csp": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' ipc: http://ipc.localhost; font-src 'self'"
    }
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ]
  }
}
```

### 20. src-tauri/capabilities/default.json

```json
{
  "identifier": "default",
  "description": "Default capabilities with minimal permissions",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "opener:default",
    "log:default"
  ]
}
```

### 21. src-tauri/src/main.rs

```rust
// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Inicializar logging
    tracing_subscriber::fmt()
        .with_max_level(tracing::Level::INFO)
        .with_target(false)
        .init();

    app_lib::run()
}
```

### 22. src-tauri/src/lib.rs

```rust
use tauri::Manager;
use tracing::info;

mod commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() -> Result<(), Box<dyn std::error::Error>> {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_log::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            commands::greet,
            commands::save_file,
            commands::app_info,
        ])
        .setup(|app| {
            info!("🚀 Tauri app started: {}", app.package_info().name);
            Ok(())
        })
        .run(tauri::generate_context!())?;

    Ok(())
}
```

### 23. src-tauri/src/commands/mod.rs

```rust
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::State;
use tracing::{error, info, warn};
use thiserror::Error;

// ─── Error types ────────────────────────────────────────

#[derive(Error, Debug)]
pub enum AppError {
    #[error("Invalid path: {0}")]
    InvalidPath(String),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Serialization error: {0}")]
    Serde(#[from] serde_json::Error),
}

impl From<AppError> for String {
    fn from(error: AppError) -> Self {
        error.to_string()
    }
}

// ─── Command types (shared with frontend) ───────────────

#[derive(Debug, Serialize, Deserialize)]
pub struct GreetResponse {
    pub message: String,
}

#[derive(Debug, Deserialize)]
pub struct SaveFileArgs {
    pub path: String,
    pub content: String,
}

#[derive(Debug, Serialize)]
pub struct AppInfoResponse {
    pub name: String,
    pub version: String,
}

// ─── Commands ───────────────────────────────────────────

/// Saluda al usuario. Comando de ejemplo.
/// El frontend invoca: invoke('greet', { name: '...' })
#[tauri::command]
pub fn greet(name: String) -> Result<GreetResponse, String> {
    // Validación en backend (defensa en profundidad)
    if name.trim().is_empty() {
        warn!("Greet called with empty name");
        return Err("Name cannot be empty".to_string());
    }

    info!("Greeting: {}", name);
    Ok(GreetResponse {
        message: format!("Hello, {}! From Rust 🦀", name.trim()),
    })
}

/// Guarda contenido en un archivo. Ejemplo con path validation.
/// El frontend invoca: invoke('save_file', { path: '...', content: '...' })
#[tauri::command]
pub fn save_file(args: SaveFileArgs) -> Result<(), String> {
    // Validación estricta del path (prevenir path traversal)
    let path = PathBuf::from(&args.path);

    // Rechazar paths absolutos (solo paths relativos a app data)
    if path.is_absolute() {
        error!("Attempted to use absolute path: {}", args.path);
        return Err("Absolute paths are not allowed".to_string());
    }

    // Rechazar path traversal
    if args.path.contains("..") {
        error!("Path traversal attempt detected: {}", args.path);
        return Err("Path traversal is not allowed".to_string());
    }

    // Validar que el contenido no esté vacío
    if args.content.is_empty() {
        return Err("Content cannot be empty".to_string());
    }

    info!("Saving file: {:?}", path);
    std::fs::write(&path, &args.content).map_err(|e| {
        error!("Failed to write file {:?}: {}", path, e);
        AppError::from(e).to_string()
    })?;

    info!("File saved successfully: {:?}", path);
    Ok(())
}

/// Devuelve información de la app.
#[tauri::command]
pub fn app_info(app_handle: tauri::AppHandle) -> Result<AppInfoResponse, String> {
    let package = app_handle.package_info();
    Ok(AppInfoResponse {
        name: package.name.to_string(),
        version: package.version.to_string(),
    })
}
```

### 24. src-tauri/build.rs

```rust
fn main() {
    tauri_build::build()
}
```

### 25. src-tauri/.gitignore

```gitignore
target/
```

### 26. .gitignore (completar)

```gitignore
node_modules/
dist/
coverage/
*.local
*.log
.DS_Store
src-tauri/target/
```

### Actualizaciones a memory/context.md

El init-agent debe actualizar el archivo `memory/context.md` con:

```markdown
## Stack Tecnológico
- **Lenguaje Frontend**: TypeScript 5.7 (strict mode)
- **Lenguaje Backend**: Rust (stable, edition 2021)
- **Bundler**: Vite 6
- **Desktop Framework**: Tauri 2
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

## Quality Gates
- **Test pass rate**: 100% (frontend + backend)
- **Code coverage (TS)**: 80% (lines, functions, branches, statements)
- **AC coverage**: 100% (cada criterio de aceptación debe tener al menos un test)
- **ESLint**: 0 warnings, 0 errors
- **Clippy**: 0 warnings (deny)
- **rustfmt**: Código formateado
- **cargo audit**: Sin vulnerabilidades conocidas
- **Build**: tsc sin errores + cargo build exitoso + vite build exitoso + tauri build exitoso
```

### Actualizaciones a memory/decisions.md

El init-agent debe registrar estos ADR:

```markdown
## ADR-013: Stack desktop con Tauri 2 (Rust + Vite + Web Components)
- **Fecha**: [fecha actual]
- **Estado**: Aceptada
- **Contexto**: Se necesita una app de escritorio multiplataforma con frontend web y backend nativo.
- **Decisión**: Tauri 2 con Rust backend y Vite + TypeScript + Web Components frontend.
- **Alternativas consideradas**: Electron (descartado: bundle pesado, consume mucha RAM), NW.js (descartado: menos maduro), Flutter Desktop (descartado: requiere Dart).
- **Consecuencias**: Bundle ligero (~5-10MB) gracias al WebView nativo del SO y Rust compilado. IPC tipado con invoke<T>(). CSP estricto obligatorio.

## ADR-014: Seguridad en Tauri - CSP + permisos mínimos + path validation
- **Fecha**: [fecha actual]
- **Estado**: Aceptada
- **Contexto**: Tauri expone APIs del sistema operativo. Sin una configuración cuidadosa, se pueden introducir vulnerabilidades.
- **Decisión**: Aplicar defensa en profundidad: CSP sin unsafe-eval/unsafe-inline en producción, capabilities con permisos mínimos, validación de paths en Rust contra path traversal, wrappers tipados para invoke(), sin `window.__TAURI__` directo.
- **Alternativas consideradas**: Confiar en defaults de Tauri (descartado: permisos demasiado abiertos en algunas versiones).
- **Consecuencias**: Cada nuevo permiso (filesystem, shell, etc.) debe añadirse explícitamente en `capabilities/default.json`. Los comandos Rust deben validar inputs.

## ADR-015: Rust testing y linting con Clippy + cargo test
- **Fecha**: [fecha actual]
- **Estado**: Aceptada
- **Contexto**: El backend Rust necesita su propia suite de testing y linting, separada del frontend.
- **Decisión**: Usar `cargo test` para tests unitarios y de integración, `cargo clippy` con `-D warnings` para linting estricto, `rustfmt` para formateo, `cargo audit` para vulnerabilidades.
- **Alternativas consideradas**: Solo tests en frontend (descartado: no cubre la lógica de Rust).
- **Consecuencias**: El pre-commit hook ejecuta toda la suite: ESLint + Clippy + rustfmt + Vitest + cargo test + cargo audit.
```

## Notas para el Init-Agent

1. **Orden de operaciones**:
   - Crear estructura de directorios (src/app/, src/components/, src/shared/tauri/, src-tauri/src/commands/, etc.)
   - Escribir archivos de configuración frontend (package.json, tsconfig, vite.config, etc.)
   - Escribir archivos de Rust (Cargo.toml, main.rs, lib.rs, commands, build.rs)
   - Escribir tauri.conf.json y capabilities/default.json
   - Escribir código fuente de ejemplo frontend + Rust
   - Inicializar husky (`npx husky init` y sobrescribir pre-commit)
   - Actualizar memory/context.md y memory/decisions.md
   - NO hacer `npm install` ni `cargo build`

2. **El usuario debe ejecutar manualmente** después de la inicialización:
   ```bash
   npm install
   npm run prepare           # husky install
   cargo install tauri-cli   # si no está instalado
   npm run tauri:dev         # iniciar app en modo desarrollo
   npm run tauri:build       # build de producción
   ```

3. **Verificaciones post-init**:
   - `npx tsc --noEmit` debe pasar sin errores
   - `npx eslint src/` debe pasar sin errores ni warnings
   - `npx vitest run` debe pasar todos los tests
   - `npx vitest run --coverage` debe mostrar >= 80% en todas las métricas
   - `cd src-tauri && cargo check` debe pasar sin errores
   - `cd src-tauri && cargo clippy -- -D warnings` debe pasar sin warnings
   - `cd src-tauri && cargo test` debe pasar todos los tests Rust

4. **Principios Tauri específicos**:
   - Nunca usar `window.__TAURI__` directamente en el frontend
   - Siempre pasar por wrappers tipados en `src/shared/tauri/commands.ts`
   - Todo `invoke` debe tener tipos de entrada y salida definidos
   - Los comandos Rust devuelven `Result<T, String>` para errores manejables en frontend
   - CSP debe estar presente tanto en `index.html` como en `tauri.conf.json`
   - Las capabilities solo incluyen los permisos estrictamente necesarios
   - No usar `.unwrap()` o `.expect()` en código de producción Rust
   - Usar `thiserror` para errores tipados en Rust
   - Usar `tracing` para logging en Rust (nunca `println!`)
   - El perfil release tiene LTO, codegen-units=1, strip, panic=abort para mínimo tamaño