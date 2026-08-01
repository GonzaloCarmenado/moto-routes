/**
 * Forma del JSON que un test Cypress puede escribir en la clave `cypress-seed-routes`
 * de `localStorage` para precargar rutas/puntos/paradas sin pasar por la UI de
 * grabación. Exclusivo de entornos de test/desarrollo en navegador (nunca se lee
 * cuando isTauri() es true — ver app-seed.service.ts).
 */

import type { Route, RoutePoint, RouteStop } from '../shared/models/route.types.js';

export interface CypressSeedData {
  routes: Route[];
  points?: Record<string, RoutePoint[]>;
  stops?: Record<string, RouteStop[]>;
}
