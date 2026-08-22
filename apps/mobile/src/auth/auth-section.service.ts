import { fetchCurrentUser, AuthApiError } from './auth-api.service.js';
import type { ISessionRepository } from '../shared/models/session.repository.js';

export type AuthSectionState = { status: 'logged-out' } | { status: 'logged-in'; email: string; username: string | null };

/**
 * Resuelve el estado de sesión a mostrar en la sección "Cuenta" de Perfil.
 * Si hay una sesión guardada, la revalida contra `GET /api/auth/me` (nunca
 * se confía ciegamente en la caché local): un `401` confirmado significa que
 * el token ya no es válido — se borra la sesión local y se cae a
 * `logged-out`. Cualquier otro fallo (red, timeout) mantiene la sesión
 * guardada en caché de forma optimista — perder la sesión solo por estar
 * sin conexión sería peor experiencia que mostrar un email potencialmente
 * desactualizado unos segundos.
 */
export async function loadAuthSectionState(
  apiBaseUrl: string,
  sessionRepository: ISessionRepository,
): Promise<AuthSectionState> {
  const session = await sessionRepository.get();
  if (!session) return { status: 'logged-out' };

  try {
    const user = await fetchCurrentUser(apiBaseUrl, session.token);
    return { status: 'logged-in', email: user.email, username: user.username };
  } catch (err) {
    if (err instanceof AuthApiError && err.kind === 'unauthorized') {
      await sessionRepository.clear();
      return { status: 'logged-out' };
    }
    // La sesión local (`Session`) no guarda el username — solo lo conoce `/me`, que ahora mismo ha fallado.
    return { status: 'logged-in', email: session.email, username: null };
  }
}
