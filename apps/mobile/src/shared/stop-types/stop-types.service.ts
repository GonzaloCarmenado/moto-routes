import type { IStopTypesCacheRepository } from '../models/stop-types-cache.repository.js';
import type { StopType } from './stop-types.types.js';

/** Dependencias de refreshStopTypesCache — inyectadas para poder testear sin red ni Tauri. */
export interface RefreshStopTypesCacheDeps {
  cache: IStopTypesCacheRepository;
  fetchFromApi: (apiBaseUrl: string) => Promise<StopType[]>;
  apiBaseUrl: string;
}

/**
 * Refresca la caché local del catálogo de tipos de parada desde `apps/api`.
 * Best-effort: si la petición falla (sin red, servidor caído), la caché
 * existente se queda tal cual — nunca se propaga el error al llamador.
 */
export async function refreshStopTypesCache(deps: RefreshStopTypesCacheDeps): Promise<void> {
  try {
    const types = await deps.fetchFromApi(deps.apiBaseUrl);
    await deps.cache.replaceAll(types);
  } catch {
    // Sin conexión o API no disponible: se mantiene la caché existente.
  }
}
