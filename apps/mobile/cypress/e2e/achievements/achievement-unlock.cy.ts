/// <reference types="cypress" />

/**
 * E2E de `sistema-logros`: backend real (`docker compose up` en
 * `infra/docker/`), sin mockear `apps/api` — mismo criterio que
 * `route-sharing.cy.ts`/`route-cloud-sync.cy.ts`. Usa directamente el logro
 * real del catálogo "Ruta larga" (>=3600s en una sola ruta, ver migración
 * 0009) ajustando solo la duración de la ruta sembrada — deliberadamente NO
 * siembra ningún logro de test en la tabla compartida `achievements`: un
 * primer intento con un logro de test propio de umbral mínimo (route_count
 * >= 1) causó un fallo intermitente real en CI (achievement-unlock-overlay
 * cubriendo un click de OTRO test, `route-cloud-sync.cy.ts`, que subía una
 * ruta de exactamente 3600s de duración — el mismo valor por defecto usado
 * como "ruta larga de prueba" en varios fixtures de este repo). Usar el
 * catálogo real, sin mutar `achievements`, elimina esa clase de riesgo.
 */

import type { Route } from '../../../src/shared/models/route.types.js';

const TEST_EMAIL_PREFIX = 'cypress-achievements';
const TEST_PASSWORD = 'correct-horse-battery';
const API_BASE_URL = 'http://localhost:8080';
/** Umbral real de "Ruta larga" (migración 0009) + margen, para no depender del valor límite exacto. */
const LONG_ROUTE_DURATION_SECONDS = 3700;

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
    duration: LONG_ROUTE_DURATION_SECONDS,
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
  after(() => {
    cy.exec(
      `docker exec docker-postgres-1 psql -U motoroutes -d motoroutes -c "DELETE FROM users WHERE email LIKE '${TEST_EMAIL_PREFIX}-%';"`,
      { failOnNonZeroExit: false },
    );
  });

  it('subir una ruta de más de 1 hora desbloquea "Ruta larga" y muestra la animación con su título/descripción', () => {
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
      cy.get('[data-cy="achievement-unlock-title"]').should('contain', 'Ruta larga');
      cy.get('[data-cy="achievement-unlock-description"]').should('contain', 'Has completado una ruta de mas de 1 hora');
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

        cy.contains('[data-cy="achievement-list-card-conseguido"]', 'Ruta larga')
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
