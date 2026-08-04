import type { StopCategory } from '../stop-types/stop-types.types.js';

/**
 * Caché local del catálogo de tipos de parada, para que el modal de
 * selección funcione sin conexión de red durante una ruta.
 * Contrato puro — las implementaciones concretas (SQLite, memoria) no
 * exponen su infraestructura interna.
 */
export interface IStopTypesCacheRepository {
  /** Sustituye el catálogo cacheado por uno nuevo (reemplazo completo, no incremental). */
  replaceAll(types: StopCategory[]): Promise<void>;

  /** Lee el catálogo cacheado — lista vacía si no hay caché todavía. */
  getAll(): Promise<StopCategory[]>;
}
