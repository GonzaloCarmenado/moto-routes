# Feature: Mejoras Técnicas (Refactor y Consistencia de Arquitectura)

## Descripción
Ronda de refactor transversal para reducir duplicación, unificar patrones y hacer cumplir las convenciones que ya declara el proyecto (CLAUDE.md / `specs/ui/frontend-conventions.md`) pero que hoy se saltan en varios sitios. **Es una spec de refactor: no cambia el comportamiento observable de la app.** El criterio de éxito global es que toda la suite de tests siga en verde y las quality gates se mantengan (ESLint 0 warnings, cobertura ≥ 80%, Clippy/rustfmt/cargo test limpios) sin haber cambiado lo que el usuario ve o hace.

## Criterios de Aceptación

### Consistencia de componentes
- [ ] AC-001: Todos los custom elements extienden `BaseElement`, no `HTMLElement` directamente. Migran `app-root`, `nav-bar`, `route-detail`, `route-list` y `route-map`, que hoy extienden `HTMLElement` y reimplementan a mano el patrón de emisión de eventos. El comportamiento de cada componente es idéntico antes y después (sus tests actuales siguen pasando sin modificarse, salvo cambios de import).
- [ ] AC-002: Ningún componente construye y despacha eventos de navegación con `window.dispatchEvent(new CustomEvent('...'))` usando strings literales. Los nombres de evento y la forma de su `detail` viven en un único módulo compartido tipado (p. ej. `src/shared/app-events.ts`), y todos los emisores/oyentes los importan de ahí.
- [ ] AC-003: No queda código muerto en `src/shared/utils/`. En concreto, el helper `createElement` de `src/shared/utils/dom.ts` o bien se adopta en la construcción de DOM repetitiva, o bien se elimina. Un `grep` del símbolo confirma que no hay exports sin uso.

### CSS y design tokens
- [ ] AC-004: No hay bloques de estilo estáticos embebidos en TypeScript. Los estilos hoy inline en JS (toast, visor/lightbox de fotos, miniaturas, marcadores del mapa, overlay de GPS) se mueven a los `.element.css` correspondientes (o a una hoja compartida) usando clases. Solo se permite manipular `element.style` para valores genuinamente dinámicos (posición calculada en runtime, progreso del arco de long-press, toggles de `display`), y cada uso restante lleva un comentario que lo justifica.
- [ ] AC-005: No hay literales de color (`#rrggbb`, `rgb(...)`, `rgba(...)`, `oklch(...)`) en el código de componentes ni como fallback en `var(--token, #fallback)`. Todo color proviene de un token de `src/shared/styles/tokens.css`. Los tokens semánticos ya existentes (`--danger`, `--success`, `--warning`) se usan donde corresponde.

### Reducción de duplicación
- [ ] AC-006: El patrón repetido de montaje de Shadow DOM (`crear <style>` + `root.innerHTML = ''` + `appendChild`) está extraído a un único helper reutilizable (p. ej. un método protegido en `BaseElement` que reciba el contenido y la hoja de estilos), y los componentes lo usan en vez de repetirlo.
- [ ] AC-007: La lógica de "capturar → validar → geolocalizar → guardar archivo → persistir metadatos" de una foto está en un único servicio compartido. Hoy está duplicada casi idéntica en `src/cockpit/cockpit-photo.service.ts` (`processPhotoCapture`) y `src/routes/route-detail-photo.service.ts` (`addPhotoToRoute`); ambas se apoyan en el mismo servicio unificado, parametrizando solo lo que difiere (fuente del punto GPS de fallback, feedback).

## Comportamiento Esperado

### Escenario: La refactorización no cambia el comportamiento (invariante global)
- **Dado** el estado actual de la app con toda su suite de tests en verde
- **Cuando** se aplica cualquier paso de esta spec
- **Entonces** la suite de tests sigue en verde sin modificar las aserciones existentes (solo se tocan tests por cambios de import o para cubrir el código movido), y las quality gates (ESLint, cobertura ≥ 80%, Clippy, rustfmt, cargo test) se mantienen

