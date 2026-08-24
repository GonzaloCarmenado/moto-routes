import { describe, it, expect, vi, afterEach } from 'vitest';
import { openRouteShareDialog } from './route-share-dialog.element.js';
import { FRIEND_SELECTOR_SELECTED_EVENT } from '../../shared/friend-selector/friend-selector.element.js';
import { createInvitation } from '../../shared/http/route-sharing-api.service.js';
import type * as RouteSharingApiService from '../../shared/http/route-sharing-api.service.js';
import { fetchCurrentUser } from '../../auth/auth-api.service.js';
import type * as AuthApiService from '../../auth/auth-api.service.js';

vi.mock('../../shared/http/route-sharing-api.service.js', async (importOriginal) => {
  const actual = await importOriginal<typeof RouteSharingApiService>();
  return { ...actual, createInvitation: vi.fn() };
});

vi.mock('../../auth/auth-api.service.js', async (importOriginal) => {
  const actual = await importOriginal<typeof AuthApiService>();
  return {
    ...actual,
    fetchCurrentUser: vi.fn().mockResolvedValue({ id: 1, email: 'me@example.com', emailVerified: true, username: 'me' }),
  };
});

const OPTIONS = { apiBaseUrl: 'http://localhost:8080', token: 'jwt-token', routeId: 'route-1' };

function getDialog(): HTMLElement {
  const el = document.body.querySelector('route-share-dialog');
  expect(el).not.toBeNull();
  return el as HTMLElement;
}

/**
 * Simula la selección de un candidato en `<friend-selector>` despachando su
 * evento de selección directamente sobre el elemento — mismo criterio que
 * `friends-view.element.spec.ts`: el flujo de búsqueda con debounce ya está
 * cubierto por los tests propios de `friend-selector.element.spec.ts`.
 */
function selectFriend(dialog: HTMLElement, username: string): void {
  const selector = dialog.shadowRoot!.querySelector('friend-selector')!;
  selector.dispatchEvent(new CustomEvent(FRIEND_SELECTOR_SELECTED_EVENT, { detail: { username }, bubbles: true, composed: true }));
}

async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe('openRouteShareDialog', () => {
  afterEach(() => {
    document.body.querySelectorAll('route-share-dialog').forEach((el) => { el.remove(); });
    vi.clearAllMocks();
  });

  it('envío llama a createInvitation con el username elegido, muestra el mensaje genérico, resuelve "sent" al confirmar', async () => {
    vi.mocked(createInvitation).mockResolvedValue(undefined);

    const resultPromise = openRouteShareDialog(OPTIONS);
    const dialog = getDialog();
    selectFriend(dialog, 'friend1');
    dialog.shadowRoot!.querySelector<HTMLButtonElement>('[data-cy="route-share-btn-confirmar"]')!.click();
    await flush();

    expect(createInvitation).toHaveBeenCalledWith('http://localhost:8080', 'jwt-token', 'route-1', 'friend1');
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

  it('compartir con el propio username muestra un error en cliente como defensa en profundidad, sin llamar a createInvitation', async () => {
    void openRouteShareDialog(OPTIONS);
    const dialog = getDialog();
    await flush();
    // El propio <friend-selector> ya excluye la cuenta propia de sus
    // resultados — este evento simula que llegara igual (tasks.md 6.1).
    selectFriend(dialog, 'me');
    dialog.shadowRoot!.querySelector<HTMLButtonElement>('[data-cy="route-share-btn-confirmar"]')!.click();
    await flush();

    expect(createInvitation).not.toHaveBeenCalled();
    expect(dialog.shadowRoot!.querySelector('[data-cy="route-share-error"]')?.textContent).toContain('contigo mismo');
  });

  it('un fallo de red muestra un error en cliente y permite reintentar', async () => {
    vi.mocked(createInvitation).mockRejectedValue(new Error('Network error'));

    void openRouteShareDialog(OPTIONS);
    const dialog = getDialog();
    selectFriend(dialog, 'friend1');
    dialog.shadowRoot!.querySelector<HTMLButtonElement>('[data-cy="route-share-btn-confirmar"]')!.click();
    await flush();

    expect(dialog.shadowRoot!.querySelector('[data-cy="route-share-error"]')).not.toBeNull();
    expect(dialog.shadowRoot!.querySelector('friend-selector')).not.toBeNull();
  });

  it('pasa apiBaseUrl, token y excludeUsername (una vez resuelto) al friend-selector', async () => {
    void openRouteShareDialog(OPTIONS);
    const dialog = getDialog();
    await flush();

    const selector = dialog.shadowRoot!.querySelector('friend-selector') as HTMLElement & {
      apiBaseUrl: string;
      token: string;
      excludeUsername: string | null;
    };
    expect(selector.apiBaseUrl).toBe('http://localhost:8080');
    expect(selector.token).toBe('jwt-token');
    expect(selector.excludeUsername).toBe('me');
    expect(fetchCurrentUser).toHaveBeenCalledWith('http://localhost:8080', 'jwt-token');
  });
});
