import { fetchJson, ExternalApiError } from './external-api.service.js';

/**
 * Causa de un fallo al llamar a los endpoints de `/api/auth/avatar`. Mismo
 * criterio de mapeo que `PhotoCloudApiErrorKind` — `not-found` para
 * `fetchAccountAvatar` significa "la cuenta no tiene avatar configurado",
 * nunca un error de red.
 */
export type AvatarApiErrorKind = 'unauthorized' | 'too-large' | 'not-found' | 'network' | 'unknown';

/** Error tipado para fallos del endpoint de avatar de cuenta. */
export class AvatarApiError extends Error {
  constructor(
    public readonly kind: AvatarApiErrorKind,
    message: string,
  ) {
    super(message);
    this.name = 'AvatarApiError';
  }
}

interface ApiErrorBody {
  error?: string;
}

function mapStatus(status: number): AvatarApiErrorKind {
  if (status === 401) return 'unauthorized';
  if (status === 404) return 'not-found';
  if (status === 400) return 'too-large';
  return 'unknown';
}

function toAvatarApiError(err: unknown): AvatarApiError {
  if (err instanceof ExternalApiError) {
    if (err.kind === 'http-error' && err.status !== undefined) {
      const message = (err.body as ApiErrorBody | undefined)?.error ?? err.message;
      return new AvatarApiError(mapStatus(err.status), message);
    }
    if (err.kind === 'network' || err.kind === 'timeout') {
      return new AvatarApiError('network', err.message);
    }
  }
  return new AvatarApiError('unknown', err instanceof Error ? err.message : String(err));
}

/**
 * `POST /api/auth/avatar` — sube un avatar nuevo para la cuenta autenticada,
 * sustituyendo cualquier avatar anterior de esa misma cuenta. El servidor
 * cifra los bytes antes de guardarlos; aquí solo se envían en claro sobre la
 * conexión ya autenticada.
 */
export async function uploadAccountAvatar(apiBaseUrl: string, token: string, file: Blob, filename: string): Promise<void> {
  const formData = new FormData();
  formData.append('avatar', file, filename);

  try {
    await fetchJson(`${apiBaseUrl}/api/auth/avatar`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      checkStatus: true,
      body: formData,
    });
  } catch (err) {
    throw toAvatarApiError(err);
  }
}

/**
 * `GET /api/auth/avatar` — descarga el avatar de la cuenta autenticada. No
 * usa `fetchJson`: la respuesta son los bytes de la imagen, no JSON (mismo
 * motivo que `exportRouteGPX` en `route-cloud-api.service.ts`). Un 404
 * (`kind: 'not-found'`) significa que la cuenta no tiene avatar configurado
 * — el llamante lo trata como estado vacío, no como error.
 */
export async function fetchAccountAvatar(apiBaseUrl: string, token: string): Promise<Blob> {
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}/api/auth/avatar`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (err) {
    throw new AvatarApiError('network', `Network error fetching avatar: ${String(err)}`);
  }

  if (!response.ok) {
    let message = `Avatar download failed with status ${String(response.status)}`;
    try {
      const body = (await response.json()) as ApiErrorBody;
      if (body.error) message = body.error;
    } catch {
      // cuerpo de error no-JSON o vacío — se mantiene el mensaje genérico
    }
    throw new AvatarApiError(mapStatus(response.status), message);
  }

  return response.blob();
}

/**
 * `GET /api/users/{username}/avatar` — descarga el avatar de otra cuenta
 * (ver selector-amigos, design.md). Mismo patrón que `fetchAccountAvatar`,
 * salvo que aquí un 404 no es un error del llamante: significa "esa cuenta
 * no tiene avatar", así que se resuelve como `null` en vez de propagarse —
 * el selector lo trata como estado esperado (icono placeholder), no vacío.
 * Sin caché local (a diferencia de `account-avatar-cache.ts`): cada apertura
 * del selector vuelve a pedir los avatares (design.md, Non-Goals).
 */
export async function resolveUserAvatarUrl(apiBaseUrl: string, token: string, username: string): Promise<string | null> {
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}/api/users/${encodeURIComponent(username)}/avatar`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (err) {
    throw new AvatarApiError('network', `Network error fetching avatar for ${username}: ${String(err)}`);
  }

  if (response.status === 404) return null;

  if (!response.ok) {
    let message = `Avatar download failed with status ${String(response.status)}`;
    try {
      const body = (await response.json()) as ApiErrorBody;
      if (body.error) message = body.error;
    } catch {
      // cuerpo de error no-JSON o vacío — se mantiene el mensaje genérico
    }
    throw new AvatarApiError(mapStatus(response.status), message);
  }

  const blob = await response.blob();
  return URL.createObjectURL(blob);
}
