/// <reference types="cypress" />

describe('Cockpit - Grabación de Rutas', () => {
  beforeEach(() => {
    cy.visit('/');
  });

  it('should show speed at 0 and the master button ready to start on load', () => {
    cy.get('[data-cy="cockpit-master-btn"]').should('have.attr', 'aria-label', 'Iniciar grabación');
    cy.get('.speed-display .speed-value').should('contain', '0');
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

  it('should toggle invisible mode', () => {
    cy.get('[data-cy="cockpit-master-btn"]').click();
    cy.get('[data-cy="cockpit-invisible-btn"]').click();
    cy.get('[data-cy="cockpit-invisible-btn"]').should('have.class', 'invisible-toggle--active');
  });
});
