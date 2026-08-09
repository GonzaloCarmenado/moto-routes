import { fetchJson, ExternalApiError } from './external-api.service.js';

/**
 * Causa de un fallo al llamar a los endpoints de `/api/routes/{id}/photos`.
 * Mapeado desde el status HTTP de la respuesta, mismo criterio que `RouteCloudApiErrorKind`.
 */
export type PhotoCloudApiErrorKind = 'unauthorized' | 'too-large' | 'too-many-photos' | 'not-found' | 'network' | 'unknown';

/** Error tipado para fallos de los endpoints de fotos de ruta en la nube. */
export class PhotoCloudApiError extends Error {
  constructor(
    public readonly kind: PhotoCloudApiErrorKind,
    message: string,
  ) {
    super(message);
    this.name = 'PhotoCloudApiError';
  }
}

interface ApiErrorBody {
  error?: string;
}

function toPhotoCloudApiError(err: unknown): PhotoCloudApiError {
  if (err instanceof ExternalApiError) {
    if (err.kind === 'http-error' && err.status !== undefined) {
      const message = (err.body as ApiErrorBody | undefined)?.error ?? err.message;
      return new PhotoCloudApiError(mapStatus(err.status, message), message);
    }
    if (err.kind === 'network' || err.kind === 'timeout') {
      return new PhotoCloudApiError('network', err.message);
    }
  }
  return new PhotoCloudApiError('unknown', err instanceof Error ? err.message : String(err));
}

/**
 * El backend usa el mismo status 400 tanto para "foto demasiado grande" como
 * para "la ruta ya alcanzó el límite de fotos" -- se distingue por el mensaje
 * (ver apps/api/internal/photos/photos.go, ErrPhotoTooLarge/ErrTooManyPhotos).
 */
function mapStatus(status: number, message: string): PhotoCloudApiErrorKind {
  if (status === 401) return 'unauthorized';
  if (status === 404) return 'not-found';
  if (status === 400) {
    if (message.includes('maximum number of photos')) return 'too-many-photos';
    if (message.includes('maximum allowed size')) return 'too-large';
  }
  return 'unknown';
}

/** Datos de una foto local a subir al backend. */
export interface UploadRoutePhotoParams {
  file: Blob;
  filename: string;
  latitude: number | null;
  longitude: number | null;
  capturedAt: string;
}

/** Metadatos remotos devueltos por el backend tras subir una foto. */
export interface UploadedRoutePhoto {
  id: string;
}

function buildPhotoFormData(params: UploadRoutePhotoParams): FormData {
  const formData = new FormData();
  formData.append('photo', params.file, params.filename);
  if (params.latitude !== null) formData.append('latitude', String(params.latitude));
  if (params.longitude !== null) formData.append('longitude', String(params.longitude));
  formData.append('captured_at', params.capturedAt);
  return formData;
}

/**
 * `POST /api/routes/{id}/photos` -- sube una foto nueva a una ruta de la
 * cuenta del usuario autenticado. El servidor cifra los bytes antes de
 * guardarlos; aquí solo se envían en claro sobre la conexión ya autenticada.
 */
export async function uploadRoutePhoto(
  apiBaseUrl: string,
  token: string,
  routeId: string,
  params: UploadRoutePhotoParams,
): Promise<UploadedRoutePhoto> {
  try {
    const response = await fetchJson<UploadedRoutePhoto>(`${apiBaseUrl}/api/routes/${routeId}/photos`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      checkStatus: true,
      body: buildPhotoFormData(params),
    });
    return { id: response.id };
  } catch (err) {
    throw toPhotoCloudApiError(err);
  }
}

/**
 * `DELETE /api/routes/{id}/photos/{photoId}` -- borra la copia remota de una
 * foto de una ruta de la cuenta del usuario autenticado.
 */
export async function deleteRoutePhoto(apiBaseUrl: string, token: string, routeId: string, remotePhotoId: string): Promise<void> {
  try {
    await fetchJson(`${apiBaseUrl}/api/routes/${routeId}/photos/${remotePhotoId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
      checkStatus: true,
    });
  } catch (err) {
    throw toPhotoCloudApiError(err);
  }
}
