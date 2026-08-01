/**
 * Tipos para el componente <photo-capture>.
 */

export type CaptureSource = 'camera' | 'gallery';

export interface PhotoCaptureEventDetail {
  source: CaptureSource;
}

export const PHOTO_CAPTURE_EVENT = 'photo-capture:select';

/** Número máximo de fotos permitidas por ruta — compartido entre `<route-detail>` y
 * `<cockpit-view>` para que el límite no diverja entre ambos consumidores. */
export const MAX_PHOTOS_PER_ROUTE = 100;
