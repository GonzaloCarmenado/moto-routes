/**
 * Cliente específico de la API pública NHTSA vPIC (vehicle catalog),
 * construido sobre `fetchJson` (`shared/http/external-api.service.ts`).
 * Vive en `src/profile/` (no en `shared/`) porque hoy solo el dominio
 * `profile` lo consume — ver decisión de diseño #2 de `perfil-usuario.plan.md`.
 */
import { fetchJson } from '../shared/http/external-api.service.js';
import type { VehicleType } from '../shared/models/index.js';
import type { VpicMakeResult, VpicModelEntry, VpicModelResult } from './vpic.types.js';

const VPIC_BASE_URL = 'https://vpic.nhtsa.dot.gov/api/vehicles';

/**
 * Consulta las marcas disponibles para un tipo de vehículo dado.
 * Cualquier `ExternalApiError` lanzado por `fetchJson` se propaga tal cual
 * (mismo `kind`, sin envolver) para que el llamador pueda reaccionar
 * (reintento, mensaje de error) sin perder información.
 * @param type - Tipo de vehículo (`motorcycle` o `car`).
 * @returns Nombres de marca, ordenados alfabéticamente.
 */
export async function fetchVehicleMakes(type: VehicleType): Promise<string[]> {
  const result = await fetchJson<VpicMakeResult>(
    `${VPIC_BASE_URL}/GetMakesForVehicleType/${type}?format=json`,
  );
  return result.Results.map((entry) => entry.MakeName).sort((a, b) => a.localeCompare(b));
}

/**
 * Filtra modelos por tipo de vehículo de forma defensiva y best-effort:
 * si algún resultado trae `VehicleTypeName`, filtra por él; si ninguno lo
 * trae (shape real esperado de `GetModelsForMake` según la documentación
 * pública de vPIC — ver decisión de diseño #10 de `perfil-usuario.plan.md`),
 * devuelve todos los modelos sin filtrar ni lanzar error.
 * @param entries - Modelos devueltos por la API.
 * @param type - Tipo de vehículo elegido por el usuario.
 * @returns Los modelos filtrados por tipo, o todos si la API no informa tipo.
 */
function filterModelsByVehicleType(
  entries: VpicModelEntry[],
  type: VehicleType,
): VpicModelEntry[] {
  const hasTypeInfo = entries.some((entry) => entry.VehicleTypeName !== undefined);
  if (!hasTypeInfo) {
    return entries;
  }
  return entries.filter((entry) => entry.VehicleTypeName?.toLowerCase().includes(type));
}

/**
 * Consulta los modelos disponibles para una marca, filtrados de forma
 * best-effort por tipo de vehículo (ver `filterModelsByVehicleType`).
 * Cualquier `ExternalApiError` lanzado por `fetchJson` se propaga tal cual.
 * @param make - Nombre de la marca (tal como la devolvió `fetchVehicleMakes`).
 * @param type - Tipo de vehículo elegido por el usuario.
 * @returns Nombres de modelo.
 */
export async function fetchVehicleModels(make: string, type: VehicleType): Promise<string[]> {
  const result = await fetchJson<VpicModelResult>(
    `${VPIC_BASE_URL}/GetModelsForMake/${encodeURIComponent(make)}?format=json`,
  );
  return filterModelsByVehicleType(result.Results, type).map((entry) => entry.Model_Name);
}
