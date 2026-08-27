import { fetchJson, ExternalApiError } from './external-api.service.js';
import { sessionStore } from '../session/session.store.js';
import { dispatchSessionInvalidated } from '../session/session-events.js';

/**
 * `fetchJson` con el token de sesión de operador adjunto. Una respuesta 401
 * invalida la sesión localmente y avisa a `app.element.ts` (evento
 * `session-invalidated`) para volver al login — centralizado aquí en vez de
 * repetido por cada servicio que consulta `apps/api` (design.md, requirement
 * "Una sesión que deja de ser válida no expone datos parciales").
 */
export async function authorizedFetch<T>(url: string): Promise<T> {
  const token = sessionStore.getToken();
  try {
    return await fetchJson<T>(url, { headers: { Authorization: `Bearer ${token ?? ''}` } });
  } catch (err) {
    if (err instanceof ExternalApiError && err.status === 401) {
      sessionStore.clear();
      dispatchSessionInvalidated();
    }
    throw err;
  }
}
