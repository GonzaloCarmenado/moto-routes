import { describe, it, expect, vi, afterEach } from 'vitest';
import { openRouteShareDialog } from './route-share-dialog.element.js';
import { createInvitation } from '../../shared/http/route-sharing-api.service.js';
import type * as RouteSharingApiService from '../../shared/http/route-sharing-api.service.js';

vi.mock('../../shared/http/route-sharing-api.service.js', async (importOriginal) => {
  const actual = await importOriginal<typeof RouteSharingApiService>();
  return { ...actual, createInvitation: vi.fn() };
});

const OPTIONS = { apiBaseUrl: 'http://localhost:8080', token: 'jwt-token', routeId: 'route-1', ownEmail: 'me@example.com' };

function getDialog(): HTMLElement {
  const el = document.body.querySelector('route-share-dialog');
  expect(el).not.toBeNull();
  return el as HTMLElement;
}

function setEmail(dialog: HTMLElement, value: string): void {
  const input = dialog.shadowRoot!.querySelector('[data-cy="route-share-input-email"]') as HTMLInputElement;
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe('openRouteShareDialog', () => {
  afterEach(() => {
    document.body.querySelectorAll('route-share-dialog').forEach((el) => { el.remove(); });
    vi.clearAllMocks();
  });

  it('envío llama a createInvitation, muestra el mensaje genérico, resuelve "sent" al confirmar', async () => {
    vi.mocked(createInvitation).mockResolvedValue(undefined);

    const resultPromise = openRouteShareDialog(OPTIONS);
    const dialog = getDialog();
    setEmail(dialog, 'friend@example.com');
    dialog.shadowRoot!.querySelector<HTMLButtonElement>('[data-cy="route-share-btn-confirmar"]')!.click();
    await flush();

    expect(createInvitation).toHaveBeenCalledWith('http://localhost:8080', 'jwt-token', 'route-1', 'friend@example.com');
    expect(dialog.shadowRoot!.textContent).toContain('Invitación enviada');

    dialog.shadowRoot!.querySelector<HTMLButtonElement>('[data-cy="route-share-btn-confirmar"]')!.click();
    expect(await resultPromise).toBe('sent');
  });

  it('cancelar sin enviar resuelve "cancelled" sin llamar a createInvitation', async () => {
    const resultPromise = openRouteShareDialog(OPTIONS);
    const dialog = getDialog();

    dialog.shadowRoot!.querySelector<HTMLButtonElement>('[data-cy="route-share-btn-cancelar"]')!.click();

    expect(await resultPromise).toBe('cancelled');
    expect(createInvitation).not.toHaveBeenCalled();
  });

  it('compartir con el propio email muestra un error en cliente, sin llamar a createInvitation', async () => {
    void openRouteShareDialog(OPTIONS);
    const dialog = getDialog();
    setEmail(dialog, 'me@example.com');
    dialog.shadowRoot!.querySelector<HTMLButtonElement>('[data-cy="route-share-btn-confirmar"]')!.click();
    await flush();

    expect(createInvitation).not.toHaveBeenCalled();
    expect(dialog.shadowRoot!.querySelector('[data-cy="route-share-error"]')?.textContent).toContain('contigo mismo');
  });

  it('un fallo de red muestra un error en cliente y permite reintentar', async () => {
    vi.mocked(createInvitation).mockRejectedValue(new Error('Network error'));

    void openRouteShareDialog(OPTIONS);
    const dialog = getDialog();
    setEmail(dialog, 'friend@example.com');
    dialog.shadowRoot!.querySelector<HTMLButtonElement>('[data-cy="route-share-btn-confirmar"]')!.click();
    await flush();

    expect(dialog.shadowRoot!.querySelector('[data-cy="route-share-error"]')).not.toBeNull();
    expect(dialog.shadowRoot!.querySelector('[data-cy="route-share-input-email"]')).not.toBeNull();
  });
});
