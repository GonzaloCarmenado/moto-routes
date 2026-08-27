/// <reference types="cypress" />

/**
 * E2E de `actualizacion-in-app`: único comportamiento de este cambio
 * verificable de verdad en Cypress (ver design.md, Risk "Cypress no puede
 * ejercer el flujo real de este cambio") — en modo web (build plano, sin
 * Tauri), `isAndroidTauri()` es `false` de verdad, así que ni se muestra
 * `<update-banner>` ni se llama a la API de GitHub Releases. El resto del
 * comportamiento (aviso visible, descarga, instalación) está cubierto por
 * Vitest (mockeando los módulos de Tauri) y por verificación manual en
 * dispositivo Android real.
 */
describe('Actualización in-app — modo web (sin Tauri)', () => {
  it('no muestra el aviso de actualización ni consulta la API de GitHub Releases', () => {
    cy.intercept('GET', 'https://api.github.com/**').as('githubApi');
    cy.intercept('GET', 'https://github.com/**').as('githubDownload');
    cy.intercept('GET', 'https://release-assets.githubusercontent.com/**').as('githubAssets');

    cy.visitWithSeed({});
    cy.get('[data-cy="update-banner"]').should('not.exist');

    cy.get('@githubApi.all').should('have.length', 0);
    cy.get('@githubDownload.all').should('have.length', 0);
    cy.get('@githubAssets.all').should('have.length', 0);
  });
});
