import type { IStopTypesCacheRepository } from '../models/stop-types-cache.repository.js';
import type { StopType } from '../stop-types/stop-types.types.js';

/**
 * Implementación en memoria de IStopTypesCacheRepository.
 * Usada para tests y desarrollo web (sin Tauri). NO persistente.
 */
export class MemoryStopTypesCacheRepository implements IStopTypesCacheRepository {
  private types: StopType[] = [];

  replaceAll(types: StopType[]): Promise<void> {
    this.types = [...types];
    return Promise.resolve();
  }

  getAll(): Promise<StopType[]> {
    return Promise.resolve([...this.types]);
  }
}
