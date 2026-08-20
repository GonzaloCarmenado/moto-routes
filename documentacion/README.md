# Informe técnico del proyecto — Moto Routes

Informe completo del repositorio **Moto Routes** (Ride Tracker), generado a partir de la revisión
directa del código, configuración y memoria del proyecto. Cubre frontend (`apps/mobile/`), backend
(`apps/api/`) e infraestructura (`infra/docker/`), así como metodología, CI/CD y entornos.

> **Nota de seguridad**: este informe no contiene ningún secreto, contraseña, token, clave privada
> ni connection string real. Se referencian únicamente los **nombres de variables de entorno**, los
> valores triviales de desarrollo local que ya son públicos (ficheros `*.env.example` versionados) y
> datos de arquitectura ya documentados en las ADR (`memory/decisions.md`). Los valores reales viven
> en ficheros no versionados (`infra/docker/.env`, `infra/docker/.env.prod`,
> `scripts/.env.deploy.local`) o en GitHub Secrets.

## Índice de documentos

| # | Documento | Contenido |
|---|-----------|-----------|
| 01 | [Resumen ejecutivo](01-resumen-ejecutivo.md) | Qué es el proyecto, arquitectura de alto nivel, componentes |
| 02 | [Stack tecnológico, lenguajes y versiones](02-stack-tecnologico.md) | Tecnologías, lenguajes, frameworks, librerías, gestores, versiones |
| 03 | [Metodología y calidad](03-metodologia-y-calidad.md) | OpenSpec SDD, TDD, quality gates, hooks, ADRs, testing, linting |
| 04 | [Modelo de datos](04-modelo-de-datos.md) | Diagramas ER de PostgreSQL (backend) y SQLite (app), migraciones |
| 05 | [Backend — API Go](05-backend-api-go.md) | Endpoints, middleware, auth, rate limiting, fotos, email, GPX |
| 06 | [Frontend — App móvil Tauri](06-frontend-mobile-tauri.md) | Web Components, dominios, plugins Tauri, Rust, SQLite, CSP |
| 07 | [Firebase y notificaciones push](07-firebase-notificaciones.md) | Uso de FCM, autenticación, tokens, flujo, privacidad |
| 08 | [Tailscale y red](08-tailscale-y-red.md) | Tailnet, Funnel, SSH, versión de la GitHub Action, tags |
| 09 | [Entornos: local y producción](09-entornos-local-y-produccion.md) | Docker Compose local, servidor de producción, MinIO, OSRM |
| 10 | [CI/CD — GitHub Actions](10-ci-cd-github-actions.md) | Workflows, jobs, secrets, despliegue, release de APK |
| 11 | [Inicialización en local](11-inicializacion-local.md) | Guía paso a paso para levantar el proyecto desde cero |

## Lectura complementaria (ya existente en el repo)

- `README.md` — visión general y scripts.
- `docs/` — documentación de arquitectura SDD (01–07) y `informe-tecnico-seguridad.md`.
- `memory/context.md` y `memory/decisions.md` — estado actual y ADR (fuente primaria de decisiones).
- `openspec/` — specs vivas y cambios (source of truth del SDD).
