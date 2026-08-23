/// <reference types="cypress" />

/**
 * E2E de `renovacion-token-sesion`: backend real (`docker compose up` en
 * `infra/docker/`), sin mockear `apps/api` — mismo criterio que `auth.cy.ts`/
 * `username.cy.ts`. Cubre tasks.md 7.1-7.2.
 */

const TEST_EMAIL_PREFIX = 'cypress-session-refresh';
const TEST_PASSWORD = 'correct-horse-battery';
const API_BASE_URL = 'http://localhost:8080';

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

interface LoginResponse {
  token: string;
  refresh_token: string;
  expires_in: number;
}

/** Registra, verifica y hace login vía API (sin pasar por la UI) — devuelve el par de tokens. */
function registerAndLoginViaApi(email: string): Cypress.Chainable<LoginResponse> {
  const username = uniqueTestUsername();
  return cy
    .request('POST', `${API_BASE_URL}/api/auth/register`, { email, password: TEST_PASSWORD, username })
    .then(() => markEmailVerified(email))
    .then(() => cy.request('POST', `${API_BASE_URL}/api/auth/login`, { email, password: TEST_PASSWORD }))
    .then((res) => res.body as LoginResponse);
}

function loginViaUi(email: string): void {
  cy.get('[data-cy="auth-btn-abrir-login"]').click();
  cy.get('[data-cy="auth-input-email-login"]').type(email);
  cy.get('[data-cy="auth-input-password-login"]').type(TEST_PASSWORD);
  cy.get('[data-cy="auth-btn-confirmar-login"]').click();
}

function openProfile(): void {
  cy.get('[data-cy="nav-perfil"]').click();
  cy.get('profile-view').should('be.visible');
}

describe('Renovación de sesión (renovacion-token-sesion)', () => {
  after(() => {
    cy.exec(
      `docker exec docker-postgres-1 psql -U motoroutes -d motoroutes -c "DELETE FROM users WHERE email LIKE '${TEST_EMAIL_PREFIX}-%';"`,
      { failOnNonZeroExit: false },
    );
  });

  it('el login devuelve un access token y un refresh token, ambos utilizables (7.1)', () => {
    const email = uniqueTestEmail('login-tokens');

    registerAndLoginViaApi(email).then((login) => {
      expect(login.token).to.be.a('string').and.not.empty;
      expect(login.refresh_token).to.be.a('string').and.not.empty;
      expect(login.refresh_token).to.not.equal(login.token);
      expect(login.expires_in).to.be.a('number').and.greaterThan(0);

      cy.request({
        method: 'GET',
        url: `${API_BASE_URL}/api/auth/me`,
        headers: { Authorization: `Bearer ${login.token}` },
      }).then((meRes) => {
        expect(meRes.status).to.eq(200);
      });
    });
  });

  it('canjear el refresh token devuelve un par nuevo, y el usado deja de servir (rotación de un solo uso) (7.1)', () => {
    const email = uniqueTestEmail('rotacion');

    registerAndLoginViaApi(email).then((login) => {
      cy.request('POST', `${API_BASE_URL}/api/auth/refresh`, { refresh_token: login.refresh_token }).then((refreshRes) => {
        expect(refreshRes.status).to.eq(200);
        const refreshed = refreshRes.body as LoginResponse;
        // No se compara refreshed.token contra login.token: un JWT con las
        // mismas claims (uid/iat/exp) emitido dentro del mismo segundo es
        // bit a bit idéntico por diseño (JWT trunca a precisión de segundo)
        // — no es un bug, la propiedad de seguridad real que sí debe
        // cumplirse es la rotación del refresh token, comprobada abajo.
        expect(refreshed.refresh_token).to.not.equal(login.refresh_token);

        cy.request({
          method: 'POST',
          url: `${API_BASE_URL}/api/auth/refresh`,
          body: { refresh_token: login.refresh_token },
          failOnStatusCode: false,
        }).then((reuseRes) => {
          expect(reuseRes.status).to.eq(401);
        });
      });
    });
  });

  it('cerrar sesión revoca el refresh token — un canje posterior con el mismo token es rechazado (7.2)', () => {
    const email = uniqueTestEmail('logout');

    registerAndLoginViaApi(email).then((login) => {
      cy.request({
        method: 'POST',
        url: `${API_BASE_URL}/api/auth/logout`,
        headers: { Authorization: `Bearer ${login.token}` },
        body: { refresh_token: login.refresh_token },
      }).then((logoutRes) => {
        expect(logoutRes.status).to.eq(200);

        cy.request({
          method: 'POST',
          url: `${API_BASE_URL}/api/auth/refresh`,
          body: { refresh_token: login.refresh_token },
          failOnStatusCode: false,
        }).then((refreshRes) => {
          expect(refreshRes.status).to.eq(401);
        });
      });
    });
  });

  it('un 401 al comprobar la sesión al iniciar sesión se renueva sola, sin mostrar login (7.1)', () => {
    const email = uniqueTestEmail('renovacion-ui');

    // checkUsernameGate() (app.element.ts) llama a GET /api/auth/me justo tras
    // el login interactivo (evento AUTH_LOGGED_IN) con sessionRefresh ya
    // cableado (ver app-username-gate.ts) — fallar solo la primera llamada
    // con 401 y dejar pasar el resto ejercita el reintento real tras
    // refrescar contra el backend real (POST /api/auth/refresh sin mockear).
    let meAttempts = 0;
    cy.intercept('GET', '**/api/auth/me', (req) => {
      meAttempts += 1;
      if (meAttempts === 1) {
        req.reply({ statusCode: 401, body: { error: 'missing or invalid token' } });
        return;
      }
      req.continue();
    }).as('me');

    registerAndLoginViaApi(email).then(() => {
      cy.visit('/');
      openProfile();
      loginViaUi(email);

      // Sin pantalla de login, sin bloqueo por username — la sesión se renovó
      // sola en segundo plano y el usuario nunca lo nota.
      cy.get('[data-cy="auth-dialog-login"]').should('not.exist');
      cy.get('[data-cy="username-gate"]').should('not.exist');
      cy.get('[data-cy="profile-name"]').should('be.visible');
      cy.wait('@me');
      cy.get('@me.all').should('have.length.at.least', 2);
    });
  });
});
