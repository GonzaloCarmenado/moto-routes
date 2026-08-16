/// <reference types="cypress" />

/**
 * E2E de `route-cloud-sync`: backend real (`docker compose up` en
 * `infra/docker/`), sin mockear `apps/api` — mismo criterio que `auth.cy.ts`
 * (ADR-035). Las cuentas de prueba se registran y verifican por completo vía
 * API (`cy.request` + `cy.exec` contra Postgres), sin pasar por la UI —
 * necesario para poder autenticar las llamadas que siembran una ruta
 * "exclusiva de la nube" antes de que el test interactúe con la pantalla.
 */

import type { Route, RoutePoint, RouteStop } from '../../../src/shared/models/route.types.js';

const TEST_EMAIL_PREFIX = 'cypress-routes-cloud';
const TEST_PASSWORD = 'correct-horse-battery';
const API_BASE_URL = 'http://localhost:8080';

function uniqueTestEmail(suffix: string): string {
  return `${TEST_EMAIL_PREFIX}-${String(Date.now())}-${suffix}@example.com`;
}

function markEmailVerified(email: string): Cypress.Chainable {
  return cy.exec(
    `docker exec docker-postgres-1 psql -U motoroutes -d motoroutes -c "UPDATE users SET email_verified = true WHERE email = '${email}';"`,
  );
}

/**
 * Registra, verifica (SQL directo, igual que `auth.cy.ts`) y logea una
 * cuenta enteramente vía API, devolviendo su token — para poder sembrar
 * datos de la nube (`cy.request` autenticado) antes de que el test visite
 * la app. El login *dentro* de la app se hace siempre por la UI real
 * (nunca inyectando el token), igual que el resto de la suite de auth.
 */
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
    // 1800s (30min), no 3600 (1h): igual o por encima del umbral del logro
    // "Ruta larga" (sistema-logros) — con 3600 exactos, subir esta ruta vía
    // UI desbloquearía el logro y su animación cubriría el siguiente click
    // de estos tests (hallazgo real de un fallo intermitente en CI).
    duration: 1800,
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

/** Sube una ruta directamente vía API (sin UI) — para sembrar una ruta "exclusiva de la nube". */
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

/**
 * Comprueba un campo de una ruta contra el servidor real, reintentando la
 * petición HTTP de verdad (no solo releyendo la misma respuesta) hasta que
 * el valor esperado llega o se agota el presupuesto de tiempo — necesario
 * porque la re-subida que dispara este campo es fire-and-forget en segundo
 * plano (design.md D3 de favoritos-rutas): un `cy.request(...).its(...)`
 * encadenado no reintenta la llamada de red en cada retry de `.should()`,
 * solo relee la respuesta ya resuelta la primera vez, así que puede fallar
 * por pura carrera aunque la re-subida sí termine a tiempo.
 */
function expectSyncedField(routeId: string, token: string, field: 'notes' | 'is_favorite', expected: unknown, attempt = 0): void {
  cy.request({
    url: `${API_BASE_URL}/api/routes/${routeId}`,
    headers: { Authorization: `Bearer ${token}` },
  }).then((response) => {
    const actual = (response.body as Record<string, unknown>)[field];
    if (actual === expected || attempt >= 20) {
      expect(actual).to.eq(expected);
      return;
    }
    cy.wait(200);
    expectSyncedField(routeId, token, field, expected, attempt + 1);
  });
}

function loginViaUi(email: string): void {
  cy.get('[data-cy="nav-perfil"]').click();
  cy.get('[data-cy="auth-btn-abrir-login"]').click();
  cy.get('[data-cy="auth-input-email-login"]').type(email);
  cy.get('[data-cy="auth-input-password-login"]').type(TEST_PASSWORD);
  cy.get('[data-cy="auth-btn-confirmar-login"]').click();
  cy.get('[data-cy="auth-dialog-login"]').should('not.exist');
}

