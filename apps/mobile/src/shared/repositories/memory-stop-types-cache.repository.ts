import type { IStopTypesCacheRepository } from '../models/stop-types-cache.repository.js';
import type { StopCategory } from '../stop-types/stop-types.types.js';

/**
 * Implementación en memoria de IStopTypesCacheRepository.
 * Usada para tests y desarrollo web (sin Tauri). NO persistente.
 */
export class MemoryStopTypesCacheRepository implements IStopTypesCacheRepository {
  private types: StopCategory[] = [];

  replaceAll(types: StopCategory[]): Promise<void> {
    this.types = [...types];
    return Promise.resolve();
  }

  getAll(): Promise<StopCategory[]> {
    return Promise.resolve([...this.types]);
  }
}
