import { describe, it, expect, beforeEach, vi } from 'vitest';
import './app.element.js';
import { sessionStore } from '../shared/session/session.store.js';
import { dispatchSessionInvalidated } from '../shared/session/session-events.js';

describe('<app-root>', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
    document.body.innerHTML = '';
    window.history.pushState(null, '', '/');
  });

  function mount(): HTMLElement {
    const el = document.createElement('app-root');
    document.body.appendChild(el);
    return el;
  }

  it('sin sesión: muestra login-view y redirige la URL a /login', () => {
    const el = mount();
    expect(el.querySelector('login-view')).not.toBeNull();
    expect(window.location.pathname).toBe('/login');
  });

  it('acceso directo a la URL raíz sin sesión: redirige a /login sin mostrar contenido privado', () => {
    window.history.pushState(null, '', '/');
    const el = mount();
    expect(el.querySelector('[data-cy="app-shell-private"]')).toBeNull();
    expect(window.location.pathname).toBe('/login');
  });

  it('con sesión válida: muestra el área privada, no el login', () => {
    sessionStore.setToken('token-de-sesion');
    const el = mount();
    expect(el.querySelector('[data-cy="app-shell-private"]')).not.toBeNull();
    expect(el.querySelector('login-view')).toBeNull();
  });

  it('login-view-success: pasa del login al área privada', () => {
    const el = mount();
    el.querySelector('login-view')?.dispatchEvent(new CustomEvent('login-view-success', { bubbles: true, composed: true }));
    expect(el.querySelector('[data-cy="app-shell-private"]')).not.toBeNull();
  });

  it('cerrar sesión: vuelve al login y borra el token', () => {
    sessionStore.setToken('token-de-sesion');
    const el = mount();
    el.querySelector<HTMLButtonElement>('[data-cy="dashboard-button-logout"]')?.click();
    expect(sessionStore.getToken()).toBeNull();
    expect(el.querySelector('login-view')).not.toBeNull();
  });

  it('session-invalidated: vuelve al login aunque hubiera un área privada montada', () => {
    sessionStore.setToken('token-de-sesion');
    mount();
    dispatchSessionInvalidated();
    expect(document.querySelector('login-view')).not.toBeNull();
    expect(document.querySelector('[data-cy="app-shell-private"]')).toBeNull();
  });
});
