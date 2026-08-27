import { fetchJson, ExternalApiError } from '../shared/http/external-api.service.js';
import { sessionStore } from '../shared/session/session.store.js';
import type { AdminStatusProbeResponse } from './login.types.js';

/**
 * Error de login — un único mensaje genérico (design.md, capability
 * `dashboard-login`): nunca distingue credencial incorrecta de un fallo de red,
 * para no dar ninguna pista sobre qué tan cerca estaba una credencial de ser válida.
 */
export class LoginError extends Error {
  constructor() {
    super('No se pudo iniciar sesión. Comprueba la credencial e inténtalo de nuevo.');
    this.name = 'LoginError';
  }
}

/**
 * Valida `token` contra el propio endpoint de reporting (sin backend de login
 * dedicado, ver design.md Decisión 2) y, si es válido, abre la sesión de
 * operador. Lanza `LoginError` en cualquier fallo, sin distinguir la causa.
 */
export async function login(token: string): Promise<void> {
  try {
    await fetchJson<AdminStatusProbeResponse>('/admin/status', {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (err) {
    if (err instanceof ExternalApiError || err instanceof Error) {
      throw new LoginError();
    }
    throw err;
  }
  sessionStore.setToken(token);
}
