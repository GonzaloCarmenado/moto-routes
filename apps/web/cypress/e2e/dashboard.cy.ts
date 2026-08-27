/// <reference types="cypress" />

// Backend real (docker compose, .env.example) — ADMIN_STATUS_TOKEN de desarrollo,
// nunca un valor de producción (ver documentacion/11-inicializacion-local.md).
const VALID_TOKEN = 'local-dev-admin-token-not-for-prod';

describe('Panel de reporting — login y sesión', () => {
  beforeEach(() => {
    cy.clearAllSessionStorage();
    cy.visit('/');
  });

  it('sin sesión: redirige a /login', () => {
    cy.location('pathname').should('eq', '/login');
    cy.get('[data-cy="login-input-token"]').should('be.visible');
  });

  it('credencial incorrecta: muestra un error genérico, sin acceder', () => {
    cy.get('[data-cy="login-input-token"]').type('token-incorrecto');
    cy.get('[data-cy="login-button-submit"]').click();
    cy.get('[data-cy="login-error-message"]').should('be.visible');
    cy.get('[data-cy="app-shell-private"]').should('not.exist');
  });

  it('credencial correcta contra el backend real: accede al panel y muestra los datos reales del backend recién levantado (un evento real de FCM deshabilitado, sin instantánea de host todavía)', () => {
    // Un backend recién levantado con `.env.example` (sin FCM_SERVICE_ACCOUNT_JSON
    // real, tal cual lo levanta este job de CI) SIEMPRE registra un evento real
    // de aviso al arrancar (`main.go::buildNotifier` → degraded_feature, "FCM
    // disabled") — no hay forma de tener un backend "vacío de eventos de verdad"
    // en este entorno sin una credencial de Firebase real. La instantánea de
    // host SÍ es un vacío real: SYSMETRICS_PATH nunca se configura aquí.
    //
    // Se espera explícitamente la petición real de red (login + la propia
    // carga de reporting-view), en vez de confiar solo en el timeout por
    // defecto de cy.get().should() — el contenedor recién levantado por el
    // job de CI puede tardar más que en local en responder a la primera
    // petición real, y ese margen no debe hacer flaky el test.
    cy.intercept('GET', '/admin/status').as('adminStatus');

    cy.get('[data-cy="login-input-token"]').type(VALID_TOKEN);
    cy.get('[data-cy="login-button-submit"]').click();
    cy.wait('@adminStatus'); // petición de login (validación de la credencial)

    cy.get('[data-cy="app-shell-private"]').should('be.visible');
    cy.wait('@adminStatus'); // petición real de reporting-view al montarse

    cy.get('[data-cy="events-list-item"]').should('have.length', 1);
    cy.get('[data-cy="events-list-item"]').should('contain.text', 'FCM_SERVICE_ACCOUNT_JSON not set');
    cy.get('[data-cy="host-snapshot-empty-state"]').should('be.visible');
  });

  it('cerrar sesión: vuelve al login', () => {
    cy.get('[data-cy="login-input-token"]').type(VALID_TOKEN);
    cy.get('[data-cy="login-button-submit"]').click();
    cy.get('[data-cy="dashboard-button-logout"]').click();

    cy.location('pathname').should('eq', '/login');
    cy.get('[data-cy="app-shell-private"]').should('not.exist');
  });

  it('sesión que deja de ser válida (401 simulado): redirige a /login en vez de mostrar datos parciales', () => {
    cy.get('[data-cy="login-input-token"]').type(VALID_TOKEN);
    cy.get('[data-cy="login-button-submit"]').click();
    cy.get('[data-cy="app-shell-private"]').should('be.visible');

    // El primer /admin/status (login) ya pasó — se intercepta el siguiente
    // para simular que el secreto deja de ser válido a mitad de uso (el
    // backend real no tiene forma determinista de forzar esto).
    cy.intercept('GET', '/admin/status', { statusCode: 401, body: {} }).as('expiredSession');
    cy.get('[data-cy="reporting-button-retry"]').should('not.exist');
    cy.reload();

    cy.wait('@expiredSession');
    cy.location('pathname').should('eq', '/login');
  });
});
