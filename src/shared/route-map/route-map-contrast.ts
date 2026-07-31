/**
 * Overrides de contraste para las capas de carretera del estilo `dark` de
 * OpenFreeMap (AC-001 a AC-004). Módulo puro — no depende de `maplibre-gl`
 * ni del DOM, igual que `route-map.transform.ts`.
 */

/**
 * IDs reales de capa (`layers[].id`) del estilo `https://tiles.openfreemap.org/styles/dark`
 * verificados el 2026-07-31 descargando el style JSON público (`curl -s
 * https://tiles.openfreemap.org/styles/dark`) e inspeccionando las capas con
 * `type: 'line'` y `source-layer: 'transportation'`. En ese estilo, las vías
 * principales/motorway se pintan con TRES capas por clase (`_casing`
 * = borde, `_inner` = relleno visible, `_subtle` = variante de zoom lejano);
 * solo se overridea la capa `_inner`/única visible de cada clase, ya que son
 * las que reproducen el problema de contraste reportado (color casi idéntico
 * al fondo, p. ej. `highway_major_inner` en `hsl(0,0%,7%)` sobre un fondo
 * `rgb(12,12,12)`):
 * - `highway_motorway_inner`: autopistas/autovías (`class: motorway`).
 * - `highway_major_inner`: vías principales (`class: primary/secondary/tertiary/trunk`).
 * - `highway_minor`: vías secundarias/urbanas (`class: minor/service/track`, capa única).
 * Un estilo de terceros puede renombrar o eliminar estas capas sin aviso
 * (de ahí AC-003) — ver el manejo de errores por capa en `route-map.element.ts`.
 */
export const ROAD_LAYER_IDS = ['highway_motorway_inner', 'highway_major_inner', 'highway_minor'] as const;

export interface RoadContrastOverride {
  layerId: string;
  property: string;
  value: string;
}

/**
 * Construye un override de `paint` (`line-color`) por cada capa de
 * `ROAD_LAYER_IDS`, usando el color dado tal cual (esta función no decide
 * ningún color propio — lo resuelve `route-map.element.ts` vía
 * `resolveToken()` a partir de un token de `tokens.css`, ver AC-004).
 */
export function buildRoadContrastOverrides(color: string): RoadContrastOverride[] {
  return ROAD_LAYER_IDS.map((layerId) => ({ layerId, property: 'line-color', value: color }));
}
