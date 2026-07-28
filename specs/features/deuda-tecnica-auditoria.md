> Nota metodológica: origen no funcional. No proviene de un requisito de producto sino de una auditoría técnica de arquitectura/CSS/seguridad/mantenibilidad realizada sobre el repo el 2026-07-28. Los 8 hallazgos (severidad Alta y Media) están acotados y cerrados de antemano — esta spec no se amplía con hallazgos adicionales sin que el usuario lo pida explícitamente.

# Feature: Deuda Técnica — Auditoría 2026-07-28

## Descripción
Corrección de 8 hallazgos de deuda técnica detectados en una auditoría de arquitectura/CSS/seguridad/mantenibilidad: incumplimientos de `specs/ui/frontend-conventions.md` (imports cruzados entre dominios, componente compartido mal ubicado, `.element.css` sin `tokens.css`), un residuo visual de ADR-019 no resuelto, ausencia total de tests unitarios en el backend Rust y huecos de cobertura sin cubrir ni excluir explícitamente. **Es una spec de refactor/saneamiento: no introduce funcionalidad nueva ni cambia el comportamiento observable de la app**, salvo el hallazgo 3, cuya resolución final (mantener o eliminar el resplandor ámbar) requiere una decisión de diseño explícita del usuario antes de implementar.

## Criterios de Aceptación

### Imports cruzados y ubicación de código compartido
- [x] AC-001: Las funciones puras `formatDuration`, `calculateDistance` (Haversine) y `calculateAvgSpeed`, hoy definidas en `src/cockpit/cockpit.transform.ts` e importadas directamente por `src/routes/route-detail.element.ts`, `src/routes/route-list.element.ts` y `src/routes/route-timeline.transform.ts`, deben vivir en `src/shared/` (p. ej. `shared/utils/geo.ts` para distancia, `shared/utils/format.ts` para duración/velocidad). Ningún archivo de `src/routes/` debe importar de `src/cockpit/cockpit.transform.ts`, ni ningún archivo de `src/cockpit/` debe importar transforms de `src/routes/` — ambos dominios importan exclusivamente de `src/shared/`. `detectStop` permanece en `cockpit.transform.ts` (depende de `CockpitState`/`StopDetectionState`, específicos del dominio cockpit); si `route-timeline.transform.ts` sigue necesitando reutilizar su lógica, se documenta explícitamente como la única excepción admitida y no como precedente para nuevos imports cruzados.
- [x] AC-002: `src/photos/photo-capture.element.ts`, `.element.css` y `.types.ts` se mueven a `src/shared/photo-capture/` (mismo patrón ya usado por `photo-gallery`/`photo-viewer`, correctamente ubicados en `shared/`), porque el componente es usado por 2 dominios hermanos (`cockpit.element.ts` y `route-detail.element.ts`), lo que según `frontend-conventions.md` sección 4 obliga a `shared/`. Todos los imports de `photo-capture` en `cockpit` y `routes` se actualizan a la nueva ruta. No debe quedar ningún archivo `photo-capture.*` en `src/photos/`.
- [x] AC-003: La lógica de "nombre por defecto de ruta" y de "formateo de fecha para mostrar" existe en una única función compartida cada una (ubicadas en `src/shared/`), usadas de forma consistente por `src/routes/route-list.element.ts`, `src/routes/route-detail.element.ts` y `src/cockpit/cockpit.transform.ts` (`buildDefaultRouteName`), sustituyendo las implementaciones duplicadas/divergentes actuales. El formato de fecha mostrado (opciones de `toLocaleDateString('es-ES', ...)`) es idéntico en los 3 puntos de uso — hoy `route-list` usa `month: 'short'` y `route-detail` usa `month: 'long'`, una inconsistencia visual que esta unificación elimina.

### CSS y tokens
- [x] AC-004: `src/photos/photo-capture.element.css` (o su ruta resultante tras AC-002, `src/shared/photo-capture/photo-capture.element.css`) importa `tokens.css` igual que el resto de `.element.css` del proyecto. No contiene fallbacks de color hardcodeados en `var(--token, #hex)` — usa `var(--token)` a secas, apoyándose en que `tokens.css` ya define el valor real.
- [x] AC-005: `@keyframes photo-capture-spin` respeta `prefers-reduced-motion: reduce` (definido globalmente en `tokens.css`) igual que el resto de animaciones del proyecto: con el media query activo, el spinner de carga no gira (o su animación queda deshabilitada/estática), verificable mediante test o verificación manual documentada.
- [x] AC-006: `src/components/counter/counter.element.css` y `src/shared/feedback/confirm-dialog.element.css` importan `tokens.css`, aunque hoy no consuman ningún token de forma activa — regla de consistencia preventiva ya obligatoria para el resto de `.element.css` del proyecto.
- [x] AC-007: Los 6 `box-shadow`/`text-shadow` con valores `oklch(...)` literales hoy hardcodeados en `src/cockpit/cockpit.element.css` (~líneas 61, 96, 123, 219, 237) y `src/components/nav-bar/nav-bar.element.css` (~línea 72) dejan de ser literales. **Decisión tomada por el usuario (2026-07-28): se mantiene el efecto visual.** Se crea un token dedicado `--amber-glow` en `tokens.css`, derivado del mismo valor OKLCH base que ya usa `--amber` (no una segunda fuente de verdad de color), y los 6 sitios lo consumen vía `var(--amber-glow)` en vez del literal. Tras el cambio no queda ningún literal `oklch(...)` (ni ningún otro formato de color hardcodeado) en `cockpit.element.css` ni en `nav-bar.element.css`, y la decisión se registra como ADR nuevo en `memory/decisions.md` referenciando ADR-019 (aclarando que el resplandor ámbar puntual en elementos de estado activo no contradice la prohibición general de "neón/glow" de esa decisión, al quedar acotado a un único token con significado semántico claro, no a un lenguaje visual difuso).

