/// <reference types="cypress" />

/**
 * E2E de `sistema-logros`: backend real (`docker compose up` en
 * `infra/docker/`), sin mockear `apps/api` — mismo criterio que
 * `route-sharing.cy.ts`/`route-cloud-sync.cy.ts`. El catálogo real (10 filas
 * sembradas por la migración 0009) tiene umbrales demasiado altos para un
 * test E2E (100km, 5 rutas...), así que se siembra un logro de test propio
 * con umbral 1 ruta directamente en la BBDD, limpiado al final.
 */

import type { Route } from '../../../src/shared/models/route.types.js';

const TEST_EMAIL_PREFIX = 'cypress-achievements';
const TEST_PASSWORD = 'correct-horse-battery';
const TEST_ACHIEVEMENT_KEY = 'e2e_test_primera_ruta';
const API_BASE_URL = 'http://localhost:8080';

function psql(sql: string): Cypress.Chainable {
  return cy.exec(`docker exec docker-postgres-1 psql -U motoroutes -d motoroutes -c "${sql}"`, { failOnNonZeroExit: false });
}

function seedTestAchievement(): Cypress.Chainable {
  return psql(`DELETE FROM achievements WHERE key = '${TEST_ACHIEVEMENT_KEY}';`).then(() =>
    psql(
      `INSERT INTO achievements (key, requirement_type, threshold, title, description, icon) VALUES ` +
        `('${TEST_ACHIEVEMENT_KEY}', 'route_count', 1, 'Primera ruta E2E', 'Logro de test sembrado por Cypress.', 'default');`,
    ),
  );
}

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
    duration: 3600,
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

function loginViaUi(email: string): void {
  cy.get('[data-cy="nav-perfil"]').click();
  cy.get('[data-cy="auth-btn-abrir-login"]').click();
  cy.get('[data-cy="auth-input-email-login"]').type(email);
  cy.get('[data-cy="auth-input-password-login"]').type(TEST_PASSWORD);
  cy.get('[data-cy="auth-btn-confirmar-login"]').click();
  cy.get('[data-cy="auth-dialog-login"]').should('not.exist');
}

describe('Sistema de logros - desbloqueo tras sincronizar y pantalla "Mis logros"', () => {
  before(() => {
    seedTestAchievement();
  });

  after(() => {
    psql(`DELETE FROM achievements WHERE key = '${TEST_ACHIEVEMENT_KEY}';`);
    psql(`DELETE FROM users WHERE email LIKE '${TEST_EMAIL_PREFIX}-%';`);
  });

  it('subir la primera ruta a la nube desbloquea el logro de test y muestra la animación con su título/descripción', () => {
    const email = uniqueTestEmail('desbloqueo');
    const route = buildSeedRoute({ name: `Ruta a subir ${String(Date.now())}` });

    registerVerifiedAccountViaApi(email).then(() => {
      cy.visitWithSeed({ routes: [route] });
      loginViaUi(email);

      cy.get('[data-cy="nav-rutas"]').click();
      cy.contains('[data-cy="route-card"]', route.name as string).click();
      cy.get('[data-cy="route-detail-btn-subir-nube"]').click();
      cy.get('[data-cy="photo-toast"]').should('contain', 'subida a la nube');

      cy.get('[data-cy="achievement-unlock-overlay"]', { timeout: 10000 }).should('be.visible');
      cy.get('[data-cy="achievement-unlock-title"]').should('contain', 'Primera ruta E2E');
      cy.get('[data-cy="achievement-unlock-description"]').should('contain', 'Logro de test sembrado por Cypress');
      cy.get('[data-cy="achievement-unlock-dismiss"]').click();
      cy.get('[data-cy="achievement-unlock-overlay"]').should('not.exist');
    });
  });

  it('"Mis logros" muestra el logro recién conseguido en Conseguidos, con su fecha', () => {
    const email = uniqueTestEmail('mislogros');
    const route = buildSeedRoute({ name: `Ruta mis-logros ${String(Date.now())}` });

    registerVerifiedAccountViaApi(email).then((token) => {
      cy.request({
        method: 'POST',
        url: `${API_BASE_URL}/api/routes`,
        headers: { Authorization: `Bearer ${token}` },
        body: {
          id: route.id, created_at: route.createdAt, duration: route.duration, total_distance: route.totalDistance,
          avg_speed: route.avgSpeed, status: route.status, name: route.name, notes: route.notes, is_favorite: route.isFavorite,
          points: [], stops: [],
        },
      }).then(() => {
        cy.request({ method: 'POST', url: `${API_BASE_URL}/api/achievements/check`, headers: { Authorization: `Bearer ${token}` } });

        cy.visitWithSeed({});
        loginViaUi(email);
        cy.get('[data-cy="nav-perfil"]').click();
        cy.get('[data-cy="profile-btn-mis-logros"]').click();

        cy.contains('[data-cy="achievement-list-card-conseguido"]', 'Primera ruta E2E')
          .find('[data-cy="achievement-list-status"]')
          .should('contain', 'Conseguido el');
      });
    });
  });

  it('sin sesión activa, "Mis logros" no llama al backend y muestra el aviso de inicio de sesión', () => {
    cy.intercept('GET', '**/api/achievements').as('achievementsList');
    cy.visitWithSeed({});
    cy.get('[data-cy="nav-perfil"]').click();
    cy.get('[data-cy="profile-btn-mis-logros"]').click();

    cy.get('[data-cy="achievement-list-login-required"]').should('be.visible');
    cy.get('@achievementsList.all').should('have.length', 0);
  });
});
