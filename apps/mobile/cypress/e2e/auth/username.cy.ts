/// <reference types="cypress" />

/**
 * E2E de `nombre-usuario`: backend real (`docker compose up` en
 * `infra/docker/`), sin mockear `apps/api` — mismo criterio que `auth.cy.ts`.
 *
 * Cubre, además de 7.1-7.3 (tasks.md): los 4 escenarios de bloqueo/desbloqueo
 * originalmente planeados como tests Vitest de `app.element.ts` (5.3-5.6,
 * desviados aquí por convención del proyecto — `app.element.ts` no tiene
 * ningún spec, se verifica solo vía Cypress, ver tasks.md 5.3-5.6) y el gap
 * de diseño encontrado al escribir este spec: el bloqueo debe dispararse
 * también en un login interactivo dentro de una sesión de app ya abierta,
 * no solo al reiniciar la app (ver design.md, Decisión 3 actualizada).
 *
 * Las cuentas "sin username" (simulando una cuenta preexistente a la
 * migración 0012) se registran vía API con un username válido y luego se les
 * anula por SQL directo — la migración deja la columna `NULL`-able a
 * propósito (design.md, Decisión 1), así que esto reproduce fielmente el
 * estado real de una cuenta pre-migración sin tener que tocar el registro
 * público (que ahora exige username siempre).
 */

const TEST_EMAIL_PREFIX = 'cypress-username';
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

