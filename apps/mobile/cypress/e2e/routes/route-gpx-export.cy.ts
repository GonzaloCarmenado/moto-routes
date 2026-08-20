/// <reference types="cypress" />

/**
 * E2E de `exportacion-gpx`: backend real (`docker compose up` en
 * `infra/docker/`), sin mockear `apps/api` — mismo criterio que
 * `route-cloud-sync.cy.ts`. El WebView de Cypress (Electron) no soporta la
 * Web Share API, así que ejercita el fallback de descarga real de fichero
 * (`route-detail-export.ts::shareOrDownload`), verificando el `.gpx`
 * descargado en `cypress/downloads/`.
 */

import type { Route, RoutePoint } from '../../../src/shared/models/route.types.js';

const TEST_EMAIL_PREFIX = 'cypress-gpx-export';
const TEST_PASSWORD = 'correct-horse-battery';
const API_BASE_URL = 'http://localhost:8080';

function uniqueTestEmail(suffix: string): string {
  return `${TEST_EMAIL_PREFIX}-${String(Date.now())}-${suffix}@example.com`;
}

function markEmailVerified(email: string): Cypress.Chainable {
  return cy.exec(
    `docker exec docker-postgres-1 psql -U motoroutes -d motoroutes -c "UPDATE users SET email_verified = true WHERE email = '${email}';"`,
  );
}

function registerVerifiedAccountViaApi(email: string): Cypress.Chainable<string> {
  return cy
    .request('POST', `${API_BASE_URL}/api/auth/register`, { email, password: TEST_PASSWORD })
    .then(() => markEmailVerified(email))
    .then(() => cy.request('POST', `${API_BASE_URL}/api/auth/login`, { email, password: TEST_PASSWORD }))
    .then((res) => (res.body as { token: string }).token);
}

function buildSeedRoute(overrides: Partial<Route> = {}): Route {
  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    duration: 600,
    totalDistance: 5,
    avgSpeed: 30,
    status: 'completed',
    visibility: 'private',
    origin: 'local',
    previewPolyline: null,
    name: `Ruta export ${String(Date.now())}`,
    notes: null,
    isFavorite: false,
    ...overrides,
  };
}

function uploadRouteViaApi(token: string, route: Route, points: RoutePoint[]): Cypress.Chainable {
  return cy.request({
    method: 'POST',
    url: `${API_BASE_URL}/api/routes`,
    headers: { Authorization: `Bearer ${token}` },
    body: {
      id: route.id,
      created_at: route.createdAt,
      duration: route.duration,
      total_distance: route.totalDistance,
      avg_speed: route.avgSpeed,
      status: route.status,
      name: route.name,
      notes: route.notes,
      is_favorite: route.isFavorite,
      points: points.map((p) => ({ timestamp: p.timestamp, lat: p.lat, lng: p.lng, alt: p.alt, speed: p.speed })),
      stops: [],
    },
  });
}

function loginViaUi(email: string): void {
  cy.get('[data-cy="nav-perfil"]').click();
  cy.get('[data-cy="auth-btn-abrir-login"]').click();
  cy.get('[data-cy="auth-input-email-login"]').type(email);
  cy.get('[data-cy="auth-input-password-login"]').type(TEST_PASSWORD);
  cy.get('[data-cy="auth-btn-confirmar-login"]').click();
  cy.get('[data-cy="auth-dialog-login"]').should('not.exist');
}

describe('Exportación de ruta a GPX', () => {
  after(() => {
    cy.exec(
      `docker exec docker-postgres-1 psql -U motoroutes -d motoroutes -c "DELETE FROM users WHERE email LIKE '${TEST_EMAIL_PREFIX}-%';"`,
      { failOnNonZeroExit: false },
    );
  });

  it('exportar una ruta sincronizada descarga un fichero .gpx con el trazado', () => {
    const email = uniqueTestEmail('exportar');
    const route = buildSeedRoute();
    const points: RoutePoint[] = [
      { id: crypto.randomUUID(), routeId: route.id, timestamp: Date.now() - 60_000, lat: 40.4168, lng: -3.7038, alt: 650, speed: 10 },
      { id: crypto.randomUUID(), routeId: route.id, timestamp: Date.now(), lat: 40.42, lng: -3.7, alt: 655, speed: 12 },
    ];

    registerVerifiedAccountViaApi(email).then((token) => {
      uploadRouteViaApi(token, route, points).then(() => {
        cy.visitWithSeed({});
        loginViaUi(email);

        cy.get('[data-cy="nav-rutas"]').click();
        cy.contains('[data-cy="route-card"]', route.name as string).click();

        cy.intercept('GET', `**/api/routes/${route.id}/export.gpx`).as('exportGpx');
        cy.get('[data-cy="route-detail-btn-exportar-gpx"]').should('exist').click();
        // El botón abre primero el menú de formato (confirm-dialog) — GPX es la única opción hoy.
        cy.get('[data-cy="confirm-dialog-action-gpx"]').click();
        cy.wait('@exportGpx').its('response.statusCode').should('eq', 200);

        const gpxPath = `cypress/downloads/route-${route.id}.gpx`;
        cy.readFile(gpxPath, { timeout: 10000 }).should('contain', '<gpx').and('contain', 'trkpt');

        // El botón se reactiva y no aparece ningún toast de error tras la descarga.
        cy.get('[data-cy="route-detail-btn-exportar-gpx"]').should('not.be.disabled');
        cy.get('[data-cy="photo-toast-error"]').should('not.exist');
      });
    });
  });

  it('sin sesión activa, el botón de exportar no existe', () => {
    const route = buildSeedRoute({ name: `Ruta sin sesion export ${String(Date.now())}` });

    cy.visitWithSeed({ routes: [route] });
    cy.get('[data-cy="nav-rutas"]').click();
    cy.contains('[data-cy="route-card"]', route.name as string).click();

    cy.get('[data-cy="route-detail-btn-exportar-gpx"]').should('not.exist');
  });
});
