import { describe, it, expect, vi, afterEach } from 'vitest';
import { openForgotPasswordDialog } from './auth-forgot-password-dialog.element.js';
import { requestPasswordReset } from './auth-api.service.js';
import type * as AuthApiService from './auth-api.service.js';

vi.mock('./auth-api.service.js', async (importOriginal) => {
  const actual = await importOriginal<typeof AuthApiService>();
  return { ...actual, requestPasswordReset: vi.fn() };
});

function getDialog(): HTMLElement {
  const el = document.body.querySelector('auth-forgot-password-dialog');
  expect(el).not.toBeNull();
  return el as HTMLElement;
}

function setEmail(dialog: HTMLElement, value: string): void {
  const input = dialog.shadowRoot!.querySelector('[data-cy="auth-input-email-recuperar"]') as HTMLInputElement;
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe('openForgotPasswordDialog', () => {
  afterEach(() => {
    document.body.querySelectorAll('auth-forgot-password-dialog').forEach((el) => { el.remove(); });
    vi.clearAllMocks();
  });

  it('envío llama a requestPasswordReset, muestra el mensaje genérico, resuelve "sent" al confirmar', async () => {
    vi.mocked(requestPasswordReset).mockResolvedValue(undefined);

    const resultPromise = openForgotPasswordDialog({ apiBaseUrl: 'http://localhost:8080' });
    const dialog = getDialog();
    setEmail(dialog, 'rider@example.com');
    dialog.shadowRoot!.querySelector<HTMLButtonElement>('[data-cy="auth-btn-confirmar-recuperar"]')!.click();
    await flush();

    expect(requestPasswordReset).toHaveBeenCalledWith('http://localhost:8080', 'rider@example.com');
    expect(dialog.shadowRoot!.textContent).toContain('email');

    dialog.shadowRoot!.querySelector<HTMLButtonElement>('[data-cy="auth-btn-confirmar-recuperar"]')!.click();
    expect(await resultPromise).toBe('sent');
  });

  it('cancelar sin enviar resuelve "cancelled" sin llamar a requestPasswordReset', async () => {
    const resultPromise = openForgotPasswordDialog({ apiBaseUrl: 'http://localhost:8080' });
    const dialog = getDialog();

    dialog.shadowRoot!.querySelector<HTMLButtonElement>('[data-cy="auth-btn-cancelar-recuperar"]')!.click();

    expect(await resultPromise).toBe('cancelled');
    expect(requestPasswordReset).not.toHaveBeenCalled();
  });
});