### Escenario: Unificación de clase base sin regresión de eventos
- **Dado** que `route-list` emite hoy `view-route` con `window.dispatchEvent`
- **Cuando** se migra a `BaseElement` y a la constante de evento compartida (AC-001, AC-002)
- **Entonces** `app-root` sigue recibiendo el evento y navegando al detalle de la ruta exactamente igual que antes

### Escenario: Estilos movidos a CSS sin cambio visual
- **Dado** el visor de fotos a pantalla completa que hoy se estiliza con `cssText` inline
- **Cuando** sus estilos estáticos se mueven a `route-detail.element.css` (o a la hoja del componente de galería compartido) con tokens
- **Entonces** el visor se ve igual que antes (mismos colores, tamaños y posición), verificable por los tests de apertura/cierre existentes y por revisión visual

### Escenario: Servicio de foto unificado
- **Dado** que capturar una foto en el cockpit y añadirla desde el detalle de ruta ejecutan hoy código duplicado
- **Cuando** ambos flujos pasan a usar el servicio de foto compartido (AC-007)
- **Entonces** los dos flujos siguen persistiendo la foto con los mismos metadatos (routeId, filePath, lat/lon, capturedAt) y los tests de `cockpit-photo.service` y `route-detail-photo.service` siguen pasando

## Constraints
- **Refactor puro**: ningún cambio de comportamiento observable por el usuario. Si un cambio altera lo que el usuario ve o hace, no pertenece a esta spec (va a `mejoras-usabilidad`).
- No se introducen dependencias nuevas.
- No se relajan las quality gates para "que pase"; si un cambio baja la cobertura, se cubre con tests, no se baja el umbral.
- Cada componente migrado mantiene sus atributos `data-cy` intactos (los tests E2E dependen de ellos).
- Los cambios en `src/shared/` (componentes/utilidades compartidas) se marcan como CRÍTICO en la review por afectar a toda la app (ver `agents/review-agent.md`).

## Dependencias
- Ninguna funcional. Conviene ejecutarla **antes o en paralelo** a `mejoras-usabilidad`, porque esta última introduce un módulo de feedback y un componente de galería compartidos que se benefician de que la clase base, los tokens y el helper de DOM ya estén unificados. Ver [[mejoras-usabilidad]].
- Relacionada con las convenciones de `specs/ui/frontend-conventions.md` (estructura por dominio, separación de archivos, prohibición de CSS inline) — esta spec es en buena parte "hacer cumplir lo que ya está escrito ahí".

## Notas de Implementación
- **AC-001**: `BaseElement` puede ganar un helper de shadow DOM (ver AC-006) para que la migración aporte valor y no sea solo cambiar la palabra `HTMLElement`. Los componentes que ya hacen `attachShadow` en su constructor lo seguirán haciendo; `BaseElement` no debe forzar shadow DOM a quien no lo use.
- **AC-002**: El módulo de eventos puede exportar tanto las constantes (`APP_EVENTS.VIEW_ROUTE`) como los tipos de `detail` (`interface ViewRouteDetail { routeId: string }`), y opcionalmente un helper tipado `dispatchAppEvent(name, detail)` para no repetir el `new CustomEvent`.
- **AC-004 / AC-005**: Revisar `src/shared/utils/toast.ts`, `src/routes/route-detail.element.ts` (visor, miniaturas, contador), `src/shared/route-map/route-map-photos.ts` (marcadores) y `src/cockpit/cockpit.render.ts` (overlay GPS). Nota: `toast.ts` se moverá al módulo de feedback en `mejoras-usabilidad`; coordinar para no tocar dos veces el mismo archivo — puede tener sentido que el movimiento a `feedback/` y el paso de estilos a CSS ocurran juntos.
- **AC-006**: El helper podría tener la forma `protected renderShadow(styles: string, ...nodes: Node[]): void` en `BaseElement`, encapsulando el reset + `<style>` + append que hoy se repite en `cockpit`, `route-detail`, `route-list`, etc.
- **AC-007**: El servicio unificado recibe la imagen ya capturada más una estrategia de fallback de ubicación (último punto de ruta activa vs centroide de ruta guardada) y devuelve el `CreatePhoto` persistido. Preserva la desviación ya documentada de AC-013/AC-007 de [[fotos-ruta]] (uso de centroide) — no la cambia, solo la unifica.
