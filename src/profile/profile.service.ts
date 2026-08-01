/**
 * Capa de orquestación de perfil: conecta los diálogos de edición
 * (`profile-edit-dialog.element.ts`, `profile-vehicle-dialog.element.ts`) con
 * `IProfileRepository` y aplica las reglas de negocio que esos componentes de
 * presentación delegan explícitamente en el llamador (nombre vacío no se
 * persiste, avatar sin cambiar no se toca, etc.). Mantiene `profile.element.ts`
 * (Paso 13) delgado, siguiendo la separación `.service.ts` (acceso a datos) /
 * `.transform.ts` (cálculo puro) de `frontend-conventions.md` §5.
 *
 * Regla de diseño explícita (AC-024/AC-026): este archivo NUNCA importa nada
 * de `vpic.service.ts` — el servicio de perfil no decide llamar a la API
 * externa; esa decisión vive únicamente en `profile-vehicle-dialog.element.ts`,
 * disparada por interacción explícita del usuario.
 */
import type { IProfileRepository } from '../shared/models/profile.repository.js';
import type { IRouteRepository } from '../shared/models/route.repository.js';
import type { Profile, CreateProfile } from '../shared/models/profile.types.js';
import { savePhotoFile, getPhotoUrl } from '../shared/services/photo-storage.service.js';
import { sanitizeProfileName, computeProfileStats, type ProfileStats } from './profile.transform.js';

/** Datos ya resueltos para pintar la pantalla de Perfil (avatar, nombre, vehículo). */
export interface ProfileViewModel {
  /** URL ya resuelta del avatar (`getPhotoUrl`), o `null` si no se ha configurado ninguno. */
  avatarUrl: string | null;
  /** Nombre guardado, o `null` si no se ha configurado ninguno (el placeholder se resuelve en la vista). */
  name: string | null;
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
 * @returns View-model con avatar/nombre/vehículo, o los tres a `null` si nunca se guardó nada.
 */
export async function loadProfile(repo: IProfileRepository): Promise<ProfileViewModel> {
  const profile = await repo.get();
  if (!profile) return { avatarUrl: null, name: null, vehicle: null };

  const avatarUrl = profile.avatarPath ? await getPhotoUrl(profile.avatarPath) : null;
  return { avatarUrl, name: profile.name, vehicle: resolveVehicle(profile) };
}

/** Parámetros para persistir el modal "Editar perfil" (avatar + nombre). */
export interface SaveProfileInfoParams {
  /** Archivo de foto recién elegido, o `null` si el usuario no cambió el avatar. */
  avatarFile: File | null;
  /** Nombre tal como lo escribió el usuario, sin sanear todavía. */
  rawName: string;
  /** Ruta del avatar actual, informativa — el patch nunca la incluye si `avatarFile` es `null`, dejando que el coalescido de `IProfileRepository.save()` la conserve. */
  currentAvatarPath: string | null;
}

/**
 * Persiste avatar/nombre tras el modal "Editar perfil" (AC-009). Si
 * `avatarFile` no es `null`, guarda el archivo con `savePhotoFile` y añade la
 * ruta devuelta al patch; si es `null`, `avatarPath` no se incluye en el
 * patch, así el coalescido de `save()` conserva la ruta ya guardada. El
 * nombre se sanea con `sanitizeProfileName`; si el resultado queda vacío, no
 * se incluye `name` en el patch, conservando el nombre previo (AC-010).
 * @param repo - Repositorio de perfil.
 * @param params - Foto elegida (o `null`), nombre sin sanear y ruta de avatar actual.
 * @returns El perfil ya persistido.
 */
export async function saveProfileInfo(
  repo: IProfileRepository,
  params: SaveProfileInfoParams,
): Promise<Profile> {
  const patch: CreateProfile = {};

  if (params.avatarFile) {
    patch.avatarPath = await savePhotoFile(params.avatarFile);
  }

  const sanitizedName = sanitizeProfileName(params.rawName);
  if (sanitizedName !== '') {
    patch.name = sanitizedName;
  }

  return repo.save(patch);
}

/**
 * Persiste el vehículo tras el modal "Editar vehículo" (AC-021), reemplazando
 * cualquier vehículo guardado previamente. No toca `avatarPath`/`name`: el
 * patch solo incluye los tres campos del vehículo (AC-022).
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
