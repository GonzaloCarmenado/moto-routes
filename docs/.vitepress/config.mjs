import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'Moto Routes',
  description: 'Ride Tracker Mobile App — documentación del proyecto',
  base: '/',
  lang: 'es-ES',
  lastUpdated: true,
  themeConfig: {
    nav: [
      { text: 'Guías', link: '/01-arquitectura-sdd' },
      { text: 'Referencia', link: '/reference/adr' },
      { text: 'API', link: '/api/index.html' },
      { text: 'GitHub', link: 'https://github.com/GonzaloCarmenado/moto-routes' },
    ],
    sidebar: [
      {
        text: 'Guías',
        items: [
          { text: 'Arquitectura SDD', link: '/01-arquitectura-sdd' },
          { text: 'Workflow SDD', link: '/02-workflow-sdd' },
          { text: 'Agentes y Skills', link: '/03-agentes-skills' },
          { text: 'Gestión de Tokens', link: '/04-token-management' },
          { text: 'Sistema de Memoria', link: '/05-memory-system' },
          { text: 'Seguridad', link: '/06-seguridad' },
          { text: 'Tests E2E (Cypress)', link: '/07-cypress-e2e' },
        ],
      },
      {
        text: 'Referencia',
        items: [
          { text: 'Decisiones de Arquitectura (ADRs)', link: '/reference/adr' },
          { text: 'Design System', link: '/reference/design-system' },
        ],
      },
    ],
    footer: {
      message: 'Moto Routes — Asfalto Nocturno',
      copyright: '© 2026',
    },
  },
});