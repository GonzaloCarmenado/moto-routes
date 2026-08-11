import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import './nav-bar.element.js';

// `?inline` (usado por el propio componente en producción) resuelve a una
// cadena vacía bajo Vitest — este proyecto no activa `test.css` (ver
// vitest.config.ts), así que el import real no sirve para inspeccionar el
// CSS fuente en un test. Se lee el fichero directamente en su lugar.
const cssPath = resolve(process.cwd(), 'src/components/nav-bar/nav-bar.element.css');
const styles = readFileSync(cssPath, 'utf8');

describe('nav-bar', () => {
  let navBar: HTMLElement;

  beforeEach(() => {
    navBar = document.createElement('nav-bar');
    document.body.appendChild(navBar);
  });

  it('renders three buttons with correct data-cy', () => {
    const root = navBar.shadowRoot;
    const rutas = root?.querySelector('[data-cy="nav-rutas"]');
    const grabar = root?.querySelector('[data-cy="nav-grabar"]');
    const perfil = root?.querySelector('[data-cy="nav-perfil"]');

    expect(rutas).not.toBeNull();
    expect(grabar).not.toBeNull();
    expect(perfil).not.toBeNull();
    // sistema-iconos-svg: Rutas y Perfil pasan a icono SVG de línea; Grabar mantiene su record-dot (fuera de alcance).
    expect(rutas?.querySelector('svg')).not.toBeNull();
    expect(perfil?.querySelector('svg')).not.toBeNull();
  });

  it('emits nav-grabar event on window when Grabar button is clicked', () => {
    const root = navBar.shadowRoot;
    const grabarBtn = root?.querySelector('[data-cy="nav-grabar"]') as HTMLButtonElement;

    const handler = vi.fn();
    window.addEventListener('nav-grabar', handler);
    grabarBtn?.click();

    expect(handler).toHaveBeenCalledOnce();
    window.removeEventListener('nav-grabar', handler);
  });

  it('buttons Rutas and Perfil do not emit nav-grabar', () => {
    const root = navBar.shadowRoot;
    const rutasBtn = root?.querySelector('[data-cy="nav-rutas"]') as HTMLButtonElement;
    const perfilBtn = root?.querySelector('[data-cy="nav-perfil"]') as HTMLButtonElement;

    const handler = vi.fn();
    window.addEventListener('nav-grabar', handler);

    // Click on Rutas — should not trigger nav-grabar
    rutasBtn?.click();
    expect(handler).not.toHaveBeenCalled();

    // Click on Perfil — should not trigger nav-grabar
    perfilBtn?.click();
    expect(handler).not.toHaveBeenCalled();
    window.removeEventListener('nav-grabar', handler);
  });

  it('Grabar button has active class', () => {
    const root = navBar.shadowRoot;
    const grabarBtn = root?.querySelector('[data-cy="nav-grabar"]');

    expect(grabarBtn?.classList.contains('nav-item--active')).toBe(true);
    expect(grabarBtn?.classList.contains('nav-item--record')).toBe(true);
  });

  it('does not have the record button DOM structure changed by the visual fix (data-cy and children unchanged) (AC-018)', () => {
    const root = navBar.shadowRoot;
    const grabarBtn = root?.querySelector('[data-cy="nav-grabar"]');

    expect(grabarBtn?.getAttribute('data-cy')).toBe('nav-grabar');
    expect(grabarBtn?.querySelector('.record-dot')).not.toBeNull();
    expect(grabarBtn?.querySelector('.nav-label')?.textContent).toBe('Grabar');
  });

  it('emits nav-perfil event on window when Perfil button is clicked (AC-035)', () => {
    const root = navBar.shadowRoot;
    const perfilBtn = root?.querySelector('[data-cy="nav-perfil"]') as HTMLButtonElement;

    const handler = vi.fn();
    window.addEventListener('nav-perfil', handler);
    perfilBtn?.click();

    expect(handler).toHaveBeenCalledOnce();
    window.removeEventListener('nav-perfil', handler);
  });

  it('setting activeView to "profile" marks Perfil active and Grabar/Rutas inactive (AC-036)', () => {
    const root = navBar.shadowRoot;
    (navBar as HTMLElement & { activeView: 'cockpit' | 'routes' | 'profile' }).activeView = 'profile';

    const perfilBtn = root?.querySelector('[data-cy="nav-perfil"]');
    const grabarBtn = root?.querySelector('[data-cy="nav-grabar"]');
    const rutasBtn = root?.querySelector('[data-cy="nav-rutas"]');

    expect(perfilBtn?.classList.contains('nav-item--active')).toBe(true);
    expect(grabarBtn?.classList.contains('nav-item--active')).toBe(false);
    expect(rutasBtn?.classList.contains('nav-item--active')).toBe(false);
  });

  it('setting activeView to "routes" marks Rutas active and the other two inactive (regression: Rutas never toggled active before)', () => {
    const root = navBar.shadowRoot;
    (navBar as HTMLElement & { activeView: 'cockpit' | 'routes' | 'profile' }).activeView = 'routes';

    const perfilBtn = root?.querySelector('[data-cy="nav-perfil"]');
    const grabarBtn = root?.querySelector('[data-cy="nav-grabar"]');
    const rutasBtn = root?.querySelector('[data-cy="nav-rutas"]');

    expect(rutasBtn?.classList.contains('nav-item--active')).toBe(true);
    expect(grabarBtn?.classList.contains('nav-item--active')).toBe(false);
    expect(perfilBtn?.classList.contains('nav-item--active')).toBe(false);
  });

  it('defaults to "cockpit" as active view without assigning activeView explicitly (regression)', () => {
    const root = navBar.shadowRoot;
    const grabarBtn = root?.querySelector('[data-cy="nav-grabar"]');
    const rutasBtn = root?.querySelector('[data-cy="nav-rutas"]');
    const perfilBtn = root?.querySelector('[data-cy="nav-perfil"]');

    expect(grabarBtn?.classList.contains('nav-item--active')).toBe(true);
    expect(rutasBtn?.classList.contains('nav-item--active')).toBe(false);
    expect(perfilBtn?.classList.contains('nav-item--active')).toBe(false);
  });
});

