import { fetchJson, ExternalApiError } from '../shared/http/external-api.service.js';

/**
 * Causa de un fallo al llamar a los endpoints de autenticación de `apps/api`.
 * Mapeado desde el status HTTP (y, para 400, del mensaje) de la respuesta —
 * ver cada función para el mapeo exacto.
 */
export type AuthApiErrorKind =
  | 'email-taken'
  | 'weak-password'
  | 'invalid-email'
  | 'invalid-credentials'
  | 'email-not-verified'
  | 'username-taken'
  | 'invalid-username'
  | 'rate-limited'
  | 'unauthorized'
  | 'network'
  | 'unknown';

/** Error tipado para fallos de los endpoints de autenticación. */
export class AuthApiError extends Error {
  constructor(
    public readonly kind: AuthApiErrorKind,
    message: string,
  ) {
    super(message);
    this.name = 'AuthApiError';
  }
}

interface ApiErrorBody {
  error?: string;
}

/**
 * Convierte un `ExternalApiError` (de `fetchJson` con `checkStatus: true`) en
 * un `AuthApiError` con el `kind` correspondiente al endpoint que lo generó.
 * `mapStatus` decide el `kind` a partir del status/mensaje; cualquier otro
 * fallo (red, timeout, JSON inválido) se mapea a `'network'`/`'unknown'`.
 */
function toAuthApiError(err: unknown, mapStatus: (status: number, message: string) => AuthApiErrorKind): AuthApiError {
  if (err instanceof ExternalApiError) {
    if (err.kind === 'http-error' && err.status !== undefined) {
      const message = (err.body as ApiErrorBody | undefined)?.error ?? err.message;
      return new AuthApiError(mapStatus(err.status, message), message);
    }
    if (err.kind === 'network' || err.kind === 'timeout') {
      return new AuthApiError('network', err.message);
    }
  }
  return new AuthApiError('unknown', err instanceof Error ? err.message : String(err));
}

function mapRegisterStatus(status: number, message: string): AuthApiErrorKind {
  if (status === 409) return message.includes('username') ? 'username-taken' : 'email-taken';
  if (status === 429) return 'rate-limited';
  if (status === 400) {
    if (message.includes('password')) return 'weak-password';
    if (message.includes('username')) return 'invalid-username';
    return 'invalid-email';
  }
  return 'unknown';
}

function mapUsernameStatus(status: number): AuthApiErrorKind {
  if (status === 401) return 'unauthorized';
  if (status === 409) return 'username-taken';
  if (status === 429) return 'rate-limited';
  if (status === 400) return 'invalid-username';
  return 'unknown';
}

function mapLoginStatus(status: number): AuthApiErrorKind {
  if (status === 401) return 'invalid-credentials';
  if (status === 403) return 'email-not-verified';
  if (status === 429) return 'rate-limited';
  return 'unknown';
}

function mapMeStatus(status: number): AuthApiErrorKind {
  if (status === 401) return 'unauthorized';
  return 'unknown';
}

export interface RegisterResult {
  id: number;
  email: string;
  username: string;
}

/** `POST /api/auth/register` — ver `mapRegisterStatus` para el mapeo de errores. */
export async function registerAccount(
  apiBaseUrl: string,
  email: string,
  password: string,
  username: string,
): Promise<RegisterResult> {
  try {
    return await fetchJson<RegisterResult>(`${apiBaseUrl}/api/auth/register`, {
      method: 'POST',
      body: { email, password, username },
      checkStatus: true,
    });
  } catch (err) {
    throw toAuthApiError(err, mapRegisterStatus);
  }
}

export interface LoginResult {
  token: string;
}

/** `POST /api/auth/login` — ver `mapLoginStatus` para el mapeo de errores. */
export async function loginAccount(apiBaseUrl: string, email: string, password: string): Promise<LoginResult> {
  try {
    return await fetchJson<LoginResult>(`${apiBaseUrl}/api/auth/login`, {
      method: 'POST',
      body: { email, password },
      checkStatus: true,
    });
  } catch (err) {
    throw toAuthApiError(err, mapLoginStatus);
  }
}

/**
 * `POST /api/auth/reset-password/request` — el backend responde siempre con
 * éxito genérico, exista o no la cuenta (anti-enumeración); esta función no
 * necesita devolver ni distinguir nada, solo confirmar que la petición llegó.
 */
export async function requestPasswordReset(apiBaseUrl: string, email: string): Promise<void> {
  await fetchJson(`${apiBaseUrl}/api/auth/reset-password/request`, {
    method: 'POST',
    body: { email },
  });
}

/** `POST /api/auth/verify-email/request` — mismo criterio que `requestPasswordReset`. */
export async function requestEmailVerification(apiBaseUrl: string, email: string): Promise<void> {
  await fetchJson(`${apiBaseUrl}/api/auth/verify-email/request`, {
    method: 'POST',
    body: { email },
  });
}

export interface CurrentUser {
  id: number;
  email: string;
  emailVerified: boolean;
  /** `null` mientras la cuenta no ha fijado ningún username todavía (ver nombre-usuario). */
  username: string | null;
}

interface CurrentUserResponse {
  id: number;
  email: string;
  email_verified: boolean;
  username: string | null;
}

/** `GET /api/auth/me` — ver `mapMeStatus` para el mapeo de errores. */
export async function fetchCurrentUser(apiBaseUrl: string, token: string): Promise<CurrentUser> {
  try {
    const response = await fetchJson<CurrentUserResponse>(`${apiBaseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      checkStatus: true,
    });
    return { id: response.id, email: response.email, emailVerified: response.email_verified, username: response.username };
  } catch (err) {
    throw toAuthApiError(err, mapMeStatus);
  }
}

/**
 * `PATCH /api/auth/username` — fija o cambia el username de la cuenta
 * autenticada, misma operación para ambos casos (ver nombre-usuario,
 * design.md Decisión 2). Ver `mapUsernameStatus` para el mapeo de errores.
 */
export async function setUsername(apiBaseUrl: string, token: string, username: string): Promise<void> {
  try {
    await fetchJson(`${apiBaseUrl}/api/auth/username`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
      body: { username },
      checkStatus: true,
    });
  } catch (err) {
    throw toAuthApiError(err, mapUsernameStatus);
  }
}
