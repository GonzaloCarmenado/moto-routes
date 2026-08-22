import { describe, it, expect, vi, afterEach } from 'vitest';
import './username-form.element.js';
import { setUsername, AuthApiError } from './auth-api.service.js';
import type * as AuthApiService from './auth-api.service.js';
import { USERNAME_FORM_SUCCESS_EVENT, type UsernameFormSuccessDetail } from './username-form.types.js';

vi.mock('./auth-api.service.js', async (importOriginal) => {
  const actual = await importOriginal<typeof AuthApiService>();
  return { ...actual, setUsername: vi.fn() };
});

interface UsernameFormEl extends HTMLElement {
  apiBaseUrl: string;
  token: string;
  currentUsername: string | null;
}

function mount(currentUsername: string | null = null): { el: UsernameFormEl; root: ShadowRoot } {
  const el = document.createElement('username-form') as UsernameFormEl;
  el.apiBaseUrl = 'http://localhost:8080';
  el.token = 'jwt-token';
  el.currentUsername = currentUsername;
  document.body.appendChild(el);
  return { el, root: el.shadowRoot! };
}

function input(root: ShadowRoot): HTMLInputElement {
  return root.querySelector('[data-cy="username-form-input"]') as HTMLInputElement;
}

function submitBtn(root: ShadowRoot): HTMLButtonElement {
  return root.querySelector('[data-cy="username-form-btn-guardar"]') as HTMLButtonElement;
}

function errorText(root: ShadowRoot): string | null {
  return root.querySelector('[data-cy="username-form-error"]')?.textContent ?? null;
}

function setInput(el: HTMLInputElement, value: string): void {
  el.value = value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe('username-form', () => {
  afterEach(() => {
    document.body.querySelectorAll('username-form').forEach((el) => { el.remove(); });
    vi.clearAllMocks();
  });

  it('sin username actual, arranca con el campo vacío', () => {
    const { root } = mount(null);
    expect(input(root).value).toBe('');
  });

  it('con username actual (edición), arranca con el campo relleno', () => {
    const { root } = mount('rider42');
    expect(input(root).value).toBe('rider42');
  });

  it('no llama al backend si el formato es inválido en cliente (sin llamar a setUsername)', async () => {
    const { root } = mount();
    setInput(input(root), 'ab');
    submitBtn(root).click();
    await flush();

    expect(setUsername).not.toHaveBeenCalled();
    expect(errorText(root)).not.toBeNull();
  });

  it('no llama al backend si el campo está vacío', async () => {
    const { root } = mount();
    submitBtn(root).click();
    await flush();

    expect(setUsername).not.toHaveBeenCalled();
  });

  it('envío válido llama a setUsername y despacha USERNAME_FORM_SUCCESS_EVENT con el username', async () => {
    vi.mocked(setUsername).mockResolvedValue(undefined);
    const { el, root } = mount();
    const handler = vi.fn();
    el.addEventListener(USERNAME_FORM_SUCCESS_EVENT, ((e: CustomEvent<UsernameFormSuccessDetail>) => { handler(e.detail); }) as EventListener);

    setInput(input(root), 'newname');
    submitBtn(root).click();
    await flush();

    expect(setUsername).toHaveBeenCalledWith('http://localhost:8080', 'jwt-token', 'newname');
    expect(handler).toHaveBeenCalledWith({ username: 'newname' });
  });

  it('muestra el error del backend si setUsername falla (p. ej. ya en uso), sin despachar éxito', async () => {
    vi.mocked(setUsername).mockRejectedValue(new AuthApiError('username-taken', 'username already taken'));
    const { el, root } = mount();
    const handler = vi.fn();
    el.addEventListener(USERNAME_FORM_SUCCESS_EVENT, handler);

    setInput(input(root), 'newname');
    submitBtn(root).click();
    await flush();

    expect(errorText(root)).not.toBeNull();
    expect(handler).not.toHaveBeenCalled();
  });

  it('no incluye ningún botón de cancelar (decisión del contenedor, no del formulario)', () => {
    const { root } = mount();
    expect(root.querySelector('[data-cy="username-form-btn-cancelar"]')).toBeNull();
  });
});
