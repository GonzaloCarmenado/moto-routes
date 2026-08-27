import { describe, it, expect, beforeEach, vi } from 'vitest';
import './login-view.element.js';
import { LOGIN_VIEW_SUCCESS_EVENT } from './login-view.types.js';

describe('<login-view>', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  function mount(): HTMLElement {
    const el = document.createElement('login-view');
    document.body.appendChild(el);
    return el;
  }

  function shadowOf(el: HTMLElement): ShadowRoot {
    const root = el.shadowRoot;
    if (!root) throw new Error('login-view sin shadow root');
    return root;
  }

  it('renderiza el input de token y el botón de envío con sus data-cy', () => {
    const el = mount();
    const root = shadowOf(el);
    expect(root.querySelector('[data-cy="login-input-token"]')).not.toBeNull();
    expect(root.querySelector('[data-cy="login-button-submit"]')).not.toBeNull();
  });

  it('credencial correcta: despacha login-view-success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"events":[]}', { status: 200 })));
    const el = mount();
    const root = shadowOf(el);
    const onSuccess = vi.fn();
    el.addEventListener(LOGIN_VIEW_SUCCESS_EVENT, onSuccess);

    root.querySelector<HTMLInputElement>('[data-cy="login-input-token"]')!.value = 'token-valido';
    root.querySelector<HTMLButtonElement>('[data-cy="login-button-submit"]')!.click();
    await vi.waitFor(() => { expect(onSuccess).toHaveBeenCalledOnce(); });
  });

  it('credencial incorrecta: muestra un único mensaje de error genérico, sin despachar éxito', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 401 })));
    const el = mount();
    const root = shadowOf(el);
    const onSuccess = vi.fn();
    el.addEventListener(LOGIN_VIEW_SUCCESS_EVENT, onSuccess);

    root.querySelector<HTMLInputElement>('[data-cy="login-input-token"]')!.value = 'token-malo';
    root.querySelector<HTMLButtonElement>('[data-cy="login-button-submit"]')!.click();

    await vi.waitFor(() => {
      expect(root.querySelector('[data-cy="login-error-message"]')?.textContent).toBeTruthy();
    });
    expect(onSuccess).not.toHaveBeenCalled();
  });
});
