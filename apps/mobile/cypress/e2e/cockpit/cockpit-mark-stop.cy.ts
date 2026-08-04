/// <reference types="cypress" />

/**
 * E2E del catálogo de tipos de parada (grupo 8.2): modal de "marcar parada"
 * durante una grabación real y su reflejo en el timeline de la ruta guardada.
 * A diferencia de `cockpit.cy.ts` (que no depende de `apps/api`), este flujo
 * sí necesita el backend real levantado (`docker compose up` en
 * `infra/docker/`) — el catálogo se sirve por `GET /api/stop-types`, nunca
 * mockeado, para verificar la integración real mobile→backend.
 */

const STOP_LAT = 41.3874;
const STOP_LNG = 2.1686;

/**
 * Sustituye `navigator.geolocation.watchPosition` por dos posiciones fijas
 * entregadas de forma síncrona. Sin esto, `addManualStop` no persiste nada:
 * necesita un `lastPoint` real (`cockpit.service.ts::addManualStopAction`),
 * y ni Electron (el navegador headless de `cypress run`) ni un entorno de CI
 * dan una ubicación real utilizable. Hacen falta AL MENOS 2 puntos (no 1):
 * `buildTimelineData` (route-timeline.transform.ts) exige `points.length >= 2`
 * para calcular Salida/Llegada — con solo 1 punto, la timeline cae en el
 * estado "sin datos GPS suficientes" y nunca llega a pintar la parada.
 */
function stubGeolocation(win: Cypress.AUTWindow): void {
  const makePosition = (offsetMs: number, latOffset: number): { coords: GeolocationCoordinates; timestamp: number } => ({
    coords: {
      latitude: STOP_LAT + latOffset,
      longitude: STOP_LNG,
      altitude: 50,
      accuracy: 5,
      altitudeAccuracy: null,
      heading: null,
      speed: 0,
    } as GeolocationCoordinates,
    timestamp: Date.now() + offsetMs,
  });
  cy.stub(win.navigator.geolocation, 'watchPosition').callsFake(
    (success: (pos: ReturnType<typeof makePosition>) => void): number => {
      success(makePosition(0, 0));
      success(makePosition(1000, 0.0005));
      return 1;
    },
  );
  cy.stub(win.navigator.geolocation, 'clearWatch');
}

describe('Catálogo de tipos de parada - marcar parada y verla en el timeline', () => {
  it('marks a manual stop with a chosen type during recording and shows it in the timeline after saving', () => {
    cy.intercept('GET', '**/api/stop-types').as('getStopTypes');

    cy.visit('/', { onBeforeLoad: stubGeolocation });
    // Espera a que la caché local del catálogo (best-effort, ver
    // refreshStopTypesCache) se puebla desde el backend real ANTES de marcar
    // la parada — el modal lee la caché una sola vez al pulsar el botón, sin
    // reactividad, así que si se adelanta verá el catálogo todavía vacío.
    // `cy.wait('@getStopTypes')` solo resuelve cuando la petición de red
    // termina — el `cache.replaceAll()` que la procesa corre un instante
    // después (siguiente tick de la promesa), de ahí el margen real corto.
    cy.wait('@getStopTypes');
    cy.wait(300);

    cy.get('[data-cy="cockpit-master-btn"]').click();
    cy.get('[data-cy="cockpit-mark-stop"]').click();

    cy.get('[data-cy="stop-type-dialog-option-mirador"]').should('be.visible').click();
    cy.get('[data-cy="photo-toast"]').should('contain', 'Parada marcada');
    cy.get('[data-cy="photo-toast"]').should('contain', 'Mirador');

    cy.get('[data-cy="cockpit-master-btn"]').trigger('pointerdown');
    cy.wait(1700); // LONG_PRESS_MS = 1500 (cockpit.element.ts), tiempo real, sin timers falseables — igual que cockpit.cy.ts.
    const routeName = `Ruta test ${String(Date.now())}-marcar-parada`;
    cy.get('[data-cy="save-route-dialog-input-name"]').type(routeName);
    cy.get('[data-cy="save-route-dialog-action-save"]').click();
    cy.get('[data-cy="save-route-dialog-input-name"]').should('not.exist');

    cy.get('[data-cy="nav-rutas"]').click();
    cy.contains('[data-cy="route-card"]', routeName).click();
    cy.get('[data-cy="tab-bar-btn-timeline"]').click();

    const stopRow = cy.get('[data-cy="route-detail-timeline-evento-parada"]');
    stopRow.should('be.visible');
    stopRow.should('contain', '🏔️'); // icono real sembrado por 0002_create_stop_types.sql para "mirador"
    stopRow.should('contain', 'Mirador');
  });

  it('never shows a manual-stop button reaction when the stop dialog is cancelled — no stop persists (AC-4.5 regression, real backend)', () => {
    cy.intercept('GET', '**/api/stop-types').as('getStopTypes');

    cy.visit('/', { onBeforeLoad: stubGeolocation });
    cy.wait('@getStopTypes');

    cy.get('[data-cy="cockpit-master-btn"]').click();
    cy.get('[data-cy="cockpit-mark-stop"]').click();
    cy.get('[data-cy="stop-type-dialog-cancel"]').click();
    cy.get('[data-cy="stop-type-dialog-cancel"]').should('not.exist');
    cy.get('[data-cy="photo-toast"]').should('not.exist');

    cy.get('[data-cy="cockpit-master-btn"]').trigger('pointerdown');
    cy.wait(1700);
    const routeName = `Ruta test ${String(Date.now())}-parada-cancelada`;
    cy.get('[data-cy="save-route-dialog-input-name"]').type(routeName);
    cy.get('[data-cy="save-route-dialog-action-save"]').click();

    cy.get('[data-cy="nav-rutas"]').click();
    cy.contains('[data-cy="route-card"]', routeName).click();
    cy.get('[data-cy="tab-bar-btn-timeline"]').click();
    cy.get('[data-cy="route-detail-timeline-evento-parada"]').should('not.exist');
  });
});
