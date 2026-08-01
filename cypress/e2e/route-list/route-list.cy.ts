/// <reference types="cypress" />

import { formatRouteDate } from '../../../src/shared/utils/date.js';
import type { Route } from '../../../src/shared/models/route.types.js';

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

describe('Route list - Listado, estado vacío y eliminación', () => {
  it('shows exactly N seeded routes, each with its own name and date (AC-019)', () => {
    const now = Date.now();
    const routes: Route[] = [0, 1, 2].map((i) =>
      buildSeedRoute({
        createdAt: new Date(now - i * 60_000).toISOString(),
        name: `Ruta test ${String(now)}-${String(i)}`,
      }),
    );

    cy.visitWithSeed({ routes });
    cy.get('[data-cy="nav-rutas"]').click();

    cy.get('[data-cy="route-card"]').should('have.length', 3);

    for (const route of routes) {
      cy.contains('[data-cy="route-card"]', route.name as string)
        .should('contain', formatRouteDate(route.createdAt));
    }
  });

  it('shows the empty state with no routes seeded (AC-020)', () => {
    cy.visit('/');
    cy.get('[data-cy="nav-rutas"]').click();

    cy.get('[data-cy="route-list-empty"]')
      .should('be.visible')
      .and('contain', 'No hay rutas guardadas todavía');
    cy.get('[data-cy="route-card"]').should('not.exist');
  });

  it('deletes a route after confirming, removing the card and showing a toast (AC-021)', () => {
    const route = buildSeedRoute({ name: `Ruta test ${String(Date.now())}-delete` });

    cy.visitWithSeed({ routes: [route] });
    cy.get('[data-cy="nav-rutas"]').click();

    cy.contains('[data-cy="route-card"]', route.name as string)
      .find('[data-cy="route-card-btn-eliminar"]')
      .click();

    cy.get('[data-cy="confirm-dialog-action-confirm"]').click();

    cy.contains('[data-cy="route-card"]', route.name as string).should('not.exist');
    cy.get('[data-cy="photo-toast"]').should('contain', 'Ruta eliminada');
  });

  it('keeps the card unchanged when the deletion is cancelled (AC-022)', () => {
    const route = buildSeedRoute({ name: `Ruta test ${String(Date.now())}-cancel` });

    cy.visitWithSeed({ routes: [route] });
    cy.get('[data-cy="nav-rutas"]').click();

    cy.contains('[data-cy="route-card"]', route.name as string)
      .find('[data-cy="route-card-btn-eliminar"]')
      .click();

    cy.get('[data-cy="confirm-dialog-action-cancel"]').click();

    cy.contains('[data-cy="route-card"]', route.name as string).should('exist');
    cy.get('[data-cy="route-card"]').should('have.length', 1);
  });
});
