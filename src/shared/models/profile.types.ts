/**
 * Modelos de dominio para el perfil de usuario.
 * Entidad pura — sin dependencias de DOM, Tauri ni ningún framework.
 * El perfil es singleton: no existe autenticación ni multi-usuario en el
 * proyecto, así que solo existe una fila de perfil local (ver `perfil-usuario.md`).
 */

/** Tipo de vehículo del perfil: moto o coche — nunca ambos a la vez. */
export type VehicleType = 'motorcycle' | 'car';

/** Perfil de usuario guardado (entidad de lectura). Todos los campos son opcionales por diseño: cualquiera de ellos puede no estar configurado todavía. */
export interface Profile {
  /** Ruta local del archivo de avatar (ver `photo-storage.service.ts`) — `null` si no se ha configurado ningún avatar. */
  avatarPath: string | null;
  /** Nombre elegido por el usuario — `null` si no se ha configurado ningún nombre. */
  name: string | null;
  /** Tipo del vehículo guardado — `null` si no hay ningún vehículo configurado. */
  vehicleType: VehicleType | null;
  /** Marca del vehículo guardado — `null` si no hay ningún vehículo configurado. */
  vehicleMake: string | null;
  /** Modelo del vehículo guardado — `null` si no hay ningún vehículo configurado. */
  vehicleModel: string | null;
}

/**
 * Datos para crear o actualizar el perfil (escritura, patch parcial).
 * Solo los campos presentes en el objeto se sobrescriben; los campos ausentes
 * conservan el valor ya guardado (coalescido por campo — ver `IProfileRepository.save`).
 */
export type CreateProfile = Partial<Profile>;
