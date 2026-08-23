import { refreshSession } from './auth-api.service.js';
import type { ISessionRepository } from '../shared/models/session.repository.js';
import type { Session } from '../shared/models/session.types.js';
import type { SessionRefreshOptions } from '../shared/http/external-api.service.js';

/**
 * Construye la opción `sessionRefresh` de `fetchJson` para cualquier llamada
 * autenticada a `apps/api` (ver renovacion-token-sesion) — un único punto
 * que sabe conectar `refreshSession` con `fetchJson`, para no repetir esta
 * construcción en cada `*-api.service.ts` que la adopte.
 */
export function buildSessionRefresh(apiBaseUrl: string, sessionRepository: ISessionRepository): SessionRefreshOptions {
  return {
    sessionRepository,
    refresh: (refreshToken: string) => refreshSession(apiBaseUrl, refreshToken),
  };
}

/**
 * Si el access token de `session` ya ha expirado y hay un refreshToken
 * guardado, intenta renovarlo de forma proactiva — pensado para la primera
 * llamada autenticada tras abrir la app, evitando una petición que se sabe
 * que va a fallar (ver design.md, "Renovación proactiva al abrir la app").
 * Nunca lanza: si la renovación falla, devuelve `session` tal cual (la
 * llamada real que siga a continuación fallará con 401 de todas formas, y
 * `sessionRefresh` en esa llamada se encargará entonces del camino
 * reactivo).
 */
export async function ensureFreshSession(apiBaseUrl: string, sessionRepository: ISessionRepository, session: Session): Promise<Session> {
  if (!session.refreshToken || !session.expiresAt || session.expiresAt > Date.now()) return session;

  try {
    const refreshed = await refreshSession(apiBaseUrl, session.refreshToken);
    const updated: Session = {
      token: refreshed.token,
      email: session.email,
      refreshToken: refreshed.refreshToken,
      expiresAt: Date.now() + refreshed.expiresIn * 1000,
    };
    await sessionRepository.save(updated);
    return updated;
  } catch {
    return session;
  }
}
