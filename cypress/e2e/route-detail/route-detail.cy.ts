/// <reference types="cypress" />

import type { Route, RoutePoint } from '../../../src/shared/models/route.types.js';

function buildSeedRoute(overrides: Partial<Route> = {}): Route {
  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    duration: 3600,
    totalDistance: 12.5,
    avgSpeed: 42,
    status: 'completed',
    visibility: 'private',
    origin: 'local',
    previewPolyline: null,
    name: `Ruta test ${String(Date.now())}`,
    notes: null,
    ...overrides,
  };
}

/** 2 puntos con lat/lng distintos: suficiente para que `route-map-container`
 * tenga contenido real y para que la Timeline calcule Salida/Llegada (AC-023). */
function buildSeedPoints(routeId: string): RoutePoint[] {
  const now = Date.now();
  return [
    { id: crypto.randomUUID(), routeId, timestamp: now - 60_000, lat: 41.38, lng: 2.17, alt: 10, speed: 40 },
    { id: crypto.randomUUID(), routeId, timestamp: now, lat: 41.39, lng: 2.18, alt: 12, speed: 45 },
  ];
}

function seedAndOpenDetail(route: Route, points?: RoutePoint[]): void {
  cy.visitWithSeed({
    routes: [route],
    ...(points ? { points: { [route.id]: points } } : {}),
  });
  cy.get('[data-cy="nav-rutas"]').click();
  cy.contains('[data-cy="route-card"]', route.name as string).click();
}

describe('Route detail - Navegación, pestañas y notas', () => {
  it('navigates to the detail from a route card, showing the title and the map container (AC-023)', () => {
    const route = buildSeedRoute({ name: `Ruta test ${String(Date.now())}-detail` });
    const points = buildSeedPoints(route.id);

    seedAndOpenDetail(route, points);

    cy.get('[data-cy="route-detail-title"]').should('contain', route.name);
    cy.get('[data-cy="route-map-container"]').should('be.visible');
  });

  it('switches panels via tab-bar without a loading flash (AC-024)', () => {
    const route = buildSeedRoute({ name: `Ruta test ${String(Date.now())}-tabs` });
    const points = buildSeedPoints(route.id);

    seedAndOpenDetail(route, points);

    cy.get('[data-cy="route-detail-loading"]').should('not.exist');

    cy.get('[data-cy="tab-bar-btn-fotos"]').click();
    cy.get('[data-cy="tab-bar-btn-fotos"]').should('have.attr', 'aria-selected', 'true');
    cy.get('[data-cy="photo-add-button"]').should('be.visible');
    cy.get('[data-cy="route-detail-loading"]').should('not.exist');

    cy.get('[data-cy="tab-bar-btn-estadisticas"]').click();
    cy.get('[data-cy="tab-bar-btn-estadisticas"]').should('have.attr', 'aria-selected', 'true');
    cy.get('[data-cy="route-detail-loading"]').should('not.exist');

    cy.get('[data-cy="tab-bar-btn-notas"]').click();
    cy.get('[data-cy="tab-bar-btn-notas"]').should('have.attr', 'aria-selected', 'true');
    cy.get('[data-cy="route-detail-textarea-notas"]').should('be.visible');
    cy.get('[data-cy="route-detail-loading"]').should('not.exist');

    cy.get('[data-cy="tab-bar-btn-timeline"]').click();
    cy.get('[data-cy="tab-bar-btn-timeline"]').should('have.attr', 'aria-selected', 'true');
    cy.get('[data-cy="route-detail-timeline-evento-salida"]').should('be.visible');
    cy.get('[data-cy="route-detail-loading"]').should('not.exist');
  });

  it('shows the textarea directly for a route with notes: null (AC-025)', () => {
    const route = buildSeedRoute({ name: `Ruta test ${String(Date.now())}-notas-null`, notes: null });

    seedAndOpenDetail(route);
    cy.get('[data-cy="tab-bar-btn-notas"]').click();

    cy.get('[data-cy="route-detail-textarea-notas"]').should('be.visible');
    cy.get('[data-cy="route-detail-texto-nota"]').should('not.exist');
  });

  it('saves a new note, shows a toast and switches to view mode with the text (AC-026)', () => {
    const route = buildSeedRoute({ name: `Ruta test ${String(Date.now())}-notas-guardar`, notes: null });
    const noteText = 'Nota escrita en el test E2E';

    seedAndOpenDetail(route);
    cy.get('[data-cy="tab-bar-btn-notas"]').click();

    cy.get('[data-cy="route-detail-textarea-notas"]').type(noteText);
    cy.get('[data-cy="route-detail-btn-guardar-nota"]').click();

    cy.get('[data-cy="photo-toast"]').should('contain', 'Nota guardada');
    cy.get('[data-cy="route-detail-texto-nota"]').should('contain', noteText);
    cy.get('[data-cy="route-detail-textarea-notas"]').should('not.exist');
  });

  it('shows view mode directly for a route with an existing note (AC-027)', () => {
    const noteText = 'Nota ya guardada previamente';
    const route = buildSeedRoute({ name: `Ruta test ${String(Date.now())}-notas-vista`, notes: noteText });

    seedAndOpenDetail(route);
    cy.get('[data-cy="tab-bar-btn-notas"]').click();

    cy.get('[data-cy="route-detail-texto-nota"]').should('contain', noteText);
    cy.get('[data-cy="route-detail-btn-editar-nota"]').should('be.visible');
    cy.get('[data-cy="route-detail-textarea-notas"]').should('not.exist');
  });

  it('shows the textarea preloaded with the current text when editing an existing note (AC-028)', () => {
    const noteText = 'Nota a editar';
    const route = buildSeedRoute({ name: `Ruta test ${String(Date.now())}-notas-editar`, notes: noteText });

    seedAndOpenDetail(route);
    cy.get('[data-cy="tab-bar-btn-notas"]').click();
    cy.get('[data-cy="route-detail-btn-editar-nota"]').click();

    cy.get('[data-cy="route-detail-textarea-notas"]').should('have.value', noteText);
  });
});
