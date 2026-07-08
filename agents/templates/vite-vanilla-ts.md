# Template: Vite Vanilla TypeScript

## Identidad
- **Nombre**: vite-vanilla-ts
- **Descripción**: Frontend vanilla con TypeScript estricto, Vite como bundler, Web Components nativos, Vitest para testing, ESLint con reglas estrictas, y Husky para pre-commit hooks.
- **Tipo**: Frontend SPA
- **Complejidad**: Media

## Stack Tecnológico
| Componente | Tecnología | Versión |
|------------|-----------|---------|
| Runtime | TypeScript | ^5.7 |
| Bundler | Vite | ^6.0 |
| UI | Web Components nativos (Custom Elements v1) | - |
| Testing | Vitest | ^3.0 |
| Linting | ESLint | ^9.0 |
| Formatting | Prettier | ^3.0 |
| Git Hooks | Husky | ^9.0 |
| Package Manager | npm | latest |

## Estructura de Carpetas Resultante

```
src/
├── app/
│   └── app.element.ts          # Componente raíz <app-root>
├── components/
│   └── counter/
│       ├── counter.element.ts   # Ejemplo: <app-counter>
│       └── counter.element.spec.ts
├── shared/
│   ├── styles/
│   │   └── shared.css
│   └── utils/
│       └── dom.ts
├── index.css
└── main.ts                      # Entry point

tests/
└── setup.ts                     # Test setup global

specs/features/                  # (existente, no modificar)
```

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
    "prepare": "husky"
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
    "jsdom": "^25.0.0"
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
  "exclude": ["node_modules", "dist"]
}
```

### 3. vite.config.ts

```typescript
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    target: 'es2022',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: undefined, // SPA simple: un solo bundle
      },
    },
    // Avisar si el bundle supera 200KB (buena práctica)
    chunkSizeWarningLimit: 200,
  },
  server: {
    open: true,
  },
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

### 5. eslint.config.js (ESLint flat config)

```javascript
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['dist/', 'node_modules/', 'coverage/'],
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
      // Reglas extra estrictas
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
      // Buenas prácticas generales
      'no-console': 'warn',
      'prefer-const': 'error',
      'no-var': 'error',
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

echo "🔍 Ejecutando ESLint..."
npx eslint src/ --max-warnings 0 || exit 1

echo "🧪 Ejecutando tests unitarios..."
npx vitest run --coverage --silent || exit 1

echo "✅ Pre-commit checks superados"
```

(El init-agent debe ejecutar: `npx husky init` y luego sobrescribir el hook)

### 8. index.html

```html
<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="Basic Template SDD" />
    <title>Basic Template</title>
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
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

const app = document.createElement('app-root');
document.body.appendChild(app);
```

### 10. src/app/app.element.ts

```typescript
import { BaseElement } from '../shared/base-element.js';
import styles from './app.element.css?inline';

class AppRoot extends BaseElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback(): void {
    this.render();
  }

  protected render(): void {
    if (!this.shadowRoot) return;

    const style = document.createElement('style');
    style.textContent = styles;

    const main = document.createElement('main');
    main.innerHTML = `
      <h1>Basic Template SDD</h1>
      <p>TypeScript + Vite + Web Components</p>
    `;

    this.shadowRoot.innerHTML = '';
    this.shadowRoot.appendChild(style);
    this.shadowRoot.appendChild(main);
  }
}

customElements.define('app-root', AppRoot);
```

### 11. src/shared/base-element.ts

```typescript
/**
 * Clase base para todos los Web Components del proyecto.
 * Extiende HTMLElement con utilidades comunes.
 */
export abstract class BaseElement extends HTMLElement {
  /**
   * Dispara un evento personalizado con la tipificación adecuada.
   */
  protected emit<T>(name: string, detail: T): void {
    this.dispatchEvent(
      new CustomEvent<T>(name, {
        detail,
        bubbles: true,
        composed: true,
      }),
    );
  }

  /**
   * Método abstracto que cada componente debe implementar para renderizar.
   */
  protected abstract render(): void;
}
```

### 12. src/shared/utils/dom.ts

```typescript
/**
 * Helper para crear elementos DOM con atributos de forma declarativa.
 */
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

### 13. src/index.css

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

### 14. tests/setup.ts

```typescript
import '@testing-library/jest-dom/vitest';
```

### 15. src/components/counter/counter.element.ts (ejemplo con tests)

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
      <button id="decrement">-</button>
      <span>${this._count}</span>
      <button id="increment">+</button>
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
  it('debería renderizar con valor inicial 0', () => {
    const counter = document.createElement('app-counter');
    document.body.appendChild(counter);

    const span = counter.shadowRoot?.querySelector('span');
    expect(span?.textContent).toBe('0');

    document.body.removeChild(counter);
  });

  it('debería incrementar al hacer click en +', () => {
    const counter = document.createElement('app-counter');
    document.body.appendChild(counter);

    const incrementBtn = counter.shadowRoot?.getElementById(
      'increment',
    ) as HTMLButtonElement;
    incrementBtn?.click();

    const span = counter.shadowRoot?.querySelector('span');
    expect(span?.textContent).toBe('1');

    document.body.removeChild(counter);
  });

  it('debería decrementar al hacer click en -', () => {
    const counter = document.createElement('app-counter');
    document.body.appendChild(counter);

    const decrementBtn = counter.shadowRoot?.getElementById(
      'decrement',
    ) as HTMLButtonElement;
    decrementBtn?.click();

    const span = counter.shadowRoot?.querySelector('span');
    expect(span?.textContent).toBe('-1');

    document.body.removeChild(counter);
  });

  it('debería emitir evento counter-changed al cambiar', () => {
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

### 17. .gitignore (completar si no existe o no tiene estas entradas)

```gitignore
node_modules/
dist/
coverage/
*.local
*.log
.DS_Store
```

### Actualizaciones a memory/context.md

El init-agent debe actualizar el archivo `memory/context.md` con:

```markdown
## Stack Tecnológico
- **Lenguaje**: TypeScript 5.7 (strict mode)
- **Bundler**: Vite 6
- **UI**: Web Components nativos (Custom Elements v1)
- **Testing**: Vitest 3 (jsdom, coverage v8) → 80% threshold
- **Linting**: ESLint 9 (strictTypeChecked + stylistic)
- **Formatting**: Prettier 3
- **Git Hooks**: Husky 9 (pre-commit: lint + test)
- **Package Manager**: npm

