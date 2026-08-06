/// <reference types="cypress" />

/**
 * E2E de las pantallas de auth (`pantallas-auth-mobile`): backend real
 * (`docker compose up` en `infra/docker/`), sin mockear `apps/api` — mismo
 * criterio que `cockpit-mark-stop.cy.ts` (ADR-035).
 *
 * Solo el escenario de login correcto necesita una cuenta con el email ya
 * verificado, y verificarla de verdad exigiría recibir un email real
 * (inviable en CI, cuota de Resend limitada) — se siembra con una consulta
 * SQL directa contra el Postgres real vía `cy.exec` (ver design.md), tras un
 * registro real por la propia UI. Todos los demás escenarios (contraseña
 * débil, email duplicado, credenciales incorrectas, email sin verificar +
 * reenvío) no necesitan ese paso: una cuenta recién registrada ya está sin
 * verificar por defecto, que es exactamente el estado que hace falta.
 */

const TEST_EMAIL_PREFIX = 'cypress-auth';
const TEST_PASSWORD = 'correct-horse-battery';

function uniqueTestEmail(suffix: string): string {
  return `${TEST_EMAIL_PREFIX}-${String(Date.now())}-${suffix}@example.com`;
}

function openProfile(): void {
  cy.get('[data-cy="nav-perfil"]').click();
  cy.get('profile-view').should('be.visible');
}

function markEmailVerified(email: string): Cypress.Chainable {
  return cy.exec(
    `docker exec docker-postgres-1 psql -U motoroutes -d motoroutes -c "UPDATE users SET email_verified = true WHERE email = '${email}';"`,
  );
}

