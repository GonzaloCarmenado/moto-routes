/// <reference types="cypress" />

/**
 * E2E de `unificar-perfil-cuenta`: backend real (`docker compose up` en
 * `infra/docker/`), sin mockear `apps/api` — mismo criterio que
 * `username.cy.ts`/`route-cloud-sync.cy.ts` (ADR-035).
 *
 * Cubre tasks.md 6.1-6.3: el nombre mostrado en Perfil es el `username` de
 * la cuenta, subir un avatar nuevo desde Perfil lo refleja sin recargar, y
 * una cuenta que ya tiene avatar (subido en una sesión anterior) lo
 * descarga y muestra sola al iniciar sesión en una sesión nueva. No se
 * construye ninguna petición multipart directa contra `/api/auth/avatar`
 * (mismo criterio ya documentado en `route-sharing.cy.ts`: evitarlo dentro
 * del test) — "sembrar" un avatar ya subido se hace subiéndolo una vez por
 * la UI real y simulando la sesión nueva con un `cy.visitWithSeed` fresco
 * (`MemorySessionRepository` se reinicia en cada visita, igual que un
 * dispositivo distinto).
 */

const TEST_EMAIL_PREFIX = 'cypress-avatar-identidad';
const TEST_PASSWORD = 'correct-horse-battery';
const API_BASE_URL = 'http://localhost:8080';
const SAMPLE_PHOTO = 'cypress/fixtures/photo-sample.jpg';

function uniqueTestEmail(suffix: string): string {
  return `${TEST_EMAIL_PREFIX}-${String(Date.now())}-${suffix}@example.com`;
}

let usernameCounter = 0;

/** Username único y válido (`[a-z0-9_]{3,20}`, ver `validateUsername` en `apps/api`). */
function uniqueTestUsername(): string {
  usernameCounter += 1;
  return `cy${Date.now().toString(36)}${String(usernameCounter)}`.slice(0, 20);
}

function markEmailVerified(email: string): Cypress.Chainable {
  return cy.exec(
    `docker exec docker-postgres-1 psql -U motoroutes -d motoroutes -c "UPDATE users SET email_verified = true WHERE email = '${email}';"`,
  );
}

/** Registra y verifica una cuenta vía API (sin pasar por la UI), devolviendo su username. */
function registerVerifiedAccountViaApi(email: string): Cypress.Chainable<string> {
  const username = uniqueTestUsername();
  return cy
    .request('POST', `${API_BASE_URL}/api/auth/register`, { email, password: TEST_PASSWORD, username })
    .then(() => markEmailVerified(email))
    .then(() => username);
}

function openProfile(): void {
  cy.get('[data-cy="nav-perfil"]').click();
  cy.get('profile-view').should('be.visible');
}

function loginViaUi(email: string): void {
  cy.get('[data-cy="auth-btn-abrir-login"]').click();
  cy.get('[data-cy="auth-input-email-login"]').type(email);
  cy.get('[data-cy="auth-input-password-login"]').type(TEST_PASSWORD);
  cy.get('[data-cy="auth-btn-confirmar-login"]').click();
  cy.get('[data-cy="auth-dialog-login"]').should('not.exist');
}

describe('Identidad de cuenta - username como nombre y avatar de cuenta (unificar-perfil-cuenta)', () => {
  after(() => {
    cy.exec(
      `docker exec docker-postgres-1 psql -U motoroutes -d motoroutes -c "DELETE FROM users WHERE email LIKE '${TEST_EMAIL_PREFIX}-%';"`,
      { failOnNonZeroExit: false },
    );
  });

  it('tras login, Perfil muestra el username de la cuenta como nombre, sin ningún avatar todavía (6.1)', () => {
    const email = uniqueTestEmail('username');
    registerVerifiedAccountViaApi(email).then((username) => {
      cy.visitWithSeed({});
      openProfile();
      loginViaUi(email);
      openProfile();

      cy.get('[data-cy="profile-name"]').should('contain', username);
      cy.get('[data-cy="profile-avatar-placeholder"]').should('exist');
    });
  });

  it('subir un avatar nuevo desde Perfil lo sube a la cuenta y lo refleja de inmediato, sin recargar (6.2)', () => {
    const email = uniqueTestEmail('subida');
    registerVerifiedAccountViaApi(email).then(() => {
      cy.visitWithSeed({});
      openProfile();
      loginViaUi(email);
      openProfile();

      cy.intercept('POST', '**/api/auth/avatar').as('uploadAvatar');

      cy.get('[data-cy="profile-btn-editar-perfil"]').click();
      cy.get('[data-cy="profile-btn-cambiar-foto"]').click();
      cy.get('[data-cy="profile-menu-galeria"]').click();
      cy.get('[data-cy="photo-capture-input-file"]').selectFile(SAMPLE_PHOTO, { force: true });
      cy.get('[data-cy="profile-btn-guardar-perfil"]').should('not.be.disabled').click();

      cy.wait('@uploadAvatar').its('response.statusCode').should('eq', 200);
      cy.get('profile-edit-dialog').should('not.exist');
      cy.get('[data-cy="profile-avatar-editar"] img').should('exist');
    });
  });

  it('una cuenta que ya tenía avatar subido en una sesión anterior lo descarga y muestra al iniciar sesión en una sesión nueva (6.3)', () => {
    const email = uniqueTestEmail('sesion-nueva');
    registerVerifiedAccountViaApi(email).then(() => {
      // "Sesión 1": sube el avatar por la UI real (llamada real a POST /api/auth/avatar).
      cy.visitWithSeed({});
      openProfile();
      loginViaUi(email);
      openProfile();
      cy.get('[data-cy="profile-btn-editar-perfil"]').click();
      cy.get('[data-cy="profile-btn-cambiar-foto"]').click();
      cy.get('[data-cy="profile-menu-galeria"]').click();
      cy.get('[data-cy="photo-capture-input-file"]').selectFile(SAMPLE_PHOTO, { force: true });
      cy.get('[data-cy="profile-btn-guardar-perfil"]').should('not.be.disabled').click();
      cy.get('profile-edit-dialog').should('not.exist');

      // "Sesión nueva": `cy.visitWithSeed` reinicia `MemorySessionRepository`
      // (sin sesión guardada), mismo efecto que abrir la app en otro dispositivo.
      cy.visitWithSeed({});
      openProfile();
      cy.get('[data-cy="profile-avatar-placeholder"]').should('exist');

      loginViaUi(email);
      openProfile();

      // Sin volver a subir nada: el avatar ya configurado en la cuenta se descarga solo.
      cy.get('[data-cy="profile-avatar-editar"] img').should('exist');
    });
  });
});
