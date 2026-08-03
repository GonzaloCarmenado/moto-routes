import type { IProfileRepository } from '../models/profile.repository.js';
import type { Profile, CreateProfile } from '../models/profile.types.js';

/** Perfil vacío por defecto, usado como base del coalescido cuando no se ha guardado nada todavía. */
const EMPTY_PROFILE: Profile = {
  avatarPath: null,
  name: null,
  vehicleType: null,
  vehicleMake: null,
  vehicleModel: null,
};

/**
 * Implementación en memoria de IProfileRepository.
 * Usada para tests y desarrollo web (sin Tauri).
 * NO persistente — los datos se pierden al recargar la página.
 */
export class MemoryProfileRepository implements IProfileRepository {
  private profile: Profile | null = null;

  get(): Promise<Profile | null> {
    return Promise.resolve(this.profile);
  }

  /**
   * Carga un perfil directamente, sin pasar por la lógica de coalescido de `save()`
   * (pensada para el flujo normal de guardado parcial por campos). Usado por el
   * mecanismo de siembra de tests (`applyCypressSeed`), exclusivo de entornos
   * navegador/desarrollo — nunca invocado en Tauri.
   */
  seed(profile: Profile): void {
    this.profile = { ...profile };
  }

  save(patch: CreateProfile): Promise<Profile> {
    const existing = this.profile ?? EMPTY_PROFILE;

    // Coalescido por campo: 'campo' in patch distingue "no incluido en el patch"
    // (conserva el valor existente) de "incluido explícitamente" (sobrescribe,
    // incluso a null si así se pasa) — ver JSDoc de IProfileRepository.save().
    const merged: Profile = {
      avatarPath: 'avatarPath' in patch ? (patch.avatarPath ?? null) : existing.avatarPath,
      name: 'name' in patch ? (patch.name ?? null) : existing.name,
      vehicleType: 'vehicleType' in patch ? (patch.vehicleType ?? null) : existing.vehicleType,
      vehicleMake: 'vehicleMake' in patch ? (patch.vehicleMake ?? null) : existing.vehicleMake,
      vehicleModel: 'vehicleModel' in patch ? (patch.vehicleModel ?? null) : existing.vehicleModel,
    };

    this.profile = merged;
    return Promise.resolve(merged);
  }
}
