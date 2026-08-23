/// <reference types="cypress" />

/**
 * E2E de `selector-amigos`: backend real (`docker compose up` en
 * `infra/docker/`), sin mockear `apps/api` — mismo criterio que
 * `friends.cy.ts`/`route-sharing.cy.ts`. El flujo "seleccionar un resultado
 * envía la solicitud" ya está cubierto por `friends.cy.ts` (su
 * `sendFriendRequestViaUi` pasa por el selector); este spec cubre lo
 * específico del propio `<friend-selector>`: avatar/placeholder en los
 * resultados y la exclusión de la propia cuenta.
 */

const TEST_EMAIL_PREFIX = 'cypress-friend-selector';
const TEST_PASSWORD = 'correct-horse-battery';
const API_BASE_URL = 'http://localhost:8080';
const SAMPLE_PHOTO = 'cypress/fixtures/photo-sample.jpg';

function uniqueTestEmail(suffix: string): string {
  return `${TEST_EMAIL_PREFIX}-${String(Date.now())}-${suffix}@example.com`;
}

let usernameCounter = 0;

/**
 * Username único y válido (`[a-z0-9_]{3,20}`, ver `validateUsername` en
 * `apps/api`), con un prefijo común dado para poder buscarlos juntos.
 * `prefix` ya incluye su propio componente temporal (`Date.now()`, ver los
 * `describe` que lo construyen) — aquí solo se añade el contador, sin volver
 * a incrustar otro timestamp (haría que `slice(0, 20)` cortara antes de
 * llegar al contador, produciendo el mismo string dos veces — bug real
 * encontrado en este mismo spec).
 */
function uniqueTestUsername(prefix: string): string {
  usernameCounter += 1;
  return `${prefix}${String(usernameCounter)}`.slice(0, 20);
}

function markEmailVerified(email: string): Cypress.Chainable {
  return cy.exec(
    `docker exec docker-postgres-1 psql -U motoroutes -d motoroutes -c "UPDATE users SET email_verified = true WHERE email = '${email}';"`,
  );
}

function registerVerifiedAccountViaApi(email: string, username: string): Cypress.Chainable {
  return cy
    .request('POST', `${API_BASE_URL}/api/auth/register`, { email, password: TEST_PASSWORD, username })
    .then(() => markEmailVerified(email));
}

function loginViaUi(email: string): void {
  cy.get('[data-cy="nav-perfil"]').click();
  cy.get('[data-cy="auth-btn-abrir-login"]').click();
  cy.get('[data-cy="auth-input-email-login"]').type(email);
  cy.get('[data-cy="auth-input-password-login"]').type(TEST_PASSWORD);
  cy.get('[data-cy="auth-btn-confirmar-login"]').click();
  cy.get('[data-cy="auth-dialog-login"]').should('not.exist');
}

/** Sube un avatar real vía UI — mismo flujo que `avatar-identidad.cy.ts` (nunca una petición multipart directa dentro del test). */
function uploadAvatarViaUi(): void {
  cy.get('[data-cy="profile-btn-editar-perfil"]').click();
  cy.get('[data-cy="profile-btn-cambiar-foto"]').click();
  cy.get('[data-cy="profile-menu-galeria"]').click();
  cy.get('[data-cy="photo-capture-input-file"]').selectFile(SAMPLE_PHOTO, { force: true });
  cy.get('[data-cy="profile-btn-guardar-perfil"]').should('not.be.disabled').click();
  cy.get('profile-edit-dialog').should('not.exist');
}

function openFriendSelector(): void {
  cy.get('[data-cy="nav-perfil"]').click();
  cy.get('[data-cy="profile-btn-amigos"]').click();
  cy.get('[data-cy="tab-bar-btn-friends-amigos"]').should('exist');
}

