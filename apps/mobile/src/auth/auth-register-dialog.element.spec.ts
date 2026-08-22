import { describe, it, expect, vi, afterEach } from 'vitest';
import { openRegisterDialog } from './auth-register-dialog.element.js';
import { registerAccount, AuthApiError } from './auth-api.service.js';
import type * as AuthApiService from './auth-api.service.js';

vi.mock('./auth-api.service.js', async (importOriginal) => {
  const actual = await importOriginal<typeof AuthApiService>();
  return { ...actual, registerAccount: vi.fn() };
});

function getDialog(): HTMLElement {
  const el = document.body.querySelector('auth-register-dialog');
  expect(el).not.toBeNull();
  return el as HTMLElement;
}

function emailInput(dialog: HTMLElement): HTMLInputElement {
  return dialog.shadowRoot!.querySelector('[data-cy="auth-input-email-registro"]') as HTMLInputElement;
}

function passwordInput(dialog: HTMLElement): HTMLInputElement {
  return dialog.shadowRoot!.querySelector('[data-cy="auth-input-password-registro"]') as HTMLInputElement;
}

function usernameInput(dialog: HTMLElement): HTMLInputElement {
  return dialog.shadowRoot!.querySelector('[data-cy="auth-input-username-registro"]') as HTMLInputElement;
}

function setInput(input: HTMLInputElement, value: string): void {
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function confirmButton(dialog: HTMLElement): HTMLButtonElement {
  return dialog.shadowRoot!.querySelector('[data-cy="auth-btn-confirmar-registro"]') as HTMLButtonElement;
}

function cancelButton(dialog: HTMLElement): HTMLButtonElement {
  return dialog.shadowRoot!.querySelector('[data-cy="auth-btn-cancelar-registro"]') as HTMLButtonElement;
}

function errorMessage(dialog: HTMLElement): string | null {
  return dialog.shadowRoot!.querySelector('.error')?.textContent ?? null;
}

async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe('openRegisterDialog', () => {
  afterEach(() => {
    document.body.querySelectorAll('auth-register-dialog').forEach((el) => { el.remove(); });
    vi.clearAllMocks();
  });

  it('envío correcto llama a registerAccount, muestra el mensaje de verificación pendiente y resuelve "registered"', async () => {
    vi.mocked(registerAccount).mockResolvedValue({ id: 1, email: 'rider@example.com', username: 'rider42' });

    const resultPromise = openRegisterDialog({ apiBaseUrl: 'http://localhost:8080' });
    const dialog = getDialog();
    setInput(emailInput(dialog), 'rider@example.com');
    setInput(passwordInput(dialog), 'correct-horse-battery');
    setInput(usernameInput(dialog), 'rider42');
    confirmButton(dialog).click();
    await flush();

    expect(registerAccount).toHaveBeenCalledWith('http://localhost:8080', 'rider@example.com', 'correct-horse-battery', 'rider42');
    expect(dialog.shadowRoot!.textContent).toContain('verifica');
    // Todavía no se cierra hasta que el usuario lo confirme.
    expect(document.body.querySelector('auth-register-dialog')).not.toBeNull();

    dialog.shadowRoot!.querySelector<HTMLButtonElement>('[data-cy="auth-btn-confirmar-registro"]')!.click();
    expect(await resultPromise).toBe('registered');
  });

  it('error email-taken se muestra inline sin cerrar el diálogo', async () => {
    vi.mocked(registerAccount).mockRejectedValue(new AuthApiError('email-taken', 'email already registered'));

    const resultPromise = openRegisterDialog({ apiBaseUrl: 'http://localhost:8080' });
    const dialog = getDialog();
    setInput(emailInput(dialog), 'rider@example.com');
    setInput(passwordInput(dialog), 'correct-horse-battery');
    confirmButton(dialog).click();
    await flush();

    expect(errorMessage(dialog)).not.toBeNull();
    expect(document.body.querySelector('auth-register-dialog')).not.toBeNull();

    cancelButton(dialog).click();
    expect(await resultPromise).toBe('cancelled');
  });

  it('error weak-password se muestra inline sin cerrar el diálogo', async () => {
    vi.mocked(registerAccount).mockRejectedValue(
      new AuthApiError('weak-password', 'password does not meet the minimum complexity policy'),
    );

    void openRegisterDialog({ apiBaseUrl: 'http://localhost:8080' });
    const dialog = getDialog();
    setInput(emailInput(dialog), 'rider@example.com');
    setInput(passwordInput(dialog), 'short');
    setInput(usernameInput(dialog), 'rider42');
    confirmButton(dialog).click();
    await flush();

    expect(errorMessage(dialog)).not.toBeNull();
  });

  it('error username-taken se muestra inline sin cerrar el diálogo', async () => {
    vi.mocked(registerAccount).mockRejectedValue(new AuthApiError('username-taken', 'username already taken'));

    void openRegisterDialog({ apiBaseUrl: 'http://localhost:8080' });
    const dialog = getDialog();
    setInput(emailInput(dialog), 'rider@example.com');
    setInput(passwordInput(dialog), 'correct-horse-battery');
    setInput(usernameInput(dialog), 'rider42');
    confirmButton(dialog).click();
    await flush();

    expect(errorMessage(dialog)).not.toBeNull();
  });

  it('conserva el email, la contraseña y el username escritos tras un error (no los pierde al re-renderizar)', async () => {
    vi.mocked(registerAccount).mockRejectedValue(new AuthApiError('email-taken', 'email already registered'));

    void openRegisterDialog({ apiBaseUrl: 'http://localhost:8080' });
    const dialog = getDialog();
    setInput(emailInput(dialog), 'rider@example.com');
    setInput(passwordInput(dialog), 'correct-horse-battery');
    setInput(usernameInput(dialog), 'rider42');
    confirmButton(dialog).click();
    await flush();

    expect(emailInput(dialog).value).toBe('rider@example.com');
    expect(passwordInput(dialog).value).toBe('correct-horse-battery');
    expect(usernameInput(dialog).value).toBe('rider42');
  });

  it('cancelar sin enviar resuelve "cancelled" sin llamar a registerAccount', async () => {
    const resultPromise = openRegisterDialog({ apiBaseUrl: 'http://localhost:8080' });
    const dialog = getDialog();

    cancelButton(dialog).click();

    expect(await resultPromise).toBe('cancelled');
    expect(registerAccount).not.toHaveBeenCalled();
  });
});
