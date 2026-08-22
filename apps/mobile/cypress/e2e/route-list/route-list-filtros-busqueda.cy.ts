/// <reference types="cypress" />

/**
 * E2E de `listado-rutas` (mejoras-listado-rutas): filtros local/nube,
 * buscador por nombre y orden fecha/nombre. Los filtros local/nube exigen
 * sesión activa — backend real (`docker compose up`), sin mockear
 * `apps/api`, mismo criterio que `route-cloud-sync.cy.ts`.
 */

import type { Route } from '../../../src/shared/models/route.types.js';

const TEST_EMAIL_PREFIX = 'cypress-listado-filtros';
const TEST_PASSWORD = 'correct-horse-battery';
const API_BASE_URL = 'http://localhost:8080';

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
    duration: 1800,
    totalDistance: 12.5,
    avgSpeed: 42,
    status: 'completed',
    visibility: 'private',
    origin: 'local',
    previewPolyline: null,
    name: `Ruta test ${String(Date.now())}`,
    notes: null,
    isFavorite: false,
    ...overrides,
  };
}

function uploadRouteViaApi(token: string, route: Route): Cypress.Chainable {
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
      points: [],
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

describe('Listado de rutas - filtros "Solo locales" / "Solo en la nube"', () => {
  after(() => {
    cy.exec(
      `docker exec docker-postgres-1 psql -U motoroutes -d motoroutes -c "DELETE FROM users WHERE email LIKE '${TEST_EMAIL_PREFIX}-%';"`,
      { failOnNonZeroExit: false },
    );
  });

  it('sin sesión activa, no se muestran los filtros de local/nube', () => {
    const route = buildSeedRoute();
    cy.visitWithSeed({ routes: [route] });
    cy.get('[data-cy="nav-rutas"]').click();

    cy.get('[data-cy="route-list-filtro-locales"]').should('not.exist');
    cy.get('[data-cy="route-list-filtro-nube"]').should('not.exist');
  });

  it('"Solo locales" oculta las sincronizadas y las exclusivas de la nube; "Solo en la nube" hace lo contrario', () => {
    const email = uniqueTestEmail('filtros');
    const localOnly = buildSeedRoute({ name: `Local ${String(Date.now())}` });
    const synced = buildSeedRoute({ name: `Sincronizada ${String(Date.now())}` });
    const cloudOnly = buildSeedRoute({ name: `Solo nube ${String(Date.now())}` });

    registerVerifiedAccountViaApi(email).then((token) => {
      uploadRouteViaApi(token, synced).then(() => uploadRouteViaApi(token, cloudOnly)).then(() => {
        cy.visitWithSeed({ routes: [localOnly, synced] });
        loginViaUi(email);
        cy.get('[data-cy="nav-rutas"]').click();
        cy.get('[data-cy="route-card"]').should('have.length', 3);

        cy.get('[data-cy="route-list-filtro-locales"]').click();
        cy.get('[data-cy="route-card"]').should('have.length', 1);
        cy.contains('[data-cy="route-card"]', localOnly.name as string).should('exist');

        cy.get('[data-cy="route-list-filtro-locales"]').click();
        cy.get('[data-cy="route-list-filtro-nube"]').click();
        cy.get('[data-cy="route-card"]').should('have.length', 2);
        cy.contains('[data-cy="route-card"]', localOnly.name as string).should('not.exist');
      });
    });
  });

  it('activar ambos filtros a la vez muestra el estado vacío genérico de filtros', () => {
    const email = uniqueTestEmail('vacio');
    const route = buildSeedRoute();

    registerVerifiedAccountViaApi(email).then(() => {
      cy.visitWithSeed({ routes: [route] });
      loginViaUi(email);
      cy.get('[data-cy="nav-rutas"]').click();

      cy.get('[data-cy="route-list-filtro-locales"]').click();
      cy.get('[data-cy="route-list-filtro-nube"]').click();

      cy.get('[data-cy="route-list-empty-filtrado"]')
        .should('be.visible')
        .and('contain', 'No hay rutas que coincidan');
      cy.get('[data-cy="route-card"]').should('not.exist');
    });
  });
});

describe('Listado de rutas - buscador por nombre y orden', () => {
  it('el buscador filtra en vivo, sin distinguir mayúsculas, y vaciarlo restaura el listado', () => {
    const malaga = buildSeedRoute({ name: `Ruta a Málaga ${String(Date.now())}` });
    const otra = buildSeedRoute({ name: `Otra cualquiera ${String(Date.now())}` });

    cy.visitWithSeed({ routes: [malaga, otra] });
    cy.get('[data-cy="nav-rutas"]').click();
    cy.get('[data-cy="route-card"]').should('have.length', 2);

    cy.get('[data-cy="route-list-buscador"]').type('málaga');
    cy.get('[data-cy="route-card"]').should('have.length', 1);
    cy.contains('[data-cy="route-card"]', malaga.name as string).should('exist');

    cy.get('[data-cy="route-list-buscador"]').clear();
    cy.get('[data-cy="route-card"]').should('have.length', 2);
  });

  it('una búsqueda sin coincidencias muestra el estado vacío genérico de filtros', () => {
    const route = buildSeedRoute({ name: `Ruta al norte ${String(Date.now())}` });

    cy.visitWithSeed({ routes: [route] });
    cy.get('[data-cy="nav-rutas"]').click();
    cy.get('[data-cy="route-list-buscador"]').type('inexistente-xyz');

    cy.get('[data-cy="route-list-empty-filtrado"]').should('be.visible');
    cy.get('[data-cy="route-card"]').should('not.exist');
  });

  it('el orden por defecto es por fecha; cambiar a "Nombre" reordena alfabéticamente', () => {
    // Nombres deliberadamente "al revés" de la fecha: si el orden por nombre
    // no reordenara de verdad, la segunda aserción coincidiría con la
    // primera y el test no probaría nada.
    const now = Date.now();
    const vieja = buildSeedRoute({ name: 'Alfa vieja', createdAt: new Date(now - 60_000).toISOString() });
    const nueva = buildSeedRoute({ name: 'Zeta nueva', createdAt: new Date(now).toISOString() });

    cy.visitWithSeed({ routes: [vieja, nueva] });
    cy.get('[data-cy="nav-rutas"]').click();

    cy.get('.name').then(($names) => {
      expect($names.get().map((el) => el.textContent)).to.deep.equal(['Zeta nueva', 'Alfa vieja']);
    });

    cy.get('[data-cy="route-list-orden"]').click();
    cy.get('.name').then(($names) => {
      expect($names.get().map((el) => el.textContent)).to.deep.equal(['Alfa vieja', 'Zeta nueva']);
    });
  });
});
