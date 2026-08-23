/// <reference types="cypress" />

/**
 * E2E de `subida-automatica-rutas`: backend real (`docker compose up` en
 * `infra/docker/`), sin mockear `apps/api` — mismo criterio que el resto de
 * la suite. Graba y guarda una ruta real vía la UI de `cockpit` (mismo
 * patrón que `cockpit.cy.ts`) y verifica que, con sesión activa, se sube
 * sola sin pulsar el botón manual del detalle.
 */

import { stubGpsPermissionGranted } from '../../support/commands.js';

const TEST_EMAIL_PREFIX = 'cypress-auto-upload';
const TEST_PASSWORD = 'correct-horse-battery';
const API_BASE_URL = 'http://localhost:8080';

function uniqueTestEmail(suffix: string): string {
  return `${TEST_EMAIL_PREFIX}-${String(Date.now())}-${suffix}@example.com`;
}

let usernameCounter = 0;

/** Username único y válido (`[a-z0-9_]{3,20}`, ver `validateUsername` en `apps/api`). */
function uniqueTestUsername(): string {
  usernameCounter += 1;
  return `cyau${Date.now().toString(36)}${String(usernameCounter)}`.slice(0, 20);
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

function loginViaUi(email: string): void {
  cy.get('[data-cy="nav-perfil"]').click();
  cy.get('[data-cy="auth-btn-abrir-login"]').click();
  cy.get('[data-cy="auth-input-email-login"]').type(email);
  cy.get('[data-cy="auth-input-password-login"]').type(TEST_PASSWORD);
  cy.get('[data-cy="auth-btn-confirmar-login"]').click();
  cy.get('[data-cy="auth-dialog-login"]').should('not.exist');
  cy.get('[data-cy="nav-grabar"]').click();
}

/** Graba (sin puntos GPS reales, igual que `cockpit.cy.ts`) y guarda una ruta con `name` vía la UI real. */
function recordAndSaveRouteViaUi(name: string): void {
  cy.get('[data-cy="cockpit-master-btn"]').click();
  cy.get('[data-cy="cockpit-master-btn"]').trigger('pointerdown');
  cy.wait(1700);
  cy.get('[data-cy="save-route-dialog-input-name"]').type(name);
  cy.get('[data-cy="save-route-dialog-action-save"]').click();
  cy.get('[data-cy="save-route-dialog-input-name"]').should('not.exist');
}

/** Reintenta `GET /api/routes` hasta que la ruta aparezca (subida automática en segundo plano) o se agote el presupuesto. */
function expectRouteExistsInCloud(routeName: string, token: string, attempt = 0): void {
  cy.request({
    url: `${API_BASE_URL}/api/routes`,
    headers: { Authorization: `Bearer ${token}` },
  }).then((response) => {
    const found = (response.body as { name: string | null }[]).some((r) => r.name === routeName);
    if (found || attempt >= 20) {
      expect(found, `route "${routeName}" exists in the cloud`).to.eq(true);
      return;
    }
    cy.wait(200);
    expectRouteExistsInCloud(routeName, token, attempt + 1);
  });
}

describe('Subida automática de una ruta recién grabada', () => {
  after(() => {
    cy.exec(
      `docker exec docker-postgres-1 psql -U motoroutes -d motoroutes -c "DELETE FROM users WHERE email LIKE '${TEST_EMAIL_PREFIX}-%';"`,
      { failOnNonZeroExit: false },
    );
  });

  it('con sesión activa, grabar y guardar una ruta la sube sola a la nube, con el snackbar reflejando el progreso y el éxito', () => {
    const email = uniqueTestEmail('exito');
    const routeName = `Ruta auto-subida ${String(Date.now())}`;

    registerVerifiedAccountViaApi(email).then((token) => {
      // Retraso artificial en la respuesta real (no mockeada) para poder
      // observar de forma fiable el estado "en progreso" del snackbar antes
      // de que resuelva — sin esto, una subida sin puntos GPS es tan rápida
      // que el snackbar ya está en éxito para cuando Cypress llega a mirarlo.
      cy.intercept('POST', '**/api/routes', (req) => {
        req.on('response', (res) => { res.setDelay(1200); });
      }).as('upload');
      cy.visit('/', { onBeforeLoad: stubGpsPermissionGranted });
      loginViaUi(email);
      recordAndSaveRouteViaUi(routeName);

      cy.get('[data-cy="route-upload-snackbar"]').should('contain', 'Subiendo ruta');
      cy.wait('@upload');
      cy.get('[data-cy="route-upload-snackbar"]').should('contain', 'Ruta subida');

      expectRouteExistsInCloud(routeName, token);
    });
  });

  it('sin sesión activa, grabar y guardar una ruta no intenta ninguna subida ni muestra el snackbar', () => {
    cy.intercept('POST', '**/api/routes').as('upload');
    cy.visit('/', { onBeforeLoad: stubGpsPermissionGranted });
    recordAndSaveRouteViaUi(`Ruta sin sesion ${String(Date.now())}`);

    cy.get('[data-cy="route-upload-snackbar"]').should('not.exist');
    cy.get('@upload.all').should('have.length', 0);
  });

  it('un fallo de la subida automática deja la ruta en local sin reintento, y el botón manual la sube después con normalidad', () => {
    const email = uniqueTestEmail('fallo');
    const routeName = `Ruta con fallo ${String(Date.now())}`;

    registerVerifiedAccountViaApi(email).then(() => {
      // Un único interceptor con estado: falla la primera petición (subida
      // automática) con un 500 fabricado por Cypress (nunca llega al backend
      // real) y deja pasar las siguientes (reintento manual) sin mockear.
      // Dos cy.intercept() apilados para la misma ruta no sirven aquí — la
      // petición del reintento seguía cayendo en el interceptor antiguo
      // (bug real encontrado escribiendo este test); tampoco sirve
      // req.destroy(), que deja procesar la petición en el servidor real
      // pese a que el cliente nunca recibe la respuesta (otro bug real
      // encontrado igual, verificado porque el botón mostraba "sincronizada"
      // pese al fallo "simulado").
      let attempts = 0;
      cy.intercept('POST', '**/api/routes', (req) => {
        attempts += 1;
        if (attempts === 1) {
          req.reply({ statusCode: 500, body: { error: 'simulated failure' } });
          return;
        }
        req.continue();
      }).as('upload');
      cy.visit('/', { onBeforeLoad: stubGpsPermissionGranted });
      loginViaUi(email);
      recordAndSaveRouteViaUi(routeName);

      cy.wait('@upload');
      cy.get('[data-cy="route-upload-snackbar"]', { timeout: 10000 }).should('not.exist');

      // La ruta sigue intacta en local, marcada como no sincronizada — el
      // botón manual puede reintentar sin que la app haya reintentado sola.
      cy.get('[data-cy="nav-rutas"]').click();
      cy.contains('[data-cy="route-card"]', routeName).click();
      cy.get('[data-cy="route-detail-btn-subir-nube"]').should('not.have.class', 'sync-icon-btn--synced').click();
      cy.wait('@upload');
      cy.get('[data-cy="photo-toast"]').should('contain', 'Ruta subida a la nube');
      cy.get('[data-cy="route-detail-btn-subir-nube"]').should('have.class', 'sync-icon-btn--synced');
    });
  });
});