### Tests unitarios en backend Rust
- [x] AC-008: `src-tauri/` cuenta con tests unitarios `#[cfg(test)]` reales para la lógica de validación de `src-tauri/src/commands/mod.rs`, cubriendo como mínimo: `save_file` con una ruta relativa válida y contenido no vacío (éxito), `save_file` con una ruta absoluta (rechazado — `save_file` exige rutas relativas, ver código real líneas 67-70), `save_file` con un componente `..` en la ruta (rechazado, path traversal), `save_file` con contenido vacío (rechazado), y `greet` con un string vacío. `cargo test` dentro de `src-tauri/` pasa de "0 passed; 0 failed" a un número de tests mayor que 0, todos en verde.
- [x] AC-009: Para `src-tauri/src/recording_service.rs`, toda función pura no dependiente de Android real (`#[cfg(target_os = "android")]`) que exista hoy o se identifique al implementar recibe tests unitarios equivalentes a los de AC-008. Si, tras revisar el archivo, toda su lógica resulta estar condicionada a `target_os = "android"` sin ninguna función pura testeable fuera de ese target, esto se documenta explícitamente como limitación conocida (comentario en el propio archivo y nota en la spec/PR correspondiente) en vez de omitirse en silencio o fingir cobertura donde no puede haberla.

### Cobertura de wrappers Tauri
- [x] AC-010: Para `src/shared/repositories/sqlite-photo.factory.ts` (hoy 0% stmts/lines), `src/shared/repositories/sqlite-route.factory.ts` (hoy 73.33% stmts / 50% branch / 33.33% funcs) y `src/shared/services/photo-storage.service.ts` (hoy 74.11% stmts / 86.2% branch). **Decisión tomada por el usuario (2026-07-28): se añaden tests, no se excluyen.** Se mockean `@tauri-apps/plugin-sql`/`@tauri-apps/plugin-fs` (reutilizando el patrón de mock ya existente en `sqlite-route.repository.spec.ts` si aplica, sin introducir dependencias nuevas) para cubrir las ramas hoy no probadas — la rama de creación real de repositorio/conexión Tauri y el builder de metadata de foto — llevando los 3 archivos a cumplir el umbral global de 80% (líneas/ramas/funciones/statements) sin ninguna exclusión en `vitest.config.ts`.

## Comportamiento Esperado

### Escenario: Refactor sin cambio de comportamiento observable (invariante global para AC-001, AC-002, AC-003, AC-006, AC-008, AC-009, AC-010)
- **Dado** el estado actual de la app con toda su suite de tests en verde
- **Cuando** se aplica cualquiera de los pasos de saneamiento estructural de esta spec (mover archivos, extraer funciones a `shared/`, añadir tests, importar `tokens.css` sin tokens activos)
- **Entonces** la suite de tests sigue en verde (solo se tocan tests existentes por cambios de import, nunca se relaja una aserción), y las quality gates (ESLint, cobertura, Clippy, rustfmt, cargo test) se mantienen o mejoran, sin que el usuario perciba ningún cambio visual o funcional

### Escenario: El nombre de ruta por defecto y su fecha se muestran igual en listado y detalle
- **Dado** una ruta guardada sin nombre personalizado
- **Cuando** se visualiza su nombre por defecto y fecha tanto en `route-list` como en `route-detail`
- **Entonces** el texto mostrado (incluyendo el formato del mes: abreviado o largo, pero el mismo en ambos sitios) es idéntico en los dos componentes

### Escenario: El spinner de captura de foto respeta accesibilidad de movimiento reducido
- **Dado** un usuario con `prefers-reduced-motion: reduce` activado en su sistema
- **Cuando** se muestra el estado de carga del botón de captura de foto (`<photo-capture>` con clase `.is-loading`)
- **Entonces** el spinner no realiza la animación de rotación continua (queda estático o con una transición mínima no molesta), igual que el resto de animaciones del proyecto bajo esa misma preferencia

