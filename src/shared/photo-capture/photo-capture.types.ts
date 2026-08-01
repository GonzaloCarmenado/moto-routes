/**
 * Tipos para el componente <photo-capture>.
 */

/** Origen de la captura: cámara o galería. */
export type CaptureSource = 'camera' | 'gallery';

/** Payload del evento `PHOTO_CAPTURE_EVENT`. */
export interface PhotoCaptureEventDetail {
  source: CaptureSource;
}

/** Nombre del evento despachado por `<photo-capture>` al elegir Cámara/Galería. */
export const PHOTO_CAPTURE_EVENT = 'photo-capture:select';

/** Número máximo de fotos permitidas por ruta — compartido entre `<route-detail>` y
 * `<cockpit-view>` para que el límite no diverja entre ambos consumidores. */
export const MAX_PHOTOS_PER_ROUTE = 100;
