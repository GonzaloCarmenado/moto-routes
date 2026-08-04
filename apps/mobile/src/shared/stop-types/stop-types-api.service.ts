import { fetchJson } from '../http/external-api.service.js';
import type { StopCategory } from './stop-types.types.js';

/**
 * Obtiene el catálogo de tipos de parada real de `apps/api`. Sin
 * autenticación (endpoint público) — reutiliza `fetchJson`, el mismo cliente
 * HTTP genérico ya usado para la API externa de perfil de usuario.
 * @param apiBaseUrl - URL base de `apps/api` (p. ej. `http://localhost:8080`).
 */
export async function fetchStopTypesFromApi(apiBaseUrl: string): Promise<StopCategory[]> {
  return fetchJson<StopCategory[]>(`${apiBaseUrl}/api/stop-types`);
}
