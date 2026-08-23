/**
 * Capa de orquestación de perfil: conecta el modal de vehículo
 * (`profile-vehicle-dialog.element.ts`) con `IProfileRepository` y expone la
 * subida del avatar de cuenta (`identidad-cuenta`) al servidor. Mantiene
 * `profile.element.ts` (Paso 13) delgado, siguiendo la separación
 * `.service.ts` (acceso a datos) / `.transform.ts` (cálculo puro) de
 * `frontend-conventions.md` §5.
 *
 * Regla de diseño explícita (AC-024/AC-026): este archivo NUNCA importa nada
 * de `vpic.service.ts` — el servicio de perfil no decide llamar a la API
 * externa; esa decisión vive únicamente en `profile-vehicle-dialog.element.ts`,
 * disparada por interacción explícita del usuario.
 */
import type { IProfileRepository } from '../shared/models/profile.repository.js';
import type { IRouteRepository } from '../shared/models/route.repository.js';
import type { Profile } from '../shared/models/profile.types.js';
import { uploadAccountAvatar } from '../shared/http/avatar-api.service.js';
import { computeProfileStats, type ProfileStats } from './profile.transform.js';

/** Datos ya resueltos para pintar la pantalla de Perfil (vehículo). Nombre y avatar vienen de la cuenta (ver `ProfileAccountController`), no de aquí. */
export interface ProfileViewModel {
  /** Vehículo guardado si los tres campos están presentes, o `null` si no hay vehículo configurado. */
  vehicle: Pick<Profile, 'vehicleType' | 'vehicleMake' | 'vehicleModel'> | null;
}

/**
 * Resuelve el vehículo del view-model: solo se considera "configurado" si
 * los tres campos (tipo, marca, modelo) están presentes a la vez.
 * @param profile - Perfil leído del repositorio.
 * @returns El vehículo, o `null` si falta cualquiera de los tres campos.
 */
function resolveVehicle(profile: Profile): ProfileViewModel['vehicle'] {
  if (profile.vehicleType && profile.vehicleMake && profile.vehicleModel) {
    return {
      vehicleType: profile.vehicleType,
      vehicleMake: profile.vehicleMake,
      vehicleModel: profile.vehicleModel,
    };
  }
  return null;
}

/**
 * Carga el perfil guardado y lo resuelve a un view-model listo para pintar.
 * Lee únicamente de `repo` — nunca consulta la API externa (AC-024): la
 * visualización normal de la pantalla de Perfil siempre viene de la BBDD local.
 * @param repo - Repositorio de perfil.
 * @returns View-model con el vehículo, o `vehicle: null` si nunca se guardó ninguno.
 */
export async function loadProfile(repo: IProfileRepository): Promise<ProfileViewModel> {
  const profile = await repo.get();
  if (!profile) return { vehicle: null };
  return { vehicle: resolveVehicle(profile) };
}

/**
 * Sube un avatar nuevo para la cuenta autenticada (Perfil, `identidad-cuenta`).
 * A diferencia del antiguo avatar local, esto nunca toca `IProfileRepository`:
 * el avatar vive solo en el servidor, sustituyendo cualquier avatar anterior
 * de la misma cuenta. El llamante es responsable de refrescar el avatar
 * mostrado tras una subida correcta (ver `ProfileAccountController.refresh`).
 * @param apiBaseUrl - URL base de `apps/api`.
 * @param token - Token de sesión de la cuenta autenticada.
 * @param file - Imagen elegida por el usuario.
 */
export async function saveAccountAvatar(apiBaseUrl: string, token: string, file: File): Promise<void> {
  await uploadAccountAvatar(apiBaseUrl, token, file, file.name);
}

/**
 * Persiste el vehículo tras el modal "Editar vehículo" (AC-021), reemplazando
 * cualquier vehículo guardado previamente. No toca el avatar/nombre de cuenta
 * (AC-022): el patch solo incluye los tres campos del vehículo.
 * @param repo - Repositorio de perfil.
 * @param vehicle - Tipo, marca y modelo elegidos.
 * @returns El perfil ya persistido.
 */
export async function saveVehicle(
  repo: IProfileRepository,
  vehicle: Pick<Profile, 'vehicleType' | 'vehicleMake' | 'vehicleModel'>,
): Promise<Profile> {
  return repo.save(vehicle);
}

/**
 * Calcula las estadísticas agregadas del Bloque 3 a partir de todas las
 * rutas guardadas, delegando el cálculo puro en `computeProfileStats`
 * (el filtro por `status === 'completed'` ya está cubierto a nivel de
 * función pura — aquí solo se confirma el cableado con el repositorio).
 * @param routeRepo - Repositorio de rutas.
 * @returns Las estadísticas calculadas, o `null` si no hay rutas completadas.
 */
export async function loadRouteStats(routeRepo: IRouteRepository): Promise<ProfileStats | null> {
  const routes = await routeRepo.getAll();
  return computeProfileStats(routes);
}
