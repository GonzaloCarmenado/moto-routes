import { describe, it, expect, vi, afterEach } from 'vitest';
import { APP_EVENTS, dispatchAppEvent } from './app-events.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('dispatchAppEvent', () => {
  it('dispatches a CustomEvent on window with the given name and detail', () => {
    const handler = vi.fn();
    window.addEventListener(APP_EVENTS.VIEW_ROUTE, handler);

    dispatchAppEvent(APP_EVENTS.VIEW_ROUTE, { routeId: 'route-42' });

    expect(handler).toHaveBeenCalledTimes(1);
    const event = handler.mock.calls[0]?.[0] as CustomEvent<{ routeId: string }>;
    expect(event.type).toBe('view-route');
    expect(event.detail).toEqual({ routeId: 'route-42' });

    window.removeEventListener(APP_EVENTS.VIEW_ROUTE, handler);
  });

  it('dispatches a payload-less event (detail is null, per the DOM CustomEvent spec)', () => {
    const handler = vi.fn();
    window.addEventListener(APP_EVENTS.NAV_GRABAR, handler);

    dispatchAppEvent(APP_EVENTS.NAV_GRABAR);

    expect(handler).toHaveBeenCalledTimes(1);
    const event = handler.mock.calls[0]?.[0] as CustomEvent<undefined>;
    expect(event.type).toBe('nav-grabar');
    // CustomEvent normaliza un detail undefined/ausente a null.
    expect(event.detail).toBeNull();

    window.removeEventListener(APP_EVENTS.NAV_GRABAR, handler);
  });

  it('exposes the canonical event-name constants', () => {
    expect(APP_EVENTS.NAV_GRABAR).toBe('nav-grabar');
    expect(APP_EVENTS.NAV_RUTAS).toBe('nav-rutas');
    expect(APP_EVENTS.NAV_PERFIL).toBe('nav-perfil');
    expect(APP_EVENTS.VIEW_ROUTE).toBe('view-route');
    expect(APP_EVENTS.BACK_TO_LIST).toBe('back-to-list');
  });

  it('dispatches a payload-less nav-perfil event (detail is null, per the DOM CustomEvent spec)', () => {
    const handler = vi.fn();
    window.addEventListener(APP_EVENTS.NAV_PERFIL, handler);

    dispatchAppEvent(APP_EVENTS.NAV_PERFIL);

    expect(handler).toHaveBeenCalledTimes(1);
    const event = handler.mock.calls[0]?.[0] as CustomEvent<undefined>;
    expect(event.type).toBe('nav-perfil');
    expect(event.detail).toBeNull();

    window.removeEventListener(APP_EVENTS.NAV_PERFIL, handler);
  });
});
