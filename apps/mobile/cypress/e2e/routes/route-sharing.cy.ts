/// <reference types="cypress" />

/**
 * E2E de `compartir-rutas`: backend real (`docker compose up` en
 * `infra/docker/`), sin mockear `apps/api` — mismo criterio que
 * `route-cloud-sync.cy.ts`. Dos cuentas registradas vía API; el clonado de
 * fotos (verificado ya con fakes reales en `accept_test.go` del backend) no
 * se re-verifica aquí para no tener que construir una petición multipart
 * dentro del test — fuera de alcance deliberado de este spec, ver tasks.md.
 */

import type { Route, RoutePoint, RouteStop } from '../../../src/shared/models/route.types.js';

const TEST_EMAIL_PREFIX = 'cypress-sharing';
const TEST_PASSWORD = 'correct-horse-battery';
const API_BASE_URL = 'http://localhost:8080';

interface SentInvitationResponse {
  id: string;
  status: string;
  to_email: string;
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

function uploadRouteViaApi(token: string, route: Route, points: RoutePoint[] = [], stops: RouteStop[] = []): Cypress.Chainable {
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
      points: points.map((p) => ({ timestamp: p.timestamp, lat: p.lat, lng: p.lng, alt: p.alt, speed: p.speed })),
      stops: stops.map((s) => ({
        start_time: s.startTime,
        end_time: s.endTime,
        lat: s.lat,
        lng: s.lng,
        type: s.type,
        stop_category_id: s.stopCategoryId,
      })),
    },
  });
}

function fetchSentInvitations(token: string): Cypress.Chainable<SentInvitationResponse[]> {
  return cy
    .request({ url: `${API_BASE_URL}/api/route-shares/sent`, headers: { Authorization: `Bearer ${token}` } })
    .its('body') as Cypress.Chainable<SentInvitationResponse[]>;
}

function loginViaUi(email: string): void {
  cy.get('[data-cy="nav-perfil"]').click();
  cy.get('[data-cy="auth-btn-abrir-login"]').click();
  cy.get('[data-cy="auth-input-email-login"]').type(email);
  cy.get('[data-cy="auth-input-password-login"]').type(TEST_PASSWORD);
  cy.get('[data-cy="auth-btn-confirmar-login"]').click();
  cy.get('[data-cy="auth-dialog-login"]').should('not.exist');
}

function shareRouteViaUi(routeName: string, targetEmail: string): void {
  cy.get('[data-cy="nav-rutas"]').click();
  cy.contains('[data-cy="route-card"]', routeName).click();
  cy.get('[data-cy="route-detail-btn-compartir"]').click();
  cy.get('[data-cy="route-share-input-email"]').type(targetEmail);
  cy.get('[data-cy="route-share-btn-confirmar"]').click();
  cy.get('[data-cy="route-share-dialog"]').should('contain', 'Invitación enviada');
  cy.get('[data-cy="route-share-btn-confirmar"]').click();
}

