import { SqliteStopTypesCacheRepository } from './sqlite-stop-types-cache.repository.js';
import { MemoryStopTypesCacheRepository } from './memory-stop-types-cache.repository.js';
import { createSqliteDb } from './sqlite-route.factory.js';
import type { IStopTypesCacheRepository } from '../models/stop-types-cache.repository.js';

/**
 * Crea la caché del catálogo de tipos de parada: SQLite si el plugin Tauri
 * está disponible, memoria en cualquier otro caso (navegador de desarrollo,
 * o el propio plugin fallando). Mismo patrón de fallback que ya usan
 * `apps/mobile/src/app/app.element.ts` y `cockpit.element.ts` para
 * `IRouteRepository`/`IProfileRepository`, centralizado aquí porque
 * `IStopTypesCacheRepository` se instancia igual en ambos sitios.
 */
export async function createStopTypesCacheRepository(): Promise<IStopTypesCacheRepository> {
  try {
    const db = await createSqliteDb();
    return new SqliteStopTypesCacheRepository(db);
  } catch {
    return new MemoryStopTypesCacheRepository();
  }
}
