/// <reference types="cypress" />

describe('Cockpit - Grabación de Rutas', () => {
  beforeEach(() => {
    cy.visit('/');
  });

  it('should show dial with 0 and START button on load', () => {
    cy.get('[data-cy="cockpit-master-btn"]').should('contain', '● START');
    cy.get('.cockpit-dial__value').should('contain', '0');
  });

  it('should show REC status when recording', () => {
    cy.get('[data-cy="cockpit-master-btn"]').click();
    cy.get('[data-cy="cockpit-master-btn"]').should('contain', 'STOP');
  });

  it('should show pause button during recording', () => {
    cy.get('[data-cy="cockpit-master-btn"]').click();
    cy.get('[data-cy="cockpit-pause-btn"]').should('be.visible');
    cy.get('[data-cy="cockpit-pause-btn"]').should('contain', 'Pausa');
  });

  it('should toggle invisible mode', () => {
    cy.get('[data-cy="cockpit-master-btn"]').click();
    cy.get('[data-cy="cockpit-invisible-btn"]').click();
    cy.get('[data-cy="cockpit-invisible-btn"]').should('have.class', 'action-btn--active');
  });
});