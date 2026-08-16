# Revisión independiente — auditoria-tecnica-2026-08

## Mapeo Requirement → Scenario → Test (delta sobre `logros`)

### `logros` — Requirement: Animación de logro desbloqueado (MODIFIED)
- Un único logro desbloqueado → sin cambios, sigue cubierto por `achievement-unlock-overlay.spec.ts::"muestra la animación inmediatamente..."`
- Varios logros a la vez → sin cambios, sigue cubierto
- Accesibilidad de movimiento reducido → sin cambios, sigue cubierto (CSS spec)
- **Cierre por teclado (Escape)** (nuevo) → `achievement-unlock-overlay.spec.ts::"pulsar Escape cierra la animación visible y pasa a la siguiente de la cola"`
- **Foco atrapado dentro del overlay** (nuevo) → `achievement-unlock-overlay.spec.ts::"el foco queda atrapado dentro del overlay..."`

Los 3 escenarios preexistentes se re-verificaron en verde sin ninguna modificación de sus aserciones — el cambio es puramente aditivo.

## Verificación de las 2 extracciones (sin requirement propio — refactor puro, no observable)

- `buildBackButton()`: los 3 componentes que la usan (`route-detail`, `route-sharing`, `achievement-list`) mantienen sus 188 tests existentes en verde sin cambios, más 2 tests nuevos del helper. Un `data-cy` nuevo (`route-detail-btn-volver`) se añadió donde faltaba — verificado por grep que ningún test de Cypress dependía de su ausencia antes de añadirlo.
- Trío Go `apihttp`: los 194 tests de los 4 paquetes que lo consumen (`achievements`, `routes`, `routesharing`, `photos`) siguen en verde sin cambios, más 4 tests nuevos del paquete `apihttp`.

## Verificación end-to-end re-ejecutada desde cero

- `go build ./...` y `go test ./...`: 194/194 (15 paquetes)
- `gofmt`/`go vet`/`govulncheck`: limpios (ficheros nuevos sin ruido; resto del repo con el CRLF preexistente ya documentado)
- `tsc --noEmit`, `eslint src/ --max-warnings 0`: limpios
- `vitest run --coverage`: 1153/1153, 96.87% líneas — sin regresión de cobertura
- Cypress completo (backend Docker reconstruido con el código Go nuevo antes de correr, para no probar un binario desactualizado): 69/69
- `pnpm audit --audit-level=high`: sin vulnerabilidades. `cargo audit`/`govulncheck`: mismas 2 excepciones ya documentadas (`RUSTSEC-2026-0235`, `RUSTSEC-2023-0071`), sin hallazgos nuevos

## Alineación con decisiones previas

Ninguna decisión de este cambio contradice una ADR existente. `internal/auth` se dejó explícitamente fuera de la extracción del trío Go (design.md Decisión 2) — su `writeError` propio sigue igual, decisión razonada, no un descuido. Sin ADR nueva: ninguna decisión aquí alcanza el umbral arquitectónico.

## Veredicto

**APPROVED.** La auditoría no encontró hallazgos bloqueantes reales (seguridad/vulnerabilidades/rendimiento limpios, confirmado por 3 agentes independientes + re-ejecución de las 3 herramientas de auditoría de dependencias). Los 3 hallazgos de mantenimiento que sí se encontraron se corrigieron con cobertura de test completa, sin regresiones en ninguna de las 4 suites (Go, Vitest, Cypress, dependencias), y un hallazgo real no anticipado (el `data-cy` que faltaba en `route-detail`) se corrigió de paso.
