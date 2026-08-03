# monorepo-layout Specification

## Purpose

Define la estructura de carpetas del repositorio como monorepo: dónde vive la app móvil (Tauri + frontend), dónde vive el nuevo servicio backend, y dónde vive la infraestructura de Docker compartida.

## Requirements

### Requirement: La app móvil se reubica bajo apps/mobile sin cambio de comportamiento
Todo el código y configuración que hoy vive en la raíz del repositorio y pertenece a la app móvil (Tauri + frontend TypeScript) SHALL trasladarse a `apps/mobile/` conservando exactamente su comportamiento, sin alterar lógica, estilos, dependencias ni resultados de test.

#### Scenario: Los tests existentes siguen pasando tras la reubicación
- **WHEN** se ejecutan las suites de test existentes (Vitest, Cypress vía `pnpm test:e2e`, `cargo test`) desde `apps/mobile`
- **THEN** todas pasan con el mismo resultado que antes de la reubicación (mismo número de tests, sin regresiones)

#### Scenario: El build de la app móvil sigue funcionando igual
- **WHEN** se ejecuta `pnpm build` (Vite) y `pnpm tauri android build --target aarch64 --debug` desde la nueva ubicación
- **THEN** ambos completan sin errores y generan los mismos artefactos (`dist/`, APK) que antes de la reubicación

### Requirement: El pipeline de CI resuelve las nuevas rutas
El workflow `.github/workflows/ci.yml` SHALL ejecutar los jobs `quality-ts` y `quality-tauri` contra `apps/mobile`, sin referenciar ninguna ruta de la estructura anterior a la reorganización.

#### Scenario: CI ejecuta correctamente tras el cambio de rutas
- **WHEN** se abre un pull request o se hace push a `master` tras la reorganización
- **THEN** los jobs `quality-ts` y `quality-tauri` instalan dependencias, compilan y ejecutan los tests apuntando a `apps/mobile`, y terminan en verde igual que antes del cambio

### Requirement: El hook de pre-commit resuelve las nuevas rutas
`.husky/pre-commit` SHALL ejecutar sus comandos (auditoría, ESLint, Vitest, Clippy, rustfmt, cargo test, Cypress) contra las rutas de `apps/mobile`.

#### Scenario: pre-commit se ejecuta correctamente tras la reorganización
- **WHEN** un desarrollador hace commit de un cambio dentro de `apps/mobile`
- **THEN** el hook ejecuta la misma cadena de comandos de calidad que antes de la reorganización, sin errores de "fichero o ruta no encontrada"

### Requirement: El workspace de pnpm solo gestiona apps/mobile
`pnpm-workspace.yaml` SHALL apuntar a `apps/mobile` como único paquete pnpm real del monorepo. El nuevo servicio Java (`apps/api`) SHALL quedar fuera de la gestión de pnpm, al ser un proyecto Maven independiente.

#### Scenario: pnpm install no intenta tratar apps/api como paquete pnpm
- **WHEN** se ejecuta `pnpm install` en la raíz del repositorio tras la reorganización
- **THEN** pnpm resuelve dependencias únicamente para `apps/mobile`, sin buscar ni fallar por la ausencia de un `package.json` en `apps/api`

### Requirement: Las carpetas transversales no se mueven
`openspec/`, `specs/` (histórico congelado), `docs/`, `memory/` y `.github/` SHALL permanecer en la raíz del repositorio, sin trasladarse a `apps/mobile` ni a ninguna otra subcarpeta de aplicación.

#### Scenario: La metodología OpenSpec sigue operando desde la raíz
- **WHEN** se ejecuta cualquier comando `openspec` (`status`, `instructions`, `validate`) tras la reorganización
- **THEN** la CLI sigue encontrando `openspec/` en la raíz del repositorio sin configuración adicional