describe('Selector de amigos - avatar/placeholder y exclusión de la propia cuenta (selector-amigos)', () => {
  after(() => {
    cy.exec(
      `docker exec docker-postgres-1 psql -U motoroutes -d motoroutes -c "DELETE FROM users WHERE email LIKE '${TEST_EMAIL_PREFIX}-%';"`,
      { failOnNonZeroExit: false },
    );
  });

  it('un resultado con avatar subido muestra la imagen; uno sin avatar muestra el icono placeholder', () => {
    const prefix = `fsav${Date.now().toString(36)}`;
    const emailWithAvatar = uniqueTestEmail('con-avatar');
    const emailWithoutAvatar = uniqueTestEmail('sin-avatar');
    const emailSearcher = uniqueTestEmail('buscador-1');
    const usernameWithAvatar = uniqueTestUsername(prefix);
    const usernameWithoutAvatar = uniqueTestUsername(prefix);

    registerVerifiedAccountViaApi(emailWithAvatar, usernameWithAvatar).then(() => {
      registerVerifiedAccountViaApi(emailWithoutAvatar, usernameWithoutAvatar).then(() => {
        registerVerifiedAccountViaApi(emailSearcher, uniqueTestUsername('fssearch')).then(() => {
          // Sube el avatar como la cuenta "con avatar", en su propia sesión.
          cy.visitWithSeed({});
          loginViaUi(emailWithAvatar);
          cy.get('[data-cy="nav-perfil"]').click();
          uploadAvatarViaUi();

          // Sesión nueva: busca desde la cuenta "buscadora".
          cy.visitWithSeed({});
          loginViaUi(emailSearcher);
          openFriendSelector();
          cy.get('[data-cy="friend-selector-input"]').type(prefix);

          cy.contains('[data-cy="friend-selector-result"]', usernameWithAvatar)
            .find('img.result-avatar')
            .should('exist');
          cy.contains('[data-cy="friend-selector-result"]', usernameWithoutAvatar)
            .find('.result-avatar-placeholder')
            .should('exist');
        });
      });
    });
  });

  it('la propia cuenta nunca aparece entre los resultados de su propia búsqueda', () => {
    const prefix = `fsex${Date.now().toString(36)}`;
    const emailSelf = uniqueTestEmail('propia');
    const emailOther = uniqueTestEmail('otra');
    const usernameSelf = uniqueTestUsername(prefix);
    const usernameOther = uniqueTestUsername(prefix);

    registerVerifiedAccountViaApi(emailSelf, usernameSelf).then(() => {
      registerVerifiedAccountViaApi(emailOther, usernameOther).then(() => {
        cy.visitWithSeed({});
        loginViaUi(emailSelf);
        openFriendSelector();
        cy.get('[data-cy="friend-selector-input"]').type(prefix);

        cy.contains('[data-cy="friend-selector-result"]', usernameOther).should('exist');
        cy.contains('[data-cy="friend-selector-result"]', usernameSelf).should('not.exist');
      });
    });
  });

  it('el límite de búsquedas por cuenta (30/minuto) rechaza las peticiones adicionales con 429', () => {
    const email = uniqueTestEmail('rate-limit');
    const username = uniqueTestUsername('fsrl');
    const searchLimit = 30;

    registerVerifiedAccountViaApi(email, username).then(() => {
      cy.request('POST', `${API_BASE_URL}/api/auth/login`, { email, password: TEST_PASSWORD }).then((res) => {
        const token = (res.body as { token: string }).token;

        // Agota el límite con peticiones directas — más rápido y menos frágil
        // que conducir 30 búsquedas reales con debounce por la UI, y verifica
        // lo que un test Go con fakes no puede: el wiring real en main.go
        // (RateLimitedSearchHandler + el límite configurado) contra el
        // servidor desplegado de verdad.
        for (let i = 0; i < searchLimit; i += 1) {
          cy.request({
            url: `${API_BASE_URL}/api/users/search?q=a`,
            headers: { Authorization: `Bearer ${token}` },
          });
        }

        cy.request({
          url: `${API_BASE_URL}/api/users/search?q=a`,
          headers: { Authorization: `Bearer ${token}` },
          failOnStatusCode: false,
        }).its('status').should('eq', 429);
      });
    });
  });
});
