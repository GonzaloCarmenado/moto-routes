import { describe, it, expect, vi, afterEach } from 'vitest';
import './username-edit-dialog.element.js';
import { openUsernameEditDialog } from './username-edit-dialog.element.js';
import { setUsername, AuthApiError } from './auth-api.service.js';
import type * as AuthApiService from './auth-api.service.js';

vi.mock('./auth-api.service.js', async (importOriginal) => {
  const actual = await importOriginal<typeof AuthApiService>();
  return { ...actual, setUsername: vi.fn() };
});

function dialogRoot(): ShadowRoot {
  return document.body.querySelector('username-edit-dialog')!.shadowRoot!;
}

function formEl(): HTMLElement {
  return dialogRoot().querySelector('username-form')!;
}

function formInput(): HTMLInputElement {
  return formEl().shadowRoot!.querySelector('[data-cy="username-form-input"]') as HTMLInputElement;
}

function formSubmitBtn(): HTMLButtonElement {
  return formEl().shadowRoot!.querySelector('[data-cy="username-form-btn-guardar"]') as HTMLButtonElement;
}

function setInput(el: HTMLInputElement, value: string): void {
  el.value = value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe('username-edit-dialog', () => {
  afterEach(() => {
    document.body.querySelectorAll('username-edit-dialog').forEach((el) => { el.remove(); });
    vi.clearAllMocks();
  });

  it('se abre con el username-form embebido prellenado con currentUsername', () => {
    void openUsernameEditDialog({ apiBaseUrl: 'http://localhost:8080', token: 'jwt-token', currentUsername: 'rider42' });

    expect(formInput().value).toBe('rider42');
  });

  it('clicking Cancelar resuelve con cancelled y no llama a setUsername', async () => {
    const resultPromise = openUsernameEditDialog({ apiBaseUrl: 'http://localhost:8080', token: 'jwt-token', currentUsername: 'rider42' });

    (dialogRoot().querySelector('[data-cy="username-edit-dialog-btn-cancelar"]') as HTMLButtonElement).click();

    await expect(resultPromise).resolves.toEqual({ action: 'cancelled' });
    expect(setUsername).not.toHaveBeenCalled();
    expect(document.body.querySelector('username-edit-dialog')).toBeNull();
  });

  it('guardar un username disponible resuelve con saved y el nuevo username, y cierra el diálogo', async () => {
    vi.mocked(setUsername).mockResolvedValue(undefined);
    const resultPromise = openUsernameEditDialog({ apiBaseUrl: 'http://localhost:8080', token: 'jwt-token', currentUsername: null });

    setInput(formInput(), 'newname');
    formSubmitBtn().click();
    await flush();

    await expect(resultPromise).resolves.toEqual({ action: 'saved', username: 'newname' });
    expect(document.body.querySelector('username-edit-dialog')).toBeNull();
  });

  it('si el backend rechaza por username ya en uso, el diálogo permanece abierto mostrando el error', async () => {
    vi.mocked(setUsername).mockRejectedValue(new AuthApiError('username-taken', 'username already taken'));
    void openUsernameEditDialog({ apiBaseUrl: 'http://localhost:8080', token: 'jwt-token', currentUsername: null });

    setInput(formInput(), 'newname');
    formSubmitBtn().click();
    await flush();

    expect(document.body.querySelector('username-edit-dialog')).not.toBeNull();
    expect(formEl().shadowRoot!.querySelector('[data-cy="username-form-error"]')).not.toBeNull();
  });

  it('intentar guardar vacío no llama al backend ni cierra el diálogo (validación en cliente del username-form)', async () => {
    void openUsernameEditDialog({ apiBaseUrl: 'http://localhost:8080', token: 'jwt-token', currentUsername: null });

    formSubmitBtn().click();
    await flush();

    expect(setUsername).not.toHaveBeenCalled();
    expect(document.body.querySelector('username-edit-dialog')).not.toBeNull();
  });

  it('clicking el overlay resuelve con cancelled', async () => {
    const resultPromise = openUsernameEditDialog({ apiBaseUrl: 'http://localhost:8080', token: 'jwt-token', currentUsername: 'rider42' });

    (dialogRoot().querySelector('.overlay') as HTMLElement).click();

    await expect(resultPromise).resolves.toEqual({ action: 'cancelled' });
  });
});
