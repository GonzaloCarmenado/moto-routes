import type { Profile, CreateProfile } from './profile.types.js';

/**
 * Interfaz del repositorio de perfil.
 * Contrato puro — las implementaciones concretas (SQLite, memoria) deben
 * cumplir estos métodos sin exponer su infraestructura interna.
 *
 * El perfil es singleton (ver `perfil-usuario.md`, Constraints): nunca existe
 * más de una fila de perfil, y `save()` siempre actúa como upsert sobre esa
 * única fila.
 *
 * `save()` hace un **coalescido por campo**: cada campo presente en el patch
 * (`CreateProfile`) sobrescribe el valor guardado; cada campo ausente del
 * patch conserva el valor ya persistido (o `null` si nunca se guardó nada
 * todavía). Por ejemplo, `save({ vehicleType: 'motorcycle', vehicleMake:
 * 'Honda', vehicleModel: 'CB500X' })` no borra `name`/`avatarPath` ya
 * guardados, porque esos campos no están presentes en el patch — la
 * comprobación real es de presencia de la clave (`'campo' in patch`), no de
 * `!== undefined`, para poder distinguir en el futuro "campo no incluido" de
 * "campo incluido y puesto explícitamente a `null`" sin ambigüedad.
 */
export interface IProfileRepository {
  /** Recupera el perfil guardado — `null` si todavía no se ha guardado nada (AC-002/AC-003/AC-015). */
  get(): Promise<Profile | null>;

  /** Persiste (inserta o actualiza, upsert singleton) un patch parcial del perfil, con coalescido por campo — ver JSDoc de la interfaz. */
  save(profile: CreateProfile): Promise<Profile>;
}