describe('Rutas en la nube - subida, listado combinado, detalle y aislamiento entre cuentas', () => {
  after(() => {
    // Limpieza: cuentas de prueba (cascada borra sus rutas subidas) — mismo
    // criterio ya seguido en auth.cy.ts, nunca dejar datos de prueba sueltos.
    cy.exec(
      `docker exec docker-postgres-1 psql -U motoroutes -d motoroutes -c "DELETE FROM users WHERE email LIKE '${TEST_EMAIL_PREFIX}-%';"`,
      { failOnNonZeroExit: false },
    );
  });

  it('subir una ruta local con sesión activa la marca como sincronizada, sin duplicar la tarjeta', () => {
    const email = uniqueTestEmail('subir');
    const route = buildSeedRoute({ name: `Ruta a subir ${String(Date.now())}` });

    registerVerifiedAccountViaApi(email).then(() => {
      cy.visitWithSeed({ routes: [route] });
      loginViaUi(email);

      cy.get('[data-cy="nav-rutas"]').click();
      cy.get('[data-cy="route-card"]').should('have.length', 1);
      cy.contains('[data-cy="route-card"]', route.name as string).click();

      cy.get('[data-cy="route-detail-btn-subir-nube"]').click();
      cy.get('[data-cy="photo-toast"]').should('contain', 'nube');
      cy.get('[data-cy="route-detail-btn-subir-nube"]').should('have.class', 'sync-icon-btn--synced');

      // Vuelve al listado (nav-rutas siempre refresca, ver route-list.element.ts::onNavRutas).
      cy.get('[data-cy="nav-rutas"]').click();
      cy.get('[data-cy="route-card"]').should('have.length', 1);
      cy.contains('[data-cy="route-card"]', route.name as string)
        .find('[data-cy="route-card-sync-badge"]')
        .should('have.attr', 'data-sync-state', 'synced');
    });
  });

  it('guardar una nota en una ruta ya sincronizada la re-sube sola, sin ninguna acción adicional', () => {
    const email = uniqueTestEmail('resync');
    const route = buildSeedRoute({ name: `Ruta a re-subir ${String(Date.now())}` });

    registerVerifiedAccountViaApi(email).then((token) => {
      uploadRouteViaApi(token, route).then(() => {
        cy.visitWithSeed({ routes: [route] });
        loginViaUi(email);

        cy.get('[data-cy="nav-rutas"]').click();
        cy.contains('[data-cy="route-card"]', route.name as string).click();
        cy.get('[data-cy="route-detail-btn-subir-nube"]').should('have.class', 'sync-icon-btn--synced');

        cy.get('[data-cy="tab-bar-btn-notas"]').click();
        cy.get('[data-cy="route-detail-textarea-notas"]').type('Nota real de verificación');
        cy.get('[data-cy="route-detail-btn-guardar-nota"]').click();
        cy.get('[data-cy="photo-toast"]').should('contain', 'Nota guardada');

        // La re-subida es en segundo plano y sin toast propio — se comprueba
        // contra el servidor real, no contra ningún indicador visual nuevo.
        expectSyncedField(route.id, token, 'notes', 'Nota real de verificación');
      });
    });
  });

  it('marcar/desmarcar favorita con sesión activa persiste local y se re-sincroniza sola contra el servidor real', () => {
    const email = uniqueTestEmail('favorito');
    const route = buildSeedRoute({ name: `Ruta favorita ${String(Date.now())}` });

    registerVerifiedAccountViaApi(email).then((token) => {
      uploadRouteViaApi(token, route).then(() => {
        cy.visitWithSeed({ routes: [route] });
        loginViaUi(email);

        cy.get('[data-cy="nav-rutas"]').click();
        cy.contains('[data-cy="route-card"]', route.name as string).click();

        cy.get('[data-cy="route-detail-btn-favorito"]').should('not.have.class', 'favorite-icon--active');
        cy.get('[data-cy="route-detail-btn-favorito"]').click();
        cy.get('[data-cy="route-detail-btn-favorito"]').should('have.class', 'favorite-icon--active');

        // La re-subida es en segundo plano, sin toast propio (favoritos-rutas, design.md D3) —
        // se comprueba contra el servidor real, mismo criterio que la re-subida de notas.
        expectSyncedField(route.id, token, 'is_favorite', true);

        cy.get('[data-cy="route-detail-btn-favorito"]').click();
        cy.get('[data-cy="route-detail-btn-favorito"]').should('not.have.class', 'favorite-icon--active');
      });
    });
  });

  it('marcar favorita desde el listado (sin entrar al detalle) persiste y re-sincroniza sola contra el servidor real', () => {
    const email = uniqueTestEmail('favorito-listado');
    const route = buildSeedRoute({ name: `Ruta favorita desde listado ${String(Date.now())}` });

    registerVerifiedAccountViaApi(email).then((token) => {
      uploadRouteViaApi(token, route).then(() => {
        cy.visitWithSeed({ routes: [route] });
        loginViaUi(email);

        cy.get('[data-cy="nav-rutas"]').click();
        cy.contains('[data-cy="route-card"]', route.name as string)
          .find('[data-cy="route-card-btn-favorito"]')
          .as('favoriteIcon')
          .should('not.have.class', 'favorite-icon--active');

        cy.get('@favoriteIcon').click();
        cy.get('@favoriteIcon').should('have.class', 'favorite-icon--active');

        // La card no navega al detalle al pulsar el icono de favorito (stopPropagation).
        cy.get('[data-cy="route-detail-title"]').should('not.exist');

        expectSyncedField(route.id, token, 'is_favorite', true);
      });
    });
  });

  it('sin sesión activa, el indicador de favorito se muestra pero como <span> no interactivo', () => {
    const route = buildSeedRoute({ name: `Ruta sin sesion favorito ${String(Date.now())}` });

    cy.visitWithSeed({ routes: [route] });
    cy.get('[data-cy="nav-rutas"]').click();
    cy.contains('[data-cy="route-card"]', route.name as string).click();

    cy.get('[data-cy="route-detail-btn-favorito"]').should('exist').and('match', 'span');
  });

  it('sin sesión activa, el listado y el detalle se comportan igual que antes de este cambio', () => {
    const route = buildSeedRoute({ name: `Ruta sin sesion ${String(Date.now())}` });

    cy.visitWithSeed({ routes: [route] });
    cy.get('[data-cy="nav-rutas"]').click();

    cy.get('[data-cy="route-card-sync-badge"]').should('not.exist');
    cy.contains('[data-cy="route-card"]', route.name as string).click();
    cy.get('[data-cy="route-detail-btn-subir-nube"]').should('not.exist');
  });

  it('una ruta exclusiva de la nube (sembrada vía API) aparece en el listado y su detalle se abre igual que uno local', () => {
    const email = uniqueTestEmail('nube');
    const cloudRoute = buildSeedRoute({ name: `Ruta solo en la nube ${String(Date.now())}` });
    const points: RoutePoint[] = [
      { id: crypto.randomUUID(), routeId: cloudRoute.id, timestamp: Date.now() - 60_000, lat: 41.38, lng: 2.17, alt: 10, speed: 40 },
      { id: crypto.randomUUID(), routeId: cloudRoute.id, timestamp: Date.now(), lat: 41.39, lng: 2.18, alt: 12, speed: 45 },
    ];

    registerVerifiedAccountViaApi(email).then((token) => {
      uploadRouteViaApi(token, cloudRoute, points).then(() => {
        cy.visitWithSeed({});
        loginViaUi(email);

        cy.get('[data-cy="nav-rutas"]').click();
        cy.contains('[data-cy="route-card"]', cloudRoute.name as string)
          .find('[data-cy="route-card-sync-badge"]')
          .should('have.attr', 'data-sync-state', 'cloud-only');

        cy.contains('[data-cy="route-card"]', cloudRoute.name as string).click();
        cy.get('[data-cy="route-detail-title"]').should('contain', cloudRoute.name as string);
        cy.get('[data-cy="route-detail-load-error"]').should('not.exist');
        // Ruta exclusiva de la nube: sin datos locales de los que subir nada.
        cy.get('[data-cy="route-detail-btn-subir-nube"]').should('not.exist');
      });
    });
  });

  it('aislamiento entre cuentas: una segunda cuenta no ve las rutas de la primera', () => {
    const emailA = uniqueTestEmail('cuenta-a');
    const emailB = uniqueTestEmail('cuenta-b');
    const routeA = buildSeedRoute({ name: `Ruta de la cuenta A ${String(Date.now())}` });

    registerVerifiedAccountViaApi(emailA)
      .then((tokenA) => uploadRouteViaApi(tokenA, routeA))
      .then(() => registerVerifiedAccountViaApi(emailB))
      .then(() => {
        cy.visitWithSeed({});
        loginViaUi(emailB);

        cy.get('[data-cy="nav-rutas"]').click();
        cy.contains('[data-cy="route-card"]', routeA.name as string).should('not.exist');
      });
  });
});