### Escenario: El resplandor ámbar es consistente con el sistema de tokens tras la decisión de diseño
- **Dado** que se ha tomado la decisión de diseño de AC-007 (mantener el resplandor vía token o eliminarlo) y confirmado visualmente por el usuario
- **Cuando** se inspecciona el CSS de `cockpit.element.css` y `nav-bar.element.css`
- **Entonces** no aparece ningún valor de color/sombra literal hardcodeado, solo `var(--token)`, y el resultado visual coincide con lo confirmado por el usuario (con resplandor si se optó por el token, sin él si se optó por eliminarlo)

### Escenario: `save_file` rechaza intentos de path traversal (AC-008)
- **Dado** el comando Rust `save_file`
- **Cuando** se invoca con una ruta que contiene un componente `..`
- **Entonces** el comando rechaza la operación devolviendo un error, y un test unitario `#[test]` lo demuestra de forma determinista sin depender de un entorno Tauri real

### Escenario: `cargo test` deja de reportar cero tests (AC-008/AC-009)
- **Dado** el estado actual de `src-tauri/` con `cargo test` reportando "0 passed; 0 failed"
- **Cuando** se ejecuta `cargo test` tras esta spec
- **Entonces** el resultado reporta un número de tests mayor que 0, todos en verde, y el pre-commit hook (que ya invoca `cargo test`, ver ADR-021) deja de dar una falsa sensación de seguridad sobre la lógica de validación de `commands/mod.rs`

## Constraints
- **Refactor/saneamiento, no producto nuevo**: salvo la decisión de diseño explícita de AC-007, ningún cambio de esta spec debe alterar lo que el usuario final ve o hace en la app.
- No se introducen dependencias nuevas para resolver estos hallazgos (mocking de Tauri en AC-010 usa las utilidades/mocks ya existentes en el proyecto, no un paquete nuevo).
- No se relajan las quality gates para "que pase"; si un cambio baja la cobertura, se cubre con tests o se excluye explícita y justificadamente (AC-010), nunca se baja el umbral del 80%.
- AC-007 y AC-010 ya tienen decisión explícita del usuario (2026-07-28, ver texto de cada AC) — no reabrir la discusión de diseño/estrategia de cobertura durante la implementación.
- Los cambios en `src/shared/` se marcan como CRÍTICO en la review por afectar a toda la app (ver `agents/review-agent.md`), especialmente AC-001, AC-002 y AC-003.
- Cada componente/archivo movido mantiene sus atributos `data-cy` intactos (los tests E2E dependen de ellos).

## Dependencias
- `specs/ui/frontend-conventions.md` (secciones 1, 4 y 7) — esta spec corrige incumplimientos ya documentados ahí.
- ADR-019 (`memory/decisions.md`) — AC-007 debe resolverse sin contradecir tácitamente esa decisión; su resolución genera un ADR nuevo que la referencia.
- ADR-021 (`memory/decisions.md`) — AC-010 sigue el mismo criterio de exclusión de cobertura ya usado ahí para contratos puros, si se opta por la vía (b).
- Relacionada con `specs/features/mejoras-tecnicas.md` (ADR-022) — naturaleza similar (refactor técnico sin cambio de comportamiento), aunque esta spec es independiente y no depende de que aquella se reabra.

## Notas de Implementación
- **AC-001**: revisar si `route-timeline.transform.ts` necesita también el tipo `StopDetectionState`/`CockpitState` para su llamada a `detectStop`, o si puede consumir una versión desacoplada; si la única forma limpia es mantener el import puntual de `detectStop` desde `cockpit.transform.ts`, documentarlo como excepción explícita en el propio código (comentario) y en el plan, no dejarlo como una desviación silenciosa de la regla general.
- **AC-002**: el orden recomendado es primero mover `photo-capture.*` a `shared/photo-capture/` y actualizar imports, después aplicar AC-004/AC-005 sobre la ruta ya movida, para no tocar el mismo archivo dos veces en ubicaciones distintas.
- **AC-003**: valorar si la función de nombre por defecto debe vivir junto a la de formateo de fecha en el mismo módulo (`shared/utils/route-naming.ts` o similar) o en módulos separados (`shared/utils/format.ts`) — decisión de organización interna a tomar en el plan, no bloqueante para la spec.
- **AC-007**: al plantear la opción (a), el token debería derivarse del mismo valor OKLCH que ya usa `--amber` para no introducir una segunda fuente de verdad de color; enseñar una captura o build de verificación al usuario antes de dar por buena la decisión final.
- **AC-009**: si `recording_service.rs` resulta no tener ninguna función testeable fuera de Android, considerar si merece la pena extraer manualmente alguna sub-lógica pura (p. ej. parseo/validación de un payload de ubicación) a una función separada testeable — pero solo si aporta valor real, no split artificial solo para "tener un test".
- **AC-010**: revisar primero si el proyecto ya tiene algún mock de `@tauri-apps/plugin-sql` reutilizable (p. ej. en tests de `sqlite-route.repository.spec.ts`) antes de escribir uno nuevo para los factories.