## Quality Gates
- **Test pass rate**: 100% (todos los tests deben pasar)
- **Code coverage**: 80% (lines, functions, branches, statements)
- **AC coverage**: 100% (cada criterio de aceptación debe tener al menos un test)
- **ESLint**: 0 warnings, 0 errors
- **Prettier**: Código formateado
- **Build**: tsc sin errores + vite build exitoso
```

### Actualizaciones a memory/decisions.md

El init-agent debe registrar estos ADR:

```markdown
## ADR-009: Stack frontend - TypeScript + Vite + Web Components
- **Fecha**: [fecha actual]
- **Estado**: Aceptada
- **Contexto**: Se necesita un stack frontend ligero, sin frameworks pesados, con tipado estricto y buena DX.
- **Decisión**: TypeScript 5.7 con Vite 6 como bundler, Web Components nativos para UI, Vitest 3 para testing.
- **Alternativas consideradas**: React (descartado: demasiado pesado para el scope), Svelte (descartado: curva de aprendizaje), Lit (descartado: dependencia extra, los Web Components nativos son suficientes).
- **Consecuencias**: Sin dependencias de framework. Los componentes se registran con customElements.define(). El tipado estricto de TypeScript previene errores en tiempo de compilación.

## ADR-010: ESLint strict + Prettier + Husky
- **Fecha**: [fecha actual]
- **Estado**: Aceptada
- **Contexto**: Se necesita garantizar calidad de código consistente y prevenir commits que rompan el build.
- **Decisión**: ESLint 9 con reglas strictTypeChecked + stylistic, Prettier 3 para formateo, Husky 9 con pre-commit hook.
- **Alternativas consideradas**: Biome (descartado: menos maduro que ESLint + Prettier).
- **Consecuencias**: El pre-commit hook ejecuta ESLint (0 warnings) y tests con cobertura. Commits que no pasen son rechazados.

## ADR-011: Quality gates - 80% coverage en 4 métricas
- **Fecha**: [fecha actual]
- **Estado**: Aceptada
- **Contexto**: El threshold de cobertura del 80% definido en ADR-008 se aplica a las 4 métricas de Vitest (lines, functions, branches, statements).
- **Decisión**: Configurar cobertura con Vitest + v8 provider. Threshold: 80% en las 4 métricas.
- **Alternativas consideradas**: Istanbul (descartado: v8 es más rápido y nativo de Vitest).
- **Consecuencias**: Los tests deben cubrir al menos el 80% en todas las métricas. El pre-commit hook verifica esto.
```

## Notas para el Init-Agent

1. **Orden de operaciones**:
   - Crear estructura de directorios primero
   - Escribir archivos de configuración
   - Escribir código fuente de ejemplo
   - Inicializar husky (`npx husky init` y sobrescribir pre-commit)
   - Actualizar memory/context.md y memory/decisions.md
   - NO hacer `npm install`

2. **El usuario debe ejecutar manualmente** después de la inicialización:
   ```bash
   npm install
   npm run prepare   # husky install
   npm run dev       # iniciar servidor de desarrollo
   ```

3. **Verificaciones post-init**:
   - `npx tsc --noEmit` debe pasar sin errores
   - `npx eslint src/` debe pasar sin errores ni warnings
   - `npx vitest run` debe pasar todos los tests
   - `npx vitest run --coverage` debe mostrar ≥80% en todas las métricas

4. **Principios de Web Components** a respetar:
   - Usar Custom Elements v1 (no v0 legacy)
   - Encapsular estilos con Shadow DOM
   - Comunicación padre-hijo: atributos y eventos (no props directas)
   - Seguir el ciclo de vida estándar: constructor → connectedCallback → disconnectedCallback → attributeChangedCallback → adoptedCallback

5. **Principios de rendimiento** a respetar:
   - No añadir dependencias innecesarias (mantener bundle ligero)
   - Usar `?inline` en imports de CSS para inlinearlos en el Shadow DOM (evita FOUC)
   - Evitar lógica pesada en connectedCallback (diferir a requestAnimationFrame si es necesario)
   - Lazy loading de componentes: solo registrar los que se usan en cada vista