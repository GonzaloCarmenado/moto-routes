/**
 * Botón "Volver" compartido — mismo botón (`&larr; Volver`) reimplementado
 * casi idéntico en `route-detail.element.ts`, `route-sharing.element.ts` y
 * `achievement-list.element.ts` (hallazgo real de `auditoria-tecnica-2026-08`).
 * Cada llamador decide su propio `data-cy` y qué evento de navegación
 * disparar — este helper no conoce `app-events.ts`, solo construye el DOM.
 */

/** Construye el botón "Volver", con el `data-cy` y el callback de click dados por el llamador. */
export function buildBackButton(dataCy: string, onClick: () => void): HTMLButtonElement {
  const backBtn = document.createElement('button');
  backBtn.type = 'button';
  backBtn.className = 'back-btn';
  backBtn.setAttribute('data-cy', dataCy);
  backBtn.innerHTML = '<span class="back-btn__arrow">&larr;</span> Volver';
  backBtn.addEventListener('click', onClick);
  return backBtn;
}
