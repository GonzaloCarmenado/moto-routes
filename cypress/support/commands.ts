/// <reference types="cypress" />

/**
 * Comando compartido de siembra de datos para tests E2E. Centraliza el
 * `localStorage.setItem(...)` que, sin este comando, se repetiría inline en cada
 * spec de los flujos cockpit/route-list/route-detail/fotos/timeline.
 *
 * - Rutas (+ puntos/paradas): clave `cypress-seed-routes`, leída por
 *   `applyCypressSeed()` (`src/app/app-seed.service.ts`) solo fuera de Tauri.
 * - Fotos: clave real `moto-routes-photos`, la misma que ya lee
 *   `MemoryPhotoRepository` en cada instancia nueva — ningún mecanismo de
 *   producción nuevo (AC-012), solo el mismo `onBeforeLoad`.
 *
 * `onBeforeLoad` es imprescindible (no un `cy.window().then(...)` tras un
 * `cy.visit()` normal): `app.element.ts` lee `localStorage` de forma síncrona
 * nada más cargar el módulo — si la clave se escribe después de que la página
 * ya haya empezado a ejecutar su JS, llega tarde.
 */

import type { Route, RoutePoint, RouteStop } from '../../src/shared/models/route.types.js';

/** Subconjunto mínimo de Route + id explícito: cada test aporta solo los campos que necesita afirmar. */
export type SeedRoute = Partial<Route> & { id: string };

export interface VisitWithSeedOptions {
  routes?: SeedRoute[];
  points?: Record<string, Partial<RoutePoint>[]>;
  stops?: Record<string, Partial<RouteStop>[]>;
  photos?: unknown[];
  path?: string;
}

Cypress.Commands.add('visitWithSeed', (options: VisitWithSeedOptions = {}) => {
  cy.visit(options.path ?? '/', {
    onBeforeLoad(win) {
      if (options.routes?.length) {
        win.localStorage.setItem(
          'cypress-seed-routes',
          JSON.stringify({
            routes: options.routes,
            points: options.points,
            stops: options.stops,
          }),
        );
      }
      if (options.photos?.length) {
        win.localStorage.setItem('moto-routes-photos', JSON.stringify(options.photos));
      }
    },
  });
});

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace -- namespace requerido por la API pública de Cypress para extender Chainable
  namespace Cypress {
    interface Chainable {
      visitWithSeed: (options?: VisitWithSeedOptions) => Chainable<void>;
    }
  }
}
