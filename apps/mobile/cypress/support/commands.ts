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
import type { Profile } from '../../src/shared/models/profile.types.js';

/** Subconjunto mínimo de Route + id explícito: cada test aporta solo los campos que necesita afirmar. */
export type SeedRoute = Partial<Route> & { id: string };

export interface VisitWithSeedOptions {
  routes?: SeedRoute[];
  points?: Record<string, Partial<RoutePoint>[]>;
  stops?: Record<string, Partial<RouteStop>[]>;
  photos?: unknown[];
  /** Perfil de usuario sembrado (singleton) — opcional; si se omite, el perfil queda vacío. */
  profile?: Profile;
  path?: string;
}

Cypress.Commands.add('visitWithSeed', (options: VisitWithSeedOptions = {}) => {
  cy.visit(options.path ?? '/', {
    onBeforeLoad(win) {
      if (options.routes?.length || options.profile) {
        win.localStorage.setItem(
          'cypress-seed-routes',
          JSON.stringify({
            routes: options.routes ?? [],
            points: options.points,
            stops: options.stops,
            profile: options.profile,
          }),
        );
      }
      if (options.photos?.length) {
        win.localStorage.setItem('moto-routes-photos', JSON.stringify(options.photos));
      }
    },
  });
});

/**
 * Responde de inmediato con una posición fija a `navigator.geolocation
 * .getCurrentPosition()`. Sin esto, `probeGeolocationPermission()`
 * (`src/cockpit/gps/cockpit-browser-gps.service.ts` — gatea "Iniciar ruta"
 * con una localización real, no ya con la Permissions API, ver ADR
 * `fix-gps-overlay-permiso`) hace una petición de geolocalización real que
 * ni Electron (`cypress run`) ni un runner de CI pueden resolver, dejando
 * bloqueados hasta el timeout de 8s los tests que pulsan el botón de
 * inicio. Debe pasarse como `onBeforeLoad` de `cy.visit()` — igual que
 * `stubGeolocation` en `cockpit-mark-stop.cy.ts`, que cubre el mismo motivo
 * pero para `watchPosition`.
 */
export function stubGpsPermissionGranted(win: Cypress.AUTWindow): void {
  cy.stub(win.navigator.geolocation, 'getCurrentPosition').callsFake(
    (success: PositionCallback) => {
      success({
        coords: {
          latitude: 40.4168,
          longitude: -3.7038,
          altitude: 650,
          accuracy: 10,
          altitudeAccuracy: 10,
          heading: 0,
          speed: 0,
        },
        timestamp: Date.now(),
      } as GeolocationPosition);
    },
  );
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace -- namespace requerido por la API pública de Cypress para extender Chainable
  namespace Cypress {
    interface Chainable {
      visitWithSeed: (options?: VisitWithSeedOptions) => Chainable<void>;
    }
  }
}
