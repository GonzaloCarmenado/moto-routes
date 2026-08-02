/**
 * Cliente específico de la API pública NHTSA vPIC (vehicle catalog),
 * construido sobre `fetchJson` (`shared/http/external-api.service.ts`).
 * Vive en `src/profile/` (no en `shared/`) porque hoy solo el dominio
 * `profile` lo consume — ver decisión de diseño #2 de `perfil-usuario.plan.md`.
 */
import { fetchJson } from '../shared/http/external-api.service.js';
import type { VehicleType } from '../shared/models/index.js';
import type { VpicMakeResult, VpicModelResult } from './vpic.types.js';

const VPIC_BASE_URL = 'https://vpic.nhtsa.dot.gov/api/vehicles';

/** Marca de vehículo tal como la expone `fetchVehicleMakes` — conserva el `id` de vPIC, necesario para `fetchVehicleModels`. */
export interface VehicleMake {
  id: number;
  name: string;
}

/**
 * Consulta las marcas disponibles para un tipo de vehículo dado.
 * Cualquier `ExternalApiError` lanzado por `fetchJson` se propaga tal cual
 * (mismo `kind`, sin envolver) para que el llamador pueda reaccionar
 * (reintento, mensaje de error) sin perder información.
 * @param type - Tipo de vehículo (`motorcycle` o `car`).
 * @returns Marcas (id + nombre), ordenadas alfabéticamente por nombre.
 */
export async function fetchVehicleMakes(type: VehicleType): Promise<VehicleMake[]> {
  const result = await fetchJson<VpicMakeResult>(
    `${VPIC_BASE_URL}/GetMakesForVehicleType/${type}?format=json`,
  );
  return result.Results
    .map((entry) => ({ id: entry.MakeId, name: entry.MakeName }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Consulta los modelos de una marca, filtrados por tipo de vehículo.
 *
 * `GetModelsForMake/{make}` (el endpoint "obvio") nunca informa el tipo de
 * vehículo de cada modelo — verificado contra la API real el 2026-08-02: un
 * fabricante que vende coches y motos (p. ej. Honda) devuelve ambos mezclados
 * sin ningún campo que permita distinguirlos. El único endpoint de vPIC que sí
 * filtra por tipo es `GetModelsForMakeIdYear/makeId/{id}/modelyear/{year}/vehicletype/{type}`
 * (confirmado con datos reales), pero exige un año de modelo concreto —
 * se usa el año actual. Si esa consulta no devuelve nada (marca discontinuada,
 * o vPIC sin datos para ese año concreto), se recurre a `GetModelsForMake`
 * sin filtrar antes que no mostrar ningún modelo.
 * @param makeId - Identificador vPIC de la marca (de `fetchVehicleMakes`).
 * @param makeName - Nombre de la marca (para el fallback sin filtrar).
 * @param type - Tipo de vehículo elegido por el usuario.
 * @returns Nombres de modelo.
 */
export async function fetchVehicleModels(makeId: number, makeName: string, type: VehicleType): Promise<string[]> {
  const year = new Date().getFullYear();
  const filtered = await fetchJson<VpicModelResult>(
    `${VPIC_BASE_URL}/GetModelsForMakeIdYear/makeId/${String(makeId)}/modelyear/${String(year)}/vehicletype/${type}?format=json`,
  );
  if (filtered.Results.length > 0) {
    return filtered.Results.map((entry) => entry.Model_Name);
  }

  const unfiltered = await fetchJson<VpicModelResult>(
    `${VPIC_BASE_URL}/GetModelsForMake/${encodeURIComponent(makeName)}?format=json`,
  );
  return unfiltered.Results.map((entry) => entry.Model_Name);
}