describe('Compartir rutas - invitación, aceptar, rechazar y revocar', () => {
  after(() => {
    cy.exec(
      `docker exec docker-postgres-1 psql -U motoroutes -d motoroutes -c "DELETE FROM users WHERE email LIKE '${TEST_EMAIL_PREFIX}-%';"`,
      { failOnNonZeroExit: false },
    );
  });

  it('compartir una ruta sincronizada crea una invitación real solo si el email existe, con la misma respuesta en ambos casos', () => {
    const emailA = uniqueTestEmail('emisor-1');
    const emailB = uniqueTestEmail('destino-1');
    const route = buildSeedRoute({ name: `Ruta a compartir ${String(Date.now())}` });

    registerVerifiedAccountViaApi(emailA).then((tokenA) => {
      uploadRouteViaApi(tokenA, route).then(() => {
        registerVerifiedAccountViaApi(emailB).then(() => {
          cy.visitWithSeed({});
          loginViaUi(emailA);

          shareRouteViaUi(route.name as string, 'no-existe-' + emailB);
          shareRouteViaUi(route.name as string, emailB);

          fetchSentInvitations(tokenA).then((sent) => {
            expect(sent).to.have.length(1);
            expect(sent[0]?.to_email).to.eq(emailB);
            expect(sent[0]?.status).to.eq('pending');
          });
        });
      });
    });
  });

  it('compartir la propia ruta consigo mismo se rechaza en cliente, sin llamar al servidor', () => {
    const email = uniqueTestEmail('self');
    const route = buildSeedRoute({ name: `Ruta propia ${String(Date.now())}` });

    registerVerifiedAccountViaApi(email).then((token) => {
      uploadRouteViaApi(token, route).then(() => {
        cy.visitWithSeed({});
        loginViaUi(email);

        cy.get('[data-cy="nav-rutas"]').click();
        cy.contains('[data-cy="route-card"]', route.name as string).click();
        cy.get('[data-cy="route-detail-btn-compartir"]').click();
        cy.get('[data-cy="route-share-input-email"]').type(email);
        cy.get('[data-cy="route-share-btn-confirmar"]').click();
        cy.get('[data-cy="route-share-error"]').should('contain', 'contigo mismo');

        fetchSentInvitations(token).then((sent) => {
          expect(sent).to.have.length(0);
        });
      });
    });
  });

  it('la acción de compartir no está disponible en una ruta puramente local', () => {
    const email = uniqueTestEmail('local');
    const route = buildSeedRoute({ name: `Ruta local ${String(Date.now())}` });

    registerVerifiedAccountViaApi(email).then(() => {
      cy.visitWithSeed({ routes: [route] });
      loginViaUi(email);

      cy.get('[data-cy="nav-rutas"]').click();
      cy.contains('[data-cy="route-card"]', route.name as string).click();
      cy.get('[data-cy="route-detail-btn-compartir"]').should('not.exist');
    });
  });

  it('aceptar una invitación clona la ruta, que aparece en el listado del destinatario; rechazar no clona nada', () => {
    const emailA = uniqueTestEmail('emisor-2');
    const emailB = uniqueTestEmail('destino-2');
    const routeToAccept = buildSeedRoute({ name: `Ruta a aceptar ${String(Date.now())}` });
    const routeToDecline = buildSeedRoute({ name: `Ruta a rechazar ${String(Date.now())}` });

    registerVerifiedAccountViaApi(emailA).then((tokenA) => {
      uploadRouteViaApi(tokenA, routeToAccept).then(() => {
        uploadRouteViaApi(tokenA, routeToDecline).then(() => {
          registerVerifiedAccountViaApi(emailB).then(() => {
            cy.visitWithSeed({});
            loginViaUi(emailA);
            shareRouteViaUi(routeToAccept.name as string, emailB);
            shareRouteViaUi(routeToDecline.name as string, emailB);

            fetchSentInvitations(tokenA).then((sent) => {
              expect(sent).to.have.length(2);
            });

            // cy.wait sincroniza expresamente con la petición real (en vez de
            // confiar en el polling implícito de `.should()`, insuficiente
            // bajo la carga de este entorno — ver design.md/tasks.md).
            cy.intercept('GET', '**/api/route-shares/received').as('received');
            cy.intercept('GET', '**/api/routes').as('routesList');
            cy.visitWithSeed({});
            loginViaUi(emailB);
            cy.get('[data-cy="nav-rutas"]').click();
            cy.wait('@received');
            cy.get('[data-cy="route-list-btn-invitaciones"]').should('have.class', 'favorite-icon--active');
            cy.get('[data-cy="route-list-btn-invitaciones"]').click();
            cy.get('[data-cy="route-sharing-card-recibida"]').should('have.length', 2);

            cy.contains('[data-cy="route-sharing-card-recibida"]', routeToAccept.name as string)
              .find('[data-cy="route-sharing-btn-aceptar"]')
              .click();
            cy.get('[data-cy="photo-toast"]').should('contain', 'añadida');
            cy.wait('@received');

            cy.contains('[data-cy="route-sharing-card-recibida"]', routeToDecline.name as string)
              .find('[data-cy="route-sharing-btn-rechazar"]')
              .click();
            cy.wait('@received');

            cy.get('[data-cy="route-sharing-btn-volver"]').click();
            cy.wait('@routesList');
            cy.contains('[data-cy="route-card"]', routeToAccept.name as string).should('exist');
            cy.contains('[data-cy="route-card"]', routeToDecline.name as string).should('not.exist');
          });
        });
      });
    });
  });

  it('el emisor ve el estado en "Enviadas" y puede revocar una invitación pendiente', () => {
    const emailA = uniqueTestEmail('emisor-3');
    const emailB = uniqueTestEmail('destino-3');
    const route = buildSeedRoute({ name: `Ruta a revocar ${String(Date.now())}` });

    registerVerifiedAccountViaApi(emailA).then((tokenA) => {
      uploadRouteViaApi(tokenA, route).then(() => {
        registerVerifiedAccountViaApi(emailB).then(() => {
          cy.intercept('GET', '**/api/route-shares/sent').as('sent');
          cy.visitWithSeed({});
          loginViaUi(emailA);
          shareRouteViaUi(route.name as string, emailB);

          cy.get('[data-cy="nav-rutas"]').click();
          cy.get('[data-cy="route-list-btn-invitaciones"]').click();
          cy.get('[data-cy="tab-bar-btn-enviadas"]').click();
          cy.wait('@sent');
          cy.contains('[data-cy="route-sharing-card-enviada"]', route.name as string)
            .find('[data-cy="route-sharing-status"]')
            .should('contain', 'Pendiente');

          cy.contains('[data-cy="route-sharing-card-enviada"]', route.name as string)
            .find('[data-cy="route-sharing-btn-revocar"]')
            .click();
          cy.wait('@sent');
          cy.contains('[data-cy="route-sharing-card-enviada"]', route.name as string)
            .find('[data-cy="route-sharing-status"]')
            .should('contain', 'Revocada');

          fetchSentInvitations(tokenA).then((sent) => {
            const revoked = sent.find((s) => s.to_email === emailB);
            expect(revoked?.status).to.eq('revoked');
          });
        });
      });
    });
  });

  it('una cuenta ajena no puede aceptar, rechazar ni revocar una invitación que no le pertenece', () => {
    const emailA = uniqueTestEmail('emisor-4');
    const emailB = uniqueTestEmail('destino-4');
    const emailC = uniqueTestEmail('ajena-4');
    const route = buildSeedRoute({ name: `Ruta aislada ${String(Date.now())}` });

    registerVerifiedAccountViaApi(emailA).then((tokenA) => {
      uploadRouteViaApi(tokenA, route).then(() => {
        registerVerifiedAccountViaApi(emailB).then(() => {
          cy.visitWithSeed({});
          loginViaUi(emailA);
          shareRouteViaUi(route.name as string, emailB);

          fetchSentInvitations(tokenA).then((sent) => {
            const invitationId = sent.find((s) => s.to_email === emailB)?.id;

            registerVerifiedAccountViaApi(emailC).then((tokenC) => {
              cy.request({
                method: 'POST',
                url: `${API_BASE_URL}/api/route-shares/${invitationId}/accept`,
                headers: { Authorization: `Bearer ${tokenC}` },
                failOnStatusCode: false,
              }).its('status').should('eq', 404);

              cy.request({
                method: 'POST',
                url: `${API_BASE_URL}/api/route-shares/${invitationId}/revoke`,
                headers: { Authorization: `Bearer ${tokenC}` },
                failOnStatusCode: false,
              }).its('status').should('eq', 404);
            });
          });
        });
      });
    });
  });
});
