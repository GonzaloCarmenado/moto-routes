import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:4200',
    supportFile: 'cypress/support/e2e.ts',
    specPattern: 'cypress/e2e/**/*.cy.ts',
    viewportWidth: 1280,
    viewportHeight: 800,
    // La app usa Shadow DOM en todos los componentes (BaseElement.attachShadow) —
    // sin esto, cy.get() con selectores data-cy nunca encuentra nada dentro de
    // <login-view>, <events-list>, etc.
    includeShadowDom: true,
  },
});
