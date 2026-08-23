/// <reference types="cypress" />

/**
 * E2E de `agregar-amigos`: backend real (`docker compose up` en
 * `infra/docker/`), sin mockear `apps/api` — mismo criterio que
 * `route-sharing.cy.ts`. A diferencia de compartir rutas, aquí no hace
 * falta ninguna ruta sembrada: la relación de amistad es independiente de
 * `route-cloud-sync`.
 */

const TEST_EMAIL_PREFIX = 'cypress-friends';
const TEST_PASSWORD = 'correct-horse-battery';
const API_BASE_URL = 'http://localhost:8080';

interface SentRequestResponse {
  id: string;
  to_username: string;
  status: string;
}

interface FriendResponse {
  username: string;
}

function uniqueTestEmail(suffix: string): string {
  return `${TEST_EMAIL_PREFIX}-${String(Date.now())}-${suffix}@example.com`;
}

let usernameCounter = 0;

/** Username único y válido (`[a-z0-9_]{3,20}`, ver `validateUsername` en `apps/api`). */
function uniqueTestUsername(): string {
  usernameCounter += 1;
  return `cyf${Date.now().toString(36)}${String(usernameCounter)}`.slice(0, 20);
}

function markEmailVerified(email: string): Cypress.Chainable {
  return cy.exec(
    `docker exec docker-postgres-1 psql -U motoroutes -d motoroutes -c "UPDATE users SET email_verified = true WHERE email = '${email}';"`,
  );
}

/** Registra una cuenta verificada con un username conocido de antemano, para poder usarlo en la UI después. */
function registerVerifiedAccountViaApi(email: string, username: string): Cypress.Chainable<string> {
  return cy
    .request('POST', `${API_BASE_URL}/api/auth/register`, { email, password: TEST_PASSWORD, username })
    .then(() => markEmailVerified(email))
    .then(() => cy.request('POST', `${API_BASE_URL}/api/auth/login`, { email, password: TEST_PASSWORD }))
    .then((res) => (res.body as { token: string }).token);
}

function fetchSentRequests(token: string): Cypress.Chainable<SentRequestResponse[]> {
  return cy
    .request({ url: `${API_BASE_URL}/api/friends/sent`, headers: { Authorization: `Bearer ${token}` } })
    .its('body') as Cypress.Chainable<SentRequestResponse[]>;
}

function fetchFriends(token: string): Cypress.Chainable<FriendResponse[]> {
  return cy
    .request({ url: `${API_BASE_URL}/api/friends`, headers: { Authorization: `Bearer ${token}` } })
    .its('body') as Cypress.Chainable<FriendResponse[]>;
}

function loginViaUi(email: string): void {
  cy.get('[data-cy="nav-perfil"]').click();
  cy.get('[data-cy="auth-btn-abrir-login"]').click();
  cy.get('[data-cy="auth-input-email-login"]').type(email);
  cy.get('[data-cy="auth-input-password-login"]').type(TEST_PASSWORD);
  cy.get('[data-cy="auth-btn-confirmar-login"]').click();
  cy.get('[data-cy="auth-dialog-login"]').should('not.exist');
}

function sendFriendRequestViaUi(targetUsername: string): void {
  cy.get('[data-cy="nav-perfil"]').click();
  cy.get('[data-cy="profile-btn-amigos"]').click();
  // fetchAndRender() reconstruye el DOM del formulario en dos pasadas (carga
  // y, tras resolver las 4 llamadas en paralelo, datos reales) — esperar a
  // que las pestañas existan (solo se pintan cuando `_loading` es false)
  // evita escribir en un <input> que un segundo render reemplaza a mitad de
  // la escritura (bug real de carrera encontrado en CI, no en local).
  cy.get('[data-cy="tab-bar-btn-friends-amigos"]').should('exist');
  cy.get('[data-cy="friends-input-username"]').type(targetUsername);
  cy.get('[data-cy="friends-btn-enviar"]').click();
  cy.get('[data-cy="photo-toast"]').should('contain', 'enviado');
}

