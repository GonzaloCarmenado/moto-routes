/**
 * Formas mínimas de las respuestas reales de la API pública NHTSA vPIC,
 * usadas por `vpic.service.ts`. Solo se modelan los campos que el cliente
 * necesita — la API devuelve muchos más, ignorados aquí a propósito.
 */

/** Un resultado individual de `GetMakesForVehicleType`. */
export interface VpicMakeEntry {
  /** Identificador numérico de la marca en vPIC — necesario para `GetModelsForMakeIdYear` (ver `fetchVehicleModels`). */
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
 * Un resultado individual de `GetModelsForMakeIdYear` (con `vehicletype` en
 * la ruta) o de `GetModelsForMake` (fallback sin filtrar). `VehicleTypeName`
 * solo viene informado por el primero — verificado contra la API real
 * (`curl`) el 2026-08-02: `GetModelsForMake` nunca lo incluye.
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
  /** Tipo de vehículo del modelo — presente solo en `GetModelsForMakeIdYear`. */
  VehicleTypeName?: string;
}

/** Respuesta de `GetModelsForMakeIdYear` (filtrada por tipo) o `GetModelsForMake` (sin filtrar, fallback). */
export interface VpicModelResult {
  /** Listado de modelos de la marca consultada. */
  Results: VpicModelEntry[];
}
