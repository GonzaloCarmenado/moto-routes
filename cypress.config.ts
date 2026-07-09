import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:1420',
    supportFile: false,
    specPattern: 'cypress/e2e/**/*.cy.ts',
    viewportWidth: 390,
    viewportHeight: 844,
  },
});