function clearUsernameViaSql(email: string): Cypress.Chainable {
  return cy.exec(
    `docker exec docker-postgres-1 psql -U motoroutes -d motoroutes -c "UPDATE users SET username = NULL WHERE email = '${email}';"`,
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
}

describe('Nombre de usuario - registro, bloqueo de cuentas existentes y edición desde Perfil', () => {
  after(() => {
    cy.exec(
      `docker exec docker-postgres-1 psql -U motoroutes -d motoroutes -c "DELETE FROM users WHERE email LIKE '${TEST_EMAIL_PREFIX}-%';"`,
      { failOnNonZeroExit: false },
    );
  });

  it('registro completo con username, login posterior sin bloqueo (7.1)', () => {
    const email = uniqueTestEmail('registro');
    const username = uniqueTestUsername();
    cy.visit('/');
    openProfile();

    cy.get('[data-cy="auth-btn-abrir-registro"]').click();
    cy.get('[data-cy="auth-input-email-registro"]').type(email);
    cy.get('[data-cy="auth-input-password-registro"]').type(TEST_PASSWORD);
    cy.get('[data-cy="auth-input-username-registro"]').type(username);
    cy.get('[data-cy="auth-btn-confirmar-registro"]').click();
    cy.get('[data-cy="auth-dialog-registro"]').should('contain', 'verifica tu cuenta');
    cy.get('[data-cy="auth-btn-confirmar-registro"]').click();
    cy.get('[data-cy="auth-dialog-registro"]').should('not.exist');

    markEmailVerified(email);

    loginViaUi(email);

    cy.get('[data-cy="auth-dialog-login"]').should('not.exist');
    cy.get('[data-cy="username-gate"]').should('not.exist');
    cy.get('[data-cy="profile-name"]').should('contain', username);

    cy.get('[data-cy="nav-grabar"]').click();
    cy.get('[data-cy="cockpit-master-btn"]').should('be.visible');
  });

  it('una cuenta sin username sembrada por API queda bloqueada al iniciar sesión por UI, y fijar uno disponible restaura el acceso (7.2, cubre 5.3-5.6)', () => {
    const email = uniqueTestEmail('bloqueo');
    registerVerifiedAccountViaApi(email).then(() => {
      clearUsernameViaSql(email);
    });

    cy.visit('/');
    // Sin sesión (arranque en frío, `MemorySessionRepository` en Cypress): sin bloqueo, nav-bar visible con normalidad (parte de 5.3-5.6, "sin bloqueo si no hay sesión").
    cy.get('[data-cy="username-gate"]').should('not.exist');
    cy.get('[data-cy="nav-perfil"]').should('be.visible');

    openProfile();
    loginViaUi(email);

    // Login interactivo (app ya abierta, no un reinicio) con una cuenta sin username: bloqueo inmediato (gap de diseño corregido en este mismo cambio, ver design.md Decisión 3).
    cy.get('[data-cy="username-gate"]').should('be.visible');
    cy.get('nav-bar').should('not.be.visible');
    cy.get('[data-cy="cockpit-master-btn"]').should('not.be.visible');

    const newUsername = uniqueTestUsername();
    cy.get('[data-cy="username-form-input"]').type(newUsername);
    cy.get('[data-cy="username-form-btn-guardar"]').click();

    // Fijar un username disponible restaura el acceso sin pedir un nuevo login.
    // `username-gate` se construye una vez bajo demanda y se oculta con
    // display:none al cambiar de vista (showView()), nunca se elimina del DOM
    // — mismo patrón que nav-bar más abajo, `not.exist` nunca pasaría aquí.
    cy.get('[data-cy="username-gate"]').should('not.be.visible');
    cy.get('[data-cy="nav-perfil"]').should('be.visible');
    cy.get('[data-cy="cockpit-master-btn"]').should('be.visible');

    openProfile();
    cy.get('[data-cy="profile-name"]').should('contain', newUsername);
  });

  it('editar el username desde Perfil: éxito con uno disponible y rechazo por uno ya en uso (7.3)', () => {
    const emailA = uniqueTestEmail('editar-a');
    const emailB = uniqueTestEmail('editar-b');

    // Los valores resueltos por `.then()` (usernameA/usernameB) solo son seguros de leer
    // *dentro* de callbacks `.then()` posteriores, nunca en el cuerpo síncrono de `it()`:
    // Cypress construye toda la cola de comandos de una vez, antes de que estos `.then()`
    // se ejecuten — leerlos fuera de un callback captura el valor inicial, no el resuelto
    // (mismo patrón anidado que `route-sharing.cy.ts`).
    registerVerifiedAccountViaApi(emailA).then((usernameA) => {
      registerVerifiedAccountViaApi(emailB).then((usernameB) => {
        cy.visit('/');
        openProfile();
        loginViaUi(emailA);
        cy.get('[data-cy="auth-dialog-login"]').should('not.exist');
        openProfile();
        cy.get('[data-cy="profile-name"]').should('contain', usernameA);

        // Un único botón "Editar" en la pantalla principal — el username se edita desde dentro de "Editar perfil" (unificar-perfil-cuenta).
        cy.get('[data-cy="profile-btn-editar-perfil"]').click();
        cy.get('[data-cy="profile-btn-editar-username"]').click();
        cy.get('[data-cy="username-edit-dialog"]').should('be.visible');

        // Rechazo por username ya en uso (de la cuenta B): el diálogo permanece abierto, sin cambiar el username mostrado.
        cy.get('[data-cy="username-form-input"]').clear();
        cy.get('[data-cy="username-form-input"]').type(usernameB);
        cy.get('[data-cy="username-form-btn-guardar"]').click();
        cy.get('[data-cy="username-form-error"]').should('be.visible');
        cy.get('[data-cy="username-edit-dialog"]').should('exist');

        // Cancelar sin guardar: el username no cambia, "Editar perfil" sigue abierto detrás.
        cy.get('[data-cy="username-edit-dialog-btn-cancelar"]').click();
        cy.get('[data-cy="username-edit-dialog"]').should('not.exist');
        cy.get('[data-cy="profile-edit-dialog-overlay"]').should('exist');

        // Éxito con uno disponible, sin volver a abrir "Editar perfil".
        const newUsername = uniqueTestUsername();
        cy.get('[data-cy="profile-btn-editar-username"]').click();
        cy.get('[data-cy="username-form-input"]').clear();
        cy.get('[data-cy="username-form-input"]').type(newUsername);
        cy.get('[data-cy="username-form-btn-guardar"]').click();
        cy.get('[data-cy="username-edit-dialog"]').should('not.exist');

        // Cerrar "Editar perfil" ("Cancelar" solo descarta la foto elegida, nunca un username ya guardado) y comprobarlo en la pantalla principal.
        cy.get('[data-cy="profile-btn-cancelar-perfil"]').click();
        cy.get('[data-cy="profile-edit-dialog-overlay"]').should('not.exist');
        cy.get('[data-cy="profile-name"]').should('contain', newUsername).and('not.contain', usernameA);
      });
    });
  });
});
