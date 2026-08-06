import type { Session } from './session.types.js';

/**
 * Interfaz del repositorio de sesión.
 * Contrato puro — las implementaciones concretas (SQLite, memoria) deben
 * cumplir estos métodos sin exponer su infraestructura interna.
 *
 * La sesión es singleton, mismo criterio que `IProfileRepository` (ver
 * `profile.repository.ts`): un único dispositivo, sin concepto de
 * multi-usuario en ningún otro dato de la app — `save()` siempre sustituye
 * la sesión guardada entera, sin coalescido por campo (a diferencia del
 * perfil, aquí no tiene sentido un guardado parcial).
 */
export interface ISessionRepository {
  /** Recupera la sesión guardada — `null` si no hay ninguna. */
  get(): Promise<Session | null>;

  /** Persiste (inserta o sustituye, upsert singleton) la sesión completa. */
  save(session: Session): Promise<void>;

  /** Borra la sesión guardada, si la hay. No hace nada si ya no había ninguna. */
  clear(): Promise<void>;
}
