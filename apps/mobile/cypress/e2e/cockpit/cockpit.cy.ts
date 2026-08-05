/// <reference types="cypress" />

import { stubGpsPermissionGranted } from '../../support/commands.js';

describe('Cockpit - Grabación de Rutas', () => {
  beforeEach(() => {
    cy.visit('/', { onBeforeLoad: stubGpsPermissionGranted });
  });

  it('should show speed at 0 and the master button ready to start on load', () => {
    cy.get('[data-cy="cockpit-master-btn"]').should('have.attr', 'aria-label', 'Iniciar grabación');
    cy.get('[data-cy="cockpit-speed-value"]').should('contain', '0');
  });

  it('should switch the master button to "finalizar" when recording', () => {
    cy.get('[data-cy="cockpit-master-btn"]').click();
    cy.get('[data-cy="cockpit-master-btn"]').should('have.attr', 'aria-label', 'Mantén pulsado para finalizar la ruta');
  });

  it('should enable the pause button during recording', () => {
    cy.get('[data-cy="cockpit-master-btn"]').click();
    cy.get('[data-cy="cockpit-pause-btn"]').should('be.visible').and('not.be.disabled');
    cy.get('[data-cy="cockpit-pause-btn"]').should('have.attr', 'aria-label', 'Pausar ruta');
  });

  it('should switch to "finalizar" and enable the pause button as "Pausar ruta" when starting a recording (AC-014)', () => {
    cy.get('[data-cy="cockpit-master-btn"]').click();
    cy.get('[data-cy="cockpit-master-btn"]').should('have.attr', 'aria-label', 'Mantén pulsado para finalizar la ruta');
    cy.get('[data-cy="cockpit-pause-btn"]').should('not.be.disabled');
    cy.get('[data-cy="cockpit-pause-btn"]').should('have.attr', 'aria-label', 'Pausar ruta');
  });

  it('should toggle the pause button between "Pausar ruta" and "Reanudar ruta" (AC-015)', () => {
    cy.get('[data-cy="cockpit-master-btn"]').click();
    cy.get('[data-cy="cockpit-pause-btn"]').click();
    cy.get('[data-cy="cockpit-pause-btn"]').should('have.attr', 'aria-label', 'Reanudar ruta');
    // Pausar abre también el modal de tipo de parada (catalogo-tipos-parada) — se
    // cierra sin elegir (botón Cancelar) antes de continuar, no bloquea el toggle
    // de pausa. `cy.type('{esc}')` no vale aquí: el foco delegado al Shadow DOM del
    // diálogo hace que `document.activeElement` sea el propio custom element, no un
    // elemento "typeable" válido para Cypress.
    cy.get('[data-cy="stop-type-dialog-cancel"]').click();
    cy.get('[data-cy="cockpit-pause-btn"]').click();
    cy.get('[data-cy="cockpit-pause-btn"]').should('have.attr', 'aria-label', 'Pausar ruta');
  });

  it('should open the save-route dialog after a long-press on the master button (AC-016)', () => {
    cy.get('[data-cy="cockpit-master-btn"]').click();
    cy.get('[data-cy="cockpit-master-btn"]').trigger('pointerdown');
    // LONG_PRESS_MS = 1500 (src/cockpit/cockpit.element.ts) — tiempo real, sin timers falseables.
    cy.wait(1700);
    cy.get('[data-cy="save-route-dialog-input-name"]').should('be.visible');
  });

  it('should save the route with the given name, show a success toast and reset the master button (AC-017)', () => {
    cy.get('[data-cy="cockpit-master-btn"]').click();
    cy.get('[data-cy="cockpit-master-btn"]').trigger('pointerdown');
    cy.wait(1700);
    cy.get('[data-cy="save-route-dialog-input-name"]').type('Ruta de prueba');
    cy.get('[data-cy="save-route-dialog-action-save"]').click();

    cy.get('[data-cy="save-route-dialog-input-name"]').should('not.exist');
    cy.get('[data-cy="photo-toast"]').should('contain', 'Ruta guardada');
    cy.get('[data-cy="cockpit-master-btn"]').should('have.attr', 'aria-label', 'Iniciar grabación');
  });

  it('should discard the route, show a toast, reset the master button, and not create a new route (AC-018)', () => {
    cy.get('[data-cy="cockpit-master-btn"]').click();
    cy.get('[data-cy="cockpit-master-btn"]').trigger('pointerdown');
    cy.wait(1700);
    cy.get('[data-cy="save-route-dialog-action-discard"]').click();

    cy.get('[data-cy="save-route-dialog-input-name"]').should('not.exist');
    cy.get('[data-cy="photo-toast"]').should('contain', 'Ruta descartada');
    cy.get('[data-cy="cockpit-master-btn"]').should('have.attr', 'aria-label', 'Iniciar grabación');

    cy.get('[data-cy="nav-rutas"]').click();
    cy.get('[data-cy="route-list-empty"]').should('be.visible');
  });
});
