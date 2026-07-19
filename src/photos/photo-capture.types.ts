/**
 * Tipos para el componente <photo-capture>.
 */

export type CaptureSource = 'camera' | 'gallery';

export interface PhotoCaptureEventDetail {
  source: CaptureSource;
}

export const PHOTO_CAPTURE_EVENT = 'photo-capture:select';