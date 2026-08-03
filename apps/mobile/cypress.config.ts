import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:1420',
    supportFile: 'cypress/support/e2e.ts',
    specPattern: 'cypress/e2e/**/*.cy.ts',
    viewportWidth: 390,
    viewportHeight: 844,
    // La app usa Shadow DOM en todos los componentes (BaseElement.attachShadow) —
    // sin esto, cy.get() con selectores data-cy nunca encuentra nada dentro de
    // <cockpit-view>, <route-list>, <cockpit-save-route-dialog>, etc.
    includeShadowDom: true,
  },
});