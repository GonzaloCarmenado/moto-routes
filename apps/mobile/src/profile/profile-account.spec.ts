import { describe, it, expect, vi, afterEach } from 'vitest';
import { ProfileAccountController } from './profile-account.js';
import { openLoginDialog } from '../auth/auth-login-dialog.element.js';
import { APP_EVENTS } from '../shared/app-events.js';
import { MemorySessionRepository } from '../shared/repositories/memory-session.repository.js';

vi.mock('../auth/auth-login-dialog.element.js', () => ({ openLoginDialog: vi.fn() }));
vi.mock('../auth/auth-section.service.js', () => ({
  loadAuthSectionState: vi.fn().mockResolvedValue({ status: 'logged-in', email: 'rider@example.com', username: 'rider42' }),
}));

describe('ProfileAccountController — login interactivo (nombre-usuario, gap de diseño)', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('un login correcto despacha AUTH_LOGGED_IN en window, para que app-root re-compruebe el bloqueo por username', async () => {
    vi.mocked(openLoginDialog).mockResolvedValue('logged-in');
    const sessionRepo = new MemorySessionRepository();
    const controller = new ProfileAccountController({
      getSessionRepository: (): MemorySessionRepository => sessionRepo,
      onChange: (): void => { /* no-op */ },
    });
    const handler = vi.fn();
    window.addEventListener(APP_EVENTS.AUTH_LOGGED_IN, handler);

    try {
      await (controller as unknown as { handleOpenLogin: () => Promise<void> }).handleOpenLogin();
      expect(handler).toHaveBeenCalledTimes(1);
    } finally {
      window.removeEventListener(APP_EVENTS.AUTH_LOGGED_IN, handler);
    }
  });

  it('cancelar el login no despacha AUTH_LOGGED_IN', async () => {
    vi.mocked(openLoginDialog).mockResolvedValue('cancelled');
    const sessionRepo = new MemorySessionRepository();
    const controller = new ProfileAccountController({
      getSessionRepository: (): MemorySessionRepository => sessionRepo,
      onChange: (): void => { /* no-op */ },
    });
    const handler = vi.fn();
    window.addEventListener(APP_EVENTS.AUTH_LOGGED_IN, handler);

    try {
      await (controller as unknown as { handleOpenLogin: () => Promise<void> }).handleOpenLogin();
      expect(handler).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener(APP_EVENTS.AUTH_LOGGED_IN, handler);
    }
  });
});
