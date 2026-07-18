import { describe, it, expect, beforeEach, vi } from 'vitest';
import './nav-bar.element.js';

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
});