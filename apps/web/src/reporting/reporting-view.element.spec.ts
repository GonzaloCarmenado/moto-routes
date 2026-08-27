import { describe, it, expect, beforeEach, vi } from 'vitest';
import './reporting-view.element.js';
import './events-list.element.js';
import './host-snapshot.element.js';
import { sessionStore } from '../shared/session/session.store.js';

describe('<reporting-view>', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    sessionStorage.clear();
    vi.restoreAllMocks();
    sessionStore.setToken('token-de-sesion');
  });

  function mount(): HTMLElement {
    const el = document.createElement('reporting-view');
    document.body.appendChild(el);
    return el;
  }

  it('carga correcta: monta events-list y host-snapshot con los datos recibidos', async () => {
    const body = { events: [{ timestamp: '2026-08-26T10:00:00Z', level: 'error', message: 'e' }] };
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(body), { status: 200 })));

    const el = mount();
    const root = el.shadowRoot!;
    await vi.waitFor(() => {
      expect(root.querySelector('events-list')).not.toBeNull();
    });
    expect(root.querySelector('host-snapshot')).not.toBeNull();
    expect(root.querySelector('[data-cy="reporting-button-retry"]')).toBeNull();
  });

  it('fallo de red: muestra el estado de error con acción de reintentar', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockRejectedValue(new TypeError('network down')));

    const el = mount();
    const root = el.shadowRoot!;
    await vi.waitFor(() => {
      expect(root.querySelector('[data-cy="reporting-button-retry"]')).not.toBeNull();
    });
    expect(root.querySelector('events-list')).toBeNull();
  });

  it('reintentar tras un fallo: si la segunda petición funciona, muestra los datos', async () => {
    const okBody = { events: [] };
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new TypeError('network down'))
      .mockResolvedValueOnce(new Response(JSON.stringify(okBody), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const el = mount();
    const root = el.shadowRoot!;
    await vi.waitFor(() => {
      expect(root.querySelector('[data-cy="reporting-button-retry"]')).not.toBeNull();
    });

    root.querySelector<HTMLButtonElement>('[data-cy="reporting-button-retry"]')!.click();

    await vi.waitFor(() => {
      expect(root.querySelector('events-list')).not.toBeNull();
    });
  });
});