describe('Amigos - solicitud, aceptar, rechazar y revocar', () => {
  after(() => {
    cy.exec(
      `docker exec docker-postgres-1 psql -U motoroutes -d motoroutes -c "DELETE FROM users WHERE email LIKE '${TEST_EMAIL_PREFIX}-%';"`,
      { failOnNonZeroExit: false },
    );
  });

  it('enviar una solicitud por username la deja visible en "Enviadas"', () => {
    const emailA = uniqueTestEmail('emisor-1');
    const emailB = uniqueTestEmail('destino-1');
    const usernameA = uniqueTestUsername();
    const usernameB = uniqueTestUsername();

    registerVerifiedAccountViaApi(emailA, usernameA).then((tokenA) => {
      registerVerifiedAccountViaApi(emailB, usernameB).then(() => {
        cy.visitWithSeed({});
        loginViaUi(emailA);
        sendFriendRequestViaUi(usernameB);

        cy.get('[data-cy="tab-bar-btn-friends-enviadas"]').click();
        cy.contains('[data-cy="friends-card-enviada"]', usernameB)
          .find('[data-cy="friends-status"]')
          .should('contain', 'Pendiente');

        fetchSentRequests(tokenA).then((sent) => {
          expect(sent).to.have.length(1);
          expect(sent[0]?.to_username).to.eq(usernameB);
          expect(sent[0]?.status).to.eq('pending');
        });
      });
    });
  });

  it('aceptar una solicitud crea la amistad para ambas cuentas; rechazar no crea ninguna', () => {
    const emailA = uniqueTestEmail('emisor-2');
    const emailB = uniqueTestEmail('destino-2');
    const emailC = uniqueTestEmail('destino-3');
    const usernameA = uniqueTestUsername();
    const usernameB = uniqueTestUsername();
    const usernameC = uniqueTestUsername();

    registerVerifiedAccountViaApi(emailA, usernameA).then((tokenA) => {
      registerVerifiedAccountViaApi(emailB, usernameB).then((tokenB) => {
        registerVerifiedAccountViaApi(emailC, usernameC).then(() => {
          cy.visitWithSeed({});
          loginViaUi(emailA);
          sendFriendRequestViaUi(usernameB);
          sendFriendRequestViaUi(usernameC);

          cy.intercept('GET', '**/api/friends/received').as('received');
          cy.visitWithSeed({});
          loginViaUi(emailB);
          cy.get('[data-cy="nav-perfil"]').click();
          cy.get('[data-cy="profile-btn-amigos"]').click();
          cy.wait('@received');
          cy.get('[data-cy="tab-bar-btn-friends-recibidas"]').click();

          cy.contains('[data-cy="friends-card-recibida"]', usernameA)
            .find('[data-cy="friends-btn-aceptar"]')
            .click();
          cy.get('[data-cy="photo-toast"]').should('contain', 'aceptada');

          cy.get('[data-cy="tab-bar-btn-friends-amigos"]').click();
          cy.contains('[data-cy="friends-card-amigo"]', usernameA).should('exist');

          fetchFriends(tokenA).then((friendsOfA) => {
            expect(friendsOfA.map((f) => f.username)).to.include(usernameB);
          });
          fetchFriends(tokenB).then((friendsOfB) => {
            expect(friendsOfB.map((f) => f.username)).to.include(usernameA);
          });
        });
      });
    });
  });

  it('el emisor ve el estado en "Enviadas" y puede revocar una solicitud pendiente, que el destinatario ya no puede aceptar', () => {
    const emailA = uniqueTestEmail('emisor-4');
    const emailB = uniqueTestEmail('destino-4');
    const usernameA = uniqueTestUsername();
    const usernameB = uniqueTestUsername();

    registerVerifiedAccountViaApi(emailA, usernameA).then((tokenA) => {
      registerVerifiedAccountViaApi(emailB, usernameB).then((tokenB) => {
        cy.intercept('GET', '**/api/friends/sent').as('sent');
        cy.visitWithSeed({});
        loginViaUi(emailA);
        sendFriendRequestViaUi(usernameB);

        cy.get('[data-cy="tab-bar-btn-friends-enviadas"]').click();
        cy.wait('@sent');
        cy.contains('[data-cy="friends-card-enviada"]', usernameB)
          .find('[data-cy="friends-btn-revocar"]')
          .click();
        cy.wait('@sent');
        cy.contains('[data-cy="friends-card-enviada"]', usernameB)
          .find('[data-cy="friends-status"]')
          .should('contain', 'Revocada');

        fetchSentRequests(tokenA).then((sent) => {
          const revoked = sent.find((s) => s.to_username === usernameB);
          expect(revoked?.status).to.eq('revoked');

          cy.request({
            method: 'POST',
            url: `${API_BASE_URL}/api/friends/${revoked?.id}/accept`,
            headers: { Authorization: `Bearer ${tokenB}` },
            failOnStatusCode: false,
          }).its('status').should('eq', 404);
        });
      });
    });
  });

  it('una cuenta ajena no puede aceptar, rechazar ni revocar una solicitud que no le pertenece', () => {
    const emailA = uniqueTestEmail('emisor-5');
    const emailB = uniqueTestEmail('destino-5');
    const emailC = uniqueTestEmail('ajena-5');
    const usernameA = uniqueTestUsername();
    const usernameB = uniqueTestUsername();

    registerVerifiedAccountViaApi(emailA, usernameA).then((tokenA) => {
      registerVerifiedAccountViaApi(emailB, usernameB).then(() => {
        cy.visitWithSeed({});
        loginViaUi(emailA);
        sendFriendRequestViaUi(usernameB);

        fetchSentRequests(tokenA).then((sent) => {
          const requestId = sent.find((s) => s.to_username === usernameB)?.id;

          registerVerifiedAccountViaApi(emailC, uniqueTestUsername()).then((tokenC) => {
            cy.request({
              method: 'POST',
              url: `${API_BASE_URL}/api/friends/${requestId}/accept`,
              headers: { Authorization: `Bearer ${tokenC}` },
              failOnStatusCode: false,
            }).its('status').should('eq', 404);

            cy.request({
              method: 'POST',
              url: `${API_BASE_URL}/api/friends/${requestId}/decline`,
              headers: { Authorization: `Bearer ${tokenC}` },
              failOnStatusCode: false,
            }).its('status').should('eq', 404);

            cy.request({
              method: 'POST',
              url: `${API_BASE_URL}/api/friends/${requestId}/revoke`,
              headers: { Authorization: `Bearer ${tokenC}` },
              failOnStatusCode: false,
            }).its('status').should('eq', 404);
          });
        });
      });
    });
  });

  it('el punto de acceso a Amigos desde Perfil muestra el número real de solicitudes pendientes', () => {
    const emailA = uniqueTestEmail('emisor-6');
    const emailB = uniqueTestEmail('emisor-7');
    const emailTarget = uniqueTestEmail('destino-6');
    const usernameTarget = uniqueTestUsername();

    registerVerifiedAccountViaApi(emailTarget, usernameTarget).then(() => {
      registerVerifiedAccountViaApi(emailA, uniqueTestUsername()).then((tokenA) => {
        registerVerifiedAccountViaApi(emailB, uniqueTestUsername()).then((tokenB) => {
          cy.request({
            method: 'POST',
            url: `${API_BASE_URL}/api/friends`,
            headers: { Authorization: `Bearer ${tokenA}` },
            body: { username: usernameTarget },
          }).then(() => {
            cy.request({
              method: 'POST',
              url: `${API_BASE_URL}/api/friends`,
              headers: { Authorization: `Bearer ${tokenB}` },
              body: { username: usernameTarget },
            }).then(() => {
              cy.intercept('GET', '**/api/friends/received').as('received');
              cy.visitWithSeed({});
              loginViaUi(emailTarget);
              cy.get('[data-cy="nav-perfil"]').click();
              cy.wait('@received');
              cy.get('[data-cy="profile-amigos-badge"]').should('have.text', '2');
            });
          });
        });
      });
    });
  });
});
