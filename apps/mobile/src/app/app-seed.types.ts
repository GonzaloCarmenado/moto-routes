/**
 * Forma del JSON que un test Cypress puede escribir en la clave `cypress-seed-routes`
 * de `localStorage` para precargar rutas/puntos/paradas y el perfil de usuario sin
 * pasar por la UI de grabación/edición. Exclusivo de entornos de test/desarrollo en
 * navegador (nunca se lee cuando isTauri() es true — ver app-seed.service.ts).
 */

import type { Route, RoutePoint, RouteStop } from '../shared/models/route.types.js';
import type { Profile } from '../shared/models/profile.types.js';

/** Datos sembrados por Cypress: rutas, puntos, paradas y perfil de usuario opcionales. */
export interface CypressSeedData {
  routes: Route[];
  points?: Record<string, RoutePoint[]>;
  stops?: Record<string, RouteStop[]>;
  /** Perfil de usuario sembrado (singleton) — opcional; si se omite, el perfil queda vacío. */
  profile?: Profile;
}