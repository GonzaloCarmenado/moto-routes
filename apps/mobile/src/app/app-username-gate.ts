/**
 * Resuelve si el bloqueo por username sin fijar (nombre-usuario, design.md
 * Decisión 3) debe mostrarse — extraído de `app.element.ts::checkUsernameGate()`
 * por el límite de líneas del proyecto (`eslint.config.js`, `max-lines`), no
 * por sufijo `.element`/`.transform` (excepción documentada en `CLAUDE.md`,
 * "Extracción por límite de líneas") — de paso queda testeable de forma
 * aislada, cosa que `app.element.ts` no permite hoy (sin tests unitarios
 * propios en este dominio). Renueva la sesión de forma proactiva antes de la
 * llamada a `/api/auth/me` si hace falta (renovacion-token-sesion).
 */
import { fetchCurrentUser } from '../auth/auth-api.service.js';
import { ensureFreshSession, buildSessionRefresh } from '../auth/session-refresh.service.js';
import type { ISessionRepository } from '../shared/models/session.repository.js';
import type { Session } from '../shared/models/session.types.js';

export interface CheckUsernameGateOptions {
  apiBaseUrl: string;
  sessionRepository: ISessionRepository;
}

/**
 * Devuelve la sesión (ya renovada si hacía falta) si la cuenta todavía no
 * tiene username fijado, o `null` si no hace falta bloquear — sin sesión
 * guardada, con username ya fijado, o ante cualquier fallo de red
 * (best-effort, ver Decisión 4 de `nombre-usuario`).
 */
export async function resolveUsernameGateSession(options: CheckUsernameGateOptions): Promise<Session | null> {
  const stored = await options.sessionRepository.get();
  if (!stored) return null;

  const session = await ensureFreshSession(options.apiBaseUrl, options.sessionRepository, stored);
  try {
    const currentUser = await fetchCurrentUser(
      options.apiBaseUrl,
      session.token,
      buildSessionRefresh(options.apiBaseUrl, options.sessionRepository),
    );
    return currentUser.username === null ? session : null;
  } catch {
    return null;
  }
}