describe('nav-bar CSS — centrado del punto en el botón Grabar (AC-018)', () => {
  it('no longer positions .record-dot with a fixed "top" offset coupled to the button padding (root cause of the off-center bug)', () => {
    // El bug original: `top: 20px` en .record-dot no descontaba el `padding: 4px`
    // heredado de .nav-item, dejando el punto ~4px por encima del centro real
    // del círculo. Cualquier valor de "top" numérico reintroduciría ese mismo
    // acoplamiento frágil — el fix debe ser estructural, no un ajuste a ojo.
    const recordDotBlock = styles.slice(styles.indexOf('.record-dot'));
    expect(recordDotBlock).not.toMatch(/top:\s*\d/);
  });

  it('positions .record-dot on the same grid cell as .nav-item--record::before, so centering is independent of container padding', () => {
    const beforeBlockMatch = /\.nav-item--record::before\s*\{([^}]*)\}/.exec(styles);
    const dotBlockMatch = /\.nav-item--record \.record-dot\s*\{([^}]*)\}/.exec(styles);
    expect(beforeBlockMatch).not.toBeNull();
    expect(dotBlockMatch).not.toBeNull();

    const gridPlacement = (block: string): string | null => {
      const areaMatch = /grid-area:\s*([\w-]+)/.exec(block);
      if (areaMatch) return areaMatch[1] ?? null;
      const rowMatch = /grid-row:\s*([\w\d-]+)/.exec(block);
      const colMatch = /grid-column:\s*([\w\d-]+)/.exec(block);
      return rowMatch && colMatch ? `${rowMatch[1]!}/${colMatch[1]!}` : null;
    };

    const beforePlacement = gridPlacement(beforeBlockMatch![1]!);
    const dotPlacement = gridPlacement(dotBlockMatch![1]!);
    expect(beforePlacement).not.toBeNull();
    expect(beforePlacement).toBe(dotPlacement);
  });
});