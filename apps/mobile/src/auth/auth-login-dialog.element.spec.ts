import { describe, it, expect, vi, afterEach } from 'vitest';
import { openLoginDialog } from './auth-login-dialog.element.js';
import { loginAccount, requestEmailVerification, AuthApiError } from './auth-api.service.js';
import type * as AuthApiService from './auth-api.service.js';
import { MemorySessionRepository } from '../shared/repositories/memory-session.repository.js';

vi.mock('./auth-api.service.js', async (importOriginal) => {
  const actual = await importOriginal<typeof AuthApiService>();
  return { ...actual, loginAccount: vi.fn(), requestEmailVerification: vi.fn() };
});

function getDialog(): HTMLElement {
  const el = document.body.querySelector('auth-login-dialog');
  expect(el).not.toBeNull();
  return el as HTMLElement;
}

function setInput(dialog: HTMLElement, dataCy: string, value: string): void {
  const input = dialog.shadowRoot!.querySelector(`[data-cy="${dataCy}"]`) as HTMLInputElement;
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function click(dialog: HTMLElement, dataCy: string): void {
  (dialog.shadowRoot!.querySelector(`[data-cy="${dataCy}"]`) as HTMLButtonElement).click();
}

function errorMessage(dialog: HTMLElement): string | null {
  return dialog.shadowRoot!.querySelector('.error')?.textContent ?? null;
}

async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe('openLoginDialog', () => {
  afterEach(() => {
    document.body.querySelectorAll('auth-login-dialog').forEach((el) => { el.remove(); });
    vi.clearAllMocks();
  });

  it('login correcto guarda la sesión, cierra el diálogo y resuelve "logged-in"', async () => {
    vi.mocked(loginAccount).mockResolvedValue({ token: 'jwt-token' });
    const sessionRepository = new MemorySessionRepository();

    const resultPromise = openLoginDialog({ apiBaseUrl: 'http://localhost:8080', sessionRepository });
    const dialog = getDialog();
    setInput(dialog, 'auth-input-email-login', 'rider@example.com');
    setInput(dialog, 'auth-input-password-login', 'correct-horse-battery');
    click(dialog, 'auth-btn-confirmar-login');
    await flush();

    expect(await resultPromise).toBe('logged-in');
    await expect(sessionRepository.get()).resolves.toEqual({ token: 'jwt-token', email: 'rider@example.com' });
    expect(document.body.querySelector('auth-login-dialog')).toBeNull();
  });

  it('error invalid-credentials se muestra inline, sin guardar sesión, diálogo abierto', async () => {
    vi.mocked(loginAccount).mockRejectedValue(new AuthApiError('invalid-credentials', 'invalid email or password'));
    const sessionRepository = new MemorySessionRepository();

    void openLoginDialog({ apiBaseUrl: 'http://localhost:8080', sessionRepository });
    const dialog = getDialog();
    setInput(dialog, 'auth-input-email-login', 'rider@example.com');
    setInput(dialog, 'auth-input-password-login', 'wrong-password');
    click(dialog, 'auth-btn-confirmar-login');
    await flush();

    expect(errorMessage(dialog)).not.toBeNull();
    await expect(sessionRepository.get()).resolves.toBeNull();
    expect(document.body.querySelector('auth-login-dialog')).not.toBeNull();
    expect(dialog.shadowRoot!.querySelector('[data-cy="auth-btn-reenviar-verificacion"]')).toBeNull();
  });

  it('error email-not-verified muestra un mensaje distinto con botón de reenvío', async () => {
    vi.mocked(loginAccount).mockRejectedValue(
      new AuthApiError('email-not-verified', 'email not verified, check your inbox for the verification link'),
    );
    const sessionRepository = new MemorySessionRepository();

    void openLoginDialog({ apiBaseUrl: 'http://localhost:8080', sessionRepository });
    const dialog = getDialog();
    setInput(dialog, 'auth-input-email-login', 'rider@example.com');
    setInput(dialog, 'auth-input-password-login', 'correct-horse-battery');
    click(dialog, 'auth-btn-confirmar-login');
    await flush();

    expect(dialog.shadowRoot!.querySelector('[data-cy="auth-btn-reenviar-verificacion"]')).not.toBeNull();
  });

  it('pulsar "Reenviar email de verificación" llama a requestEmailVerification y muestra confirmación sin cerrar ni reintentar login', async () => {
    vi.mocked(loginAccount).mockRejectedValue(new AuthApiError('email-not-verified', 'email not verified'));
    vi.mocked(requestEmailVerification).mockResolvedValue(undefined);
    const sessionRepository = new MemorySessionRepository();

    void openLoginDialog({ apiBaseUrl: 'http://localhost:8080', sessionRepository });
    const dialog = getDialog();
    setInput(dialog, 'auth-input-email-login', 'rider@example.com');
    setInput(dialog, 'auth-input-password-login', 'correct-horse-battery');
    click(dialog, 'auth-btn-confirmar-login');
    await flush();

    click(dialog, 'auth-btn-reenviar-verificacion');
    await flush();

    expect(requestEmailVerification).toHaveBeenCalledWith('http://localhost:8080', 'rider@example.com');
    expect(loginAccount).toHaveBeenCalledTimes(1);
    expect(document.body.querySelector('auth-login-dialog')).not.toBeNull();
    expect(dialog.shadowRoot!.textContent).toContain('enviado');
  });

  it('cancelar sin enviar resuelve "cancelled"', async () => {
    const sessionRepository = new MemorySessionRepository();
    const resultPromise = openLoginDialog({ apiBaseUrl: 'http://localhost:8080', sessionRepository });
    const dialog = getDialog();

    click(dialog, 'auth-btn-cancelar-login');

    expect(await resultPromise).toBe('cancelled');
    expect(loginAccount).not.toHaveBeenCalled();
  });
});
