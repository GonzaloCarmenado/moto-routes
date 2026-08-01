/**
 * Formas mínimas de las respuestas reales de la API pública NHTSA vPIC,
 * usadas por `vpic.service.ts`. Solo se modelan los campos que el cliente
 * necesita — la API devuelve muchos más, ignorados aquí a propósito.
 */

/** Un resultado individual de `GetMakesForVehicleType`. */
export interface VpicMakeEntry {
  /** Identificador numérico de la marca en vPIC (no usado hoy, documentado por completitud). */
  MakeId: number;
  /** Nombre de la marca, tal como lo expone la API. */
  MakeName: string;
}

/** Respuesta de `GET /vehicles/GetMakesForVehicleType/{type}?format=json`. */
export interface VpicMakeResult {
  /** Listado de marcas para el tipo de vehículo consultado. */
  Results: VpicMakeEntry[];
}

/**
 * Un resultado individual de `GetModelsForMake`. El campo `VehicleTypeName`
 * es opcional y best-effort: la documentación pública de vPIC indica que
 * este endpoint concreto normalmente NO lo incluye (ver decisión de diseño
 * #10 de `perfil-usuario.plan.md`) — se modela por si la API lo añadiera.
 */
export interface VpicModelEntry {
  /** Identificador de la marca asociada al modelo. */
  Make_ID: number;
  /** Nombre de la marca asociada al modelo. */
  Make_Name: string;
  /** Identificador numérico del modelo en vPIC. */
  Model_ID: number;
  /** Nombre del modelo, tal como lo expone la API. */
  Model_Name: string;
  /** Tipo de vehículo del modelo, si la API lo incluye (best-effort, ver JSDoc de la interfaz). */
  VehicleTypeName?: string;
}

/** Respuesta de `GET /vehicles/GetModelsForMake/{make}?format=json`. */
export interface VpicModelResult {
  /** Listado de modelos de la marca consultada. */
  Results: VpicModelEntry[];
}
