/**
 * Botón de pantalla completa para <route-map> (AC-016 a AC-021). Módulo de
 * responsabilidad única (mismo patrón que `route-map-photos.ts` /
 * `route-map-contrast.ts`): detecta soporte de la Fullscreen API sobre el
 * contenedor dado, construye el botón integrado y sincroniza su estado
 * (`aria-label`, icono, `map.resize()`) con el evento `fullscreenchange` del
 * documento — el navegador dispara ese mismo evento tanto al pulsar el
 * propio botón como al salir vía Esc (AC-019), así que toda la lógica de
 * sincronización de estado vive en un único listener.
 */

import type * as maplibregl from 'maplibre-gl';

export const FULLSCREEN_ENTER_LABEL = 'Ver mapa a pantalla completa';
export const FULLSCREEN_EXIT_LABEL = 'Salir de pantalla completa';

const FULLSCREEN_ACTIVE_CLASS = 'route-map-fullscreen-toggle--fullscreen';

// Iconos "expandir" (entrar) / "contraer" (salir). `fill="currentColor"` deja
// que el color lo decida el CSS del botón, nunca un valor fijo en el propio
// SVG (mismo patrón que los marcadores de inicio/fin, AC-011). Ambos iconos
// viven siempre en el DOM, superpuestos vía CSS (`opacity`/`transition`) — así
// la transición de uno a otro la controla el CSS (y por tanto respeta el
// override global de `prefers-reduced-motion`, AC-021) en vez de un swap de
// `innerHTML` sin transición posible.
const ENTER_ICON_SVG =
  '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
  '<path fill="currentColor" d="M4 4h6V2H2v8h2V4zm0 16v-6H2v8h8v-2H4zm16-6h-2v6h-6v2h8v-8zm-2-4h2V2h-8v2h6v6z"/>' +
  '</svg>';
const EXIT_ICON_SVG =
  '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
  '<path fill="currentColor" d="M6 10H2V8h6V2h2v6a2 2 0 0 1-2 2zm10 0h6V8h-6V2h-2v6a2 2 0 0 0 2 2zM6 14H2v2h6v6h2v-6a2 2 0 0 0-2-2zm10 0a2 2 0 0 0-2 2v6h2v-6h6v-2h-6z"/>' +
  '</svg>';

export interface FullscreenToggle {
  readonly element: HTMLButtonElement;
  readonly destroy: () => void;
}

/**
 * AC-020: la Fullscreen API tiene soporte variable entre navegadores/WebViews
 * (prefijos vendor en Safari/iOS, soporte incierto en algunos WebViews
 * Android embebidos en Tauri) — solo se considera soportada si el documento
 * la habilita globalmente Y el contenedor concreto expone `requestFullscreen`.
 */
export function isFullscreenSupported(container: HTMLElement): boolean {
  return document.fullscreenEnabled && typeof container.requestFullscreen === 'function';
}

/** Compara `document.fullscreenElement` contra el contenedor dado. */
export function isElementFullscreen(container: HTMLElement): boolean {
  return document.fullscreenElement === container;
}

/**
 * Construye el botón de pantalla completa y lo sincroniza con el ciclo de
 * vida real de la Fullscreen API. Devuelve `null` si no hay soporte (AC-020)
 * — el llamador simplemente no añade nada al DOM en ese caso, sin lanzar
 * ningún error.
 */
export function createFullscreenToggle(
  container: HTMLElement,
  map: maplibregl.Map,
): FullscreenToggle | null {
  if (!isFullscreenSupported(container)) return null;

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'route-map-fullscreen-toggle';
  button.setAttribute('data-cy', 'route-map-fullscreen-toggle');
  button.setAttribute('aria-label', FULLSCREEN_ENTER_LABEL);
  button.innerHTML =
    `<span class="route-map-fullscreen-icon route-map-fullscreen-icon--enter">${ENTER_ICON_SVG}</span>` +
    `<span class="route-map-fullscreen-icon route-map-fullscreen-icon--exit">${EXIT_ICON_SVG}</span>`;

  const syncState = (): void => {
    const active = isElementFullscreen(container);
    button.classList.toggle(FULLSCREEN_ACTIVE_CLASS, active);
    button.setAttribute('aria-label', active ? FULLSCREEN_EXIT_LABEL : FULLSCREEN_ENTER_LABEL);
    // AC-018/AC-019: `map.resize()` de MapLibre ya preserva centro/zoom
    // internamente (solo remide el canvas) — no hace falta capturar/
    // reaplicar `getCenter()`/`getZoom()` manualmente. Se agenda al
    // siguiente frame porque el contenedor cambia de tamaño de forma
    // asíncrona respecto al propio evento `fullscreenchange`.
    requestAnimationFrame(() => {
      map.resize();
    });
  };

  const handleClick = (): void => {
    if (isElementFullscreen(container)) {
      void document.exitFullscreen();
    } else {
      void container.requestFullscreen();
    }
  };

  button.addEventListener('click', handleClick);
  // El listener vive en `document` (el propio contenedor no dispara este
  // evento), no en `container` — por eso hay que limpiarlo explícitamente en
  // `destroy()` (llamado desde `destroyMap()`/`disconnectedCallback` de
  // `route-map.element.ts`), evitando acumular listeners huérfanos entre
  // montajes/desmontajes de `<route-map>`.
  document.addEventListener('fullscreenchange', syncState);

  return {
    element: button,
    destroy: (): void => {
      document.removeEventListener('fullscreenchange', syncState);
    },
  };
}
