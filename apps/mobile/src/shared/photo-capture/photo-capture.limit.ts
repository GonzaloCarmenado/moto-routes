/**
 * @packageDocumentation
 * Aplicación del límite de 100 fotos por ruta al componente `<photo-capture>`.
 */
import type { PhotoCaptureElement } from './photo-capture.element.js';
import { MAX_PHOTOS_PER_ROUTE } from './photo-capture.types.js';

/** Aplica el límite de 100 fotos a una instancia de `<photo-capture>` según el
 * número actual de fotos de la ruta (decide `disabled` y `limitReached` a la vez). */
export function applyPhotoCaptureLimit(el: PhotoCaptureElement | null, photoCount: number): void {
  if (!el) return;

  const limitReached = photoCount >= MAX_PHOTOS_PER_ROUTE;
  el.disabled = limitReached;
  el.limitReached = limitReached;
}
