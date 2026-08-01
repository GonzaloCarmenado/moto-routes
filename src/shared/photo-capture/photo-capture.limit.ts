import type { PhotoCaptureElement } from './photo-capture.element.js';
import { MAX_PHOTOS_PER_ROUTE } from './photo-capture.types.js';

/**
 * Único punto que decide `disabled`/`limitReached` a la vez para una instancia de
 * `<photo-capture>` en función del número de fotos ya guardadas para la ruta —
 * evita que un llamador ponga `disabled` sin `limitReached` (o viceversa) y deje el
 * texto accesible inconsistente con el estado real del botón.
 */
export function applyPhotoCaptureLimit(el: PhotoCaptureElement | null, photoCount: number): void {
  if (!el) return;

  const limitReached = photoCount >= MAX_PHOTOS_PER_ROUTE;
  el.disabled = limitReached;
  el.limitReached = limitReached;
}
