/// <reference types="cypress" />

/**
 * E2E de la subida/borrado real de fotos contra el backend de fotos
 * (`almacenamiento-fotos-backend`, ya en `master`) desde una ruta ya
 * sincronizada -- backend real (`docker compose up` en `infra/docker/`), sin
 * mockear `apps/api`, mismo criterio que `route-cloud-sync.cy.ts`.
 */

import type { Route, RoutePoint, RouteStop } from '../../../src/shared/models/route.types.js';

const TEST_EMAIL_PREFIX = 'cypress-photo-sync';
const TEST_PASSWORD = 'correct-horse-battery';
const API_BASE_URL = 'http://localhost:8080';
const SAMPLE_PHOTO = 'cypress/fixtures/photo-sample.jpg';

interface RemotePhoto {
  id: string;
}

function uniqueTestEmail(suffix: string): string {
  return `${TEST_EMAIL_PREFIX}-${String(Date.now())}-${suffix}@example.com`;
}

let usernameCounter = 0;

/** Username único y válido (`[a-z0-9_]{3,20}`, ver `validateUsername` en `apps/api`) — obligatorio desde `nombre-usuario`. */
function uniqueTestUsername(): string {
  usernameCounter += 1;
  return `cy${Date.now().toString(36)}${String(usernameCounter)}`.slice(0, 20);
}

function markEmailVerified(email: string): Cypress.Chainable {
  return cy.exec(
    `docker exec docker-postgres-1 psql -U motoroutes -d motoroutes -c "UPDATE users SET email_verified = true WHERE email = '${email}';"`,
  );
}

function registerVerifiedAccountViaApi(email: string): Cypress.Chainable<string> {
  return cy
    .request('POST', `${API_BASE_URL}/api/auth/register`, { email, password: TEST_PASSWORD, username: uniqueTestUsername() })
    .then(() => markEmailVerified(email))
    .then(() => cy.request('POST', `${API_BASE_URL}/api/auth/login`, { email, password: TEST_PASSWORD }))
    .then((res) => (res.body as { token: string }).token);
}

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

/** Sube una ruta directamente vía API (sin UI) -- para dejarla "ya sincronizada" antes de visitar la app. */
function uploadRouteViaApi(token: string, route: Route, points: RoutePoint[] = [], stops: RouteStop[] = []): Cypress.Chainable {
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
      points: points.map((p) => ({ timestamp: p.timestamp, lat: p.lat, lng: p.lng, alt: p.alt, speed: p.speed })),
      stops: stops.map((s) => ({
        start_time: s.startTime,
        end_time: s.endTime,
        lat: s.lat,
        lng: s.lng,
        type: s.type,
        stop_category_id: s.stopCategoryId,
      })),
    },
  });
}

function fetchRemotePhotos(token: string, routeId: string): Cypress.Chainable<RemotePhoto[]> {
  return cy
    .request({ url: `${API_BASE_URL}/api/routes/${routeId}/photos`, headers: { Authorization: `Bearer ${token}` } })
    .its('body') as Cypress.Chainable<RemotePhoto[]>;
}

function loginViaUi(email: string): void {
  cy.get('[data-cy="nav-perfil"]').click();
  cy.get('[data-cy="auth-btn-abrir-login"]').click();
  cy.get('[data-cy="auth-input-email-login"]').type(email);
  cy.get('[data-cy="auth-input-password-login"]').type(TEST_PASSWORD);
  cy.get('[data-cy="auth-btn-confirmar-login"]').click();
  cy.get('[data-cy="auth-dialog-login"]').should('not.exist');
}

describe('Subida/borrado real de fotos de ruta contra el backend', () => {
  after(() => {
    cy.exec(
      `docker exec docker-postgres-1 psql -U motoroutes -d motoroutes -c "DELETE FROM users WHERE email LIKE '${TEST_EMAIL_PREFIX}-%';"`,
      { failOnNonZeroExit: false },
    );
  });

  it('añadir una foto a una ruta sincronizada la sube al servidor; borrarla la borra también del servidor', () => {
    const email = uniqueTestEmail('subida');
    // duration explícita por debajo de 3600s: el default de buildSeedRoute coincide
    // con el umbral del logro real "ruta_larga_60" (ver achievements.go), y
    // conceder ese logro al sincronizar la ruta muestra achievement-unlock-overlay,
    // que tapa el click de photo-thumbnail más abajo -- mismo patrón de colisión ya
    // documentado en achievement-unlock.cy.ts.
    const route = buildSeedRoute({ name: `Ruta foto real ${String(Date.now())}`, duration: 600 });

    registerVerifiedAccountViaApi(email).then((token) => {
      uploadRouteViaApi(token, route).then(() => {
        cy.visitWithSeed({ routes: [route] });
        loginViaUi(email);

        cy.get('[data-cy="nav-rutas"]').click();
        cy.contains('[data-cy="route-card"]', route.name as string).click();
        cy.get('[data-cy="route-detail-btn-subir-nube"]').should('have.class', 'sync-icon-btn--synced');

        cy.intercept('POST', '**/api/routes/*/photos').as('uploadPhoto');

        cy.get('[data-cy="tab-bar-btn-fotos"]').click();
        cy.get('[data-cy="photo-add-button"]').click();
        cy.get('[data-cy="photo-menu-gallery"]').click();
        cy.get('[data-cy="photo-capture-input-file"]').selectFile(SAMPLE_PHOTO, { force: true });
        cy.get('[data-cy="photo-thumbnail"]').should('have.length', 1);

        // La subida es en segundo plano, sin toast propio (design.md Decisión 6).
        cy.wait('@uploadPhoto', { timeout: 10000 }).its('response.statusCode').should('eq', 201);
        fetchRemotePhotos(token, route.id).should('have.length', 1);

        cy.intercept('DELETE', '**/api/routes/*/photos/*').as('deletePhoto');

        cy.get('[data-cy="photo-thumbnail"]').first().click();
        cy.get('[data-cy="photo-viewer-delete"]').click();
        cy.get('[data-cy="confirm-dialog-action-confirm"]').click();
        cy.get('[data-cy="photo-thumbnail"]').should('not.exist');

        cy.wait('@deletePhoto', { timeout: 10000 }).its('response.statusCode').should('eq', 204);
        fetchRemotePhotos(token, route.id).should('have.length', 0);
      });
    });
  });

  it('añadir una foto a una ruta puramente local no llama nunca al backend de fotos', () => {
    const route = buildSeedRoute({ name: `Ruta local sin sesion ${String(Date.now())}` });
    cy.intercept('POST', '**/api/routes/*/photos').as('uploadPhoto');

    cy.visitWithSeed({ routes: [route] });
    cy.get('[data-cy="nav-rutas"]').click();
    cy.contains('[data-cy="route-card"]', route.name as string).click();
    cy.get('[data-cy="route-detail-btn-subir-nube"]').should('not.exist');

    cy.get('[data-cy="tab-bar-btn-fotos"]').click();
    cy.get('[data-cy="photo-add-button"]').click();
    cy.get('[data-cy="photo-menu-gallery"]').click();
    cy.get('[data-cy="photo-capture-input-file"]').selectFile(SAMPLE_PHOTO, { force: true });
    cy.get('[data-cy="photo-thumbnail"]').should('have.length', 1);

    cy.wait(500);
    cy.get('@uploadPhoto.all').should('have.length', 0);
  });
});
