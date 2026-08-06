import type { ISessionRepository } from '../models/session.repository.js';
import type { Session } from '../models/session.types.js';

/**
 * Implementación en memoria de ISessionRepository.
 * Usada para tests y desarrollo web (sin Tauri).
 * NO persistente — los datos se pierden al recargar la página.
 */
export class MemorySessionRepository implements ISessionRepository {
  private session: Session | null = null;

  get(): Promise<Session | null> {
    return Promise.resolve(this.session);
  }

  save(session: Session): Promise<void> {
    this.session = { ...session };
    return Promise.resolve();
  }

  clear(): Promise<void> {
    this.session = null;
    return Promise.resolve();
  }
}