describe('Pantallas de auth - registro, login, recuperación y cierre de sesión', () => {
  after(() => {
    // Limpieza de todas las cuentas de prueba creadas en esta suite —
    // mismo criterio ya seguido a mano en producción durante esta sesión
    // (ADR-038/039): nunca dejar datos de prueba sueltos.
    cy.exec(
      `docker exec docker-postgres-1 psql -U motoroutes -d motoroutes -c "DELETE FROM users WHERE email LIKE '${TEST_EMAIL_PREFIX}-%';"`,
      { failOnNonZeroExit: false },
    );
  });

  it('registro rechazado por contraseña débil, sin cerrar el diálogo', () => {
    cy.visit('/');
    openProfile();

    cy.get('[data-cy="auth-btn-abrir-registro"]').click();
    cy.get('[data-cy="auth-input-email-registro"]').type(uniqueTestEmail('weak'));
    cy.get('[data-cy="auth-input-password-registro"]').type('short');
    cy.get('[data-cy="auth-btn-confirmar-registro"]').click();

    cy.get('[data-cy="auth-dialog-registro"] .error').should('be.visible');
    cy.get('[data-cy="auth-dialog-registro"]').should('exist');
  });

  it('registro rechazado por email ya existente', () => {
    const email = uniqueTestEmail('duplicado');
    cy.visit('/');
    openProfile();

    cy.get('[data-cy="auth-btn-abrir-registro"]').click();
    cy.get('[data-cy="auth-input-email-registro"]').type(email);
    cy.get('[data-cy="auth-input-password-registro"]').type(TEST_PASSWORD);
    cy.get('[data-cy="auth-btn-confirmar-registro"]').click();
    // Espera a que el diálogo transicione al paso de éxito antes del segundo
    // click ("Entendido") — sin esto, el segundo click puede llegar mientras
    // todavía se ve el formulario y disparar un registro duplicado en vez de
    // cerrar el diálogo (condición de carrera, no un bug de la app).
    cy.get('[data-cy="auth-dialog-registro"]').should('contain', 'verifica tu cuenta');
    cy.get('[data-cy="auth-btn-confirmar-registro"]').click(); // cierra el paso de éxito ("Entendido")
    cy.get('[data-cy="auth-dialog-registro"]').should('not.exist');

    cy.get('[data-cy="auth-btn-abrir-registro"]').click();
    cy.get('[data-cy="auth-input-email-registro"]').type(email);
    cy.get('[data-cy="auth-input-password-registro"]').type(TEST_PASSWORD);
    cy.get('[data-cy="auth-btn-confirmar-registro"]').click();

    cy.get('[data-cy="auth-dialog-registro"] .error').should('be.visible');
  });

  it('login rechazado por credenciales incorrectas', () => {
    cy.visit('/');
    openProfile();

    cy.get('[data-cy="auth-btn-abrir-login"]').click();
    cy.get('[data-cy="auth-input-email-login"]').type(uniqueTestEmail('inexistente'));
    cy.get('[data-cy="auth-input-password-login"]').type('whatever-password');
    cy.get('[data-cy="auth-btn-confirmar-login"]').click();

    cy.get('[data-cy="auth-dialog-login"] .error').should('be.visible');
    cy.get('[data-cy="auth-btn-reenviar-verificacion"]').should('not.exist');
  });

  it('registro real seguido de login rechazado por email sin verificar, con reenvío funcional', () => {
    const email = uniqueTestEmail('sin-verificar');
    cy.visit('/');
    openProfile();

    cy.get('[data-cy="auth-btn-abrir-registro"]').click();
    cy.get('[data-cy="auth-input-email-registro"]').type(email);
    cy.get('[data-cy="auth-input-password-registro"]').type(TEST_PASSWORD);
    cy.get('[data-cy="auth-btn-confirmar-registro"]').click();
    cy.get('[data-cy="auth-dialog-registro"]').should('contain', 'verifica tu cuenta');
    cy.get('[data-cy="auth-btn-confirmar-registro"]').click();
    cy.get('[data-cy="auth-dialog-registro"]').should('not.exist');

    cy.get('[data-cy="auth-btn-abrir-login"]').click();
    cy.get('[data-cy="auth-input-email-login"]').type(email);
    cy.get('[data-cy="auth-input-password-login"]').type(TEST_PASSWORD);
    cy.get('[data-cy="auth-btn-confirmar-login"]').click();

    cy.get('[data-cy="auth-btn-reenviar-verificacion"]').should('be.visible').click();
    cy.get('[data-cy="auth-dialog-login"]').should('contain', 'enviado');
    cy.get('[data-cy="auth-dialog-login"]').should('exist'); // no reintenta el login ni se cierra solo
  });

  it('recuperar contraseña muestra el mensaje genérico de confirmación', () => {
    cy.visit('/');
    openProfile();

    cy.get('[data-cy="auth-btn-abrir-recuperar"]').click();
    cy.get('[data-cy="auth-input-email-recuperar"]').type(uniqueTestEmail('recuperar'));
    cy.get('[data-cy="auth-btn-confirmar-recuperar"]').click();

    cy.get('[data-cy="auth-dialog-recuperar"]').should('contain', 'email');
  });

  it('login correcto (cuenta verificada por SQL) guarda sesión, Perfil la muestra, y cerrar sesión vuelve al estado inicial', () => {
    const email = uniqueTestEmail('verificada');
    cy.visit('/');
    openProfile();

    cy.get('[data-cy="auth-btn-abrir-registro"]').click();
    cy.get('[data-cy="auth-input-email-registro"]').type(email);
    cy.get('[data-cy="auth-input-password-registro"]').type(TEST_PASSWORD);
    cy.get('[data-cy="auth-btn-confirmar-registro"]').click();
    cy.get('[data-cy="auth-dialog-registro"]').should('contain', 'verifica tu cuenta');
    cy.get('[data-cy="auth-btn-confirmar-registro"]').click();
    cy.get('[data-cy="auth-dialog-registro"]').should('not.exist');

    markEmailVerified(email);

    cy.get('[data-cy="auth-btn-abrir-login"]').click();
    cy.get('[data-cy="auth-input-email-login"]').type(email);
    cy.get('[data-cy="auth-input-password-login"]').type(TEST_PASSWORD);
    cy.get('[data-cy="auth-btn-confirmar-login"]').click();

    cy.get('[data-cy="auth-dialog-login"]').should('not.exist');
    cy.get('[data-cy="auth-section-cuenta"]').should('contain', email);
    cy.get('[data-cy="auth-btn-cerrar-sesion"]').should('be.visible');

    // La persistencia tras recargar (sesión en SQLite) no es verificable aquí:
    // Cypress corre en un navegador normal, no en el WebView de Tauri, así que
    // `isTauri()` siempre da `false` y `app.element.ts` usa `MemorySessionRepository`
    // — un `cy.reload()` crea una instancia nueva y vacía. Mismo motivo por el que
    // ningún otro spec de Cypress (rutas, perfil) prueba persistencia SQLite tras
    // recarga; se verifica de verdad en dispositivo real (tasks.md, grupo 10).

    cy.get('[data-cy="auth-btn-cerrar-sesion"]').click();
    cy.get('[data-cy="auth-btn-abrir-login"]').should('be.visible');
    cy.get('[data-cy="auth-btn-cerrar-sesion"]').should('not.exist');
  });
});
