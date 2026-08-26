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

  it('credencial correcta contra el backend real: accede al panel y muestra los estados vacíos reales (backend recién levantado, sin eventos ni instantánea de host todavía)', () => {
    cy.get('[data-cy="login-input-token"]').type(VALID_TOKEN);
    cy.get('[data-cy="login-button-submit"]').click();

    cy.get('[data-cy="app-shell-private"]').should('be.visible');
    cy.get('[data-cy="events-list-empty-state"]').should('be.visible');
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
