---
# https://vitepress.dev/reference/default-theme-home-page
layout: home

hero:
  name: "Moto Routes"
  text: "Ride Tracker Mobile App"
  tagline: Grabación de rutas GPS, navegación y bitácora multimedia para motociclistas.
  actions:
    - theme: brand
      text: Guías
      link: /01-arquitectura-sdd
    - theme: alt
      text: API Reference
      link: /api/index.html

features:
  - title: Spec-Driven Development
    details: Flujo Propose → Apply → Archive sobre OpenSpec, con delta specs. Cline y Claude comparten la misma configuración en openspec/config.yaml.
  - title: TypeScript + Tauri 2
    details: Frontend TypeScript 5.7 strict con Web Components nativos, backend Rust, target Android prioritario.
  - title: 30 tests E2E en verde
    details: Cobertura E2E con Cypress sobre grabación, listado, detalle, fotos y timeline. Todos los elementos usan data-cy.
---