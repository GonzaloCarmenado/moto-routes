## MODIFIED Requirements

### Requirement: El workspace de pnpm gestiona apps/mobile y apps/web
`pnpm-workspace.yaml` SHALL apuntar a `apps/mobile` y `apps/web` como los paquetes pnpm reales del monorepo. El servicio Go (`apps/api`) SHALL seguir fuera de la gestión de pnpm, al ser un proyecto independiente sin `package.json`.

#### Scenario: pnpm install resuelve ambos paquetes TypeScript
- **WHEN** se ejecuta `pnpm install` en la raíz del repositorio
- **THEN** pnpm resuelve dependencias para `apps/mobile` y `apps/web`, sin buscar ni fallar por la ausencia de un `package.json` en `apps/api`

#### Scenario: Los comandos de cada app siguen siendo independientes
- **WHEN** se ejecuta un script de `apps/mobile` (p. ej. `pnpm --filter mobile build`)
- **THEN** no instala, compila ni ejecuta nada de `apps/web`, y viceversa
