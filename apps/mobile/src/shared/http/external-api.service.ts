import type { ISessionRepository } from '../models/session.repository.js';

/**
 * Causa de un fallo de `fetchJson` al consultar una API:
 * - `network`: la petición no pudo completarse (fallo de red, DNS, CORS...).
 * - `timeout`: la petición se abortó por superar el tiempo máximo configurado.
 * - `invalid-json`: la respuesta se recibió, pero su cuerpo no es JSON válido.
 * - `http-error`: la respuesta se recibió y es JSON válido, pero el status no
 *   es 2xx — solo se comprueba si se pasa `checkStatus: true` (ver `fetchJson`).
 */
export type ExternalApiErrorKind = 'network' | 'timeout' | 'invalid-json' | 'http-error';

/**
 * Error tipado para fallos de integraciones HTTP con APIs externas.
 * El campo `kind` permite a cada consumidor decidir cómo reaccionar
 * (p. ej. ofrecer reintento en `network`/`timeout`, pero no en `invalid-json`).
 * `status`/`body` solo se rellenan para `kind: 'http-error'`.
 */
export class ExternalApiError extends Error {
  /**
   * @param kind - Causa del fallo (`network`, `timeout`, `invalid-json` o `http-error`).
   * @param message - Mensaje descriptivo del error.
   * @param status - Status HTTP de la respuesta, solo para `kind: 'http-error'`.
   * @param body - Cuerpo JSON ya parseado de la respuesta, solo para `kind: 'http-error'`.
   */
  constructor(
    public readonly kind: ExternalApiErrorKind,
    message: string,
    public readonly status?: number,
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = 'ExternalApiError';
  }
}

/**
 * Renovación silenciosa de sesión para `fetchJson` (ver
 * renovacion-token-sesion, ADR-057). `refresh` es estructuralmente
 * `refreshSession` de `auth/auth-api.service.ts` — se recibe por inyección
 * en vez de importarla directamente para no crear un ciclo de imports
 * (`auth-api.service.ts` ya importa `fetchJson` de este mismo módulo).
 */
export interface SessionRefreshOptions {
  sessionRepository: ISessionRepository;
  refresh: (refreshToken: string) => Promise<{ token: string; refreshToken: string; expiresIn: number }>;
}

/**
 * Opciones aceptadas por `fetchJson`.
 */
export interface FetchJsonOptions {
  /** Tiempo máximo de espera en milisegundos antes de abortar la petición. */
  timeoutMs?: number;
  /** Método HTTP. Por defecto `'GET'`. */
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  /**
   * Cuerpo de la petición. Un `FormData` se envía tal cual, sin serializar a
   * JSON ni fijar `Content-Type` (el navegador/WebView añade el `boundary`
   * multipart correcto solo — fijarlo a mano lo rompe). Cualquier otro valor
   * se serializa a JSON con `Content-Type: application/json` añadido automáticamente.
   */
  body?: unknown;
  /** Cabeceras adicionales (p. ej. `Authorization`), combinadas con `Content-Type` si hay `body`. */
  headers?: Record<string, string>;
  /**
   * Si es `true`, una respuesta con status no-2xx lanza `ExternalApiError`
   * (`kind: 'http-error'`) en vez de devolver el body igualmente. Por
   * defecto `false` para no cambiar el comportamiento ya probado de las
   * integraciones `GET` existentes (catálogo de tipos de parada, vPIC), que
   * siempre asumieron éxito implícito.
   */
  checkStatus?: boolean;
  /**
   * Si se pasa, un 401 con `checkStatus: true` intenta renovar el access
   * token con el refresh token guardado antes de propagar el error, y
   * repite esta misma petición una vez con el token nuevo (ver
   * renovacion-token-sesion). Sin `refreshToken` guardado, o si la
   * renovación también falla, se limpia la sesión y el 401 original se
   * propaga tal cual — sin este parámetro, comportamiento idéntico a hoy.
   */
  sessionRefresh?: SessionRefreshOptions;
}

/** Timeout aplicado por defecto cuando no se especifica `options.timeoutMs`. */
const DEFAULT_TIMEOUT_MS = 8000;

/** Construye el `RequestInit` de `fetchJson` a partir de las opciones y la señal de abort. */
function buildRequestInit(controller: AbortController, options?: FetchJsonOptions): RequestInit {
  const method = options?.method ?? 'GET';
  const hasBody = options?.body !== undefined;
  const isFormData = options?.body instanceof FormData;
  const headers = { ...(hasBody && !isFormData ? { 'Content-Type': 'application/json' } : {}), ...options?.headers };
  const init: RequestInit = { signal: controller.signal, method };
  if (Object.keys(headers).length > 0) init.headers = headers;
  if (hasBody) init.body = isFormData ? (options?.body as FormData) : JSON.stringify(options?.body);
  return init;
}

/** Una respuesta 204 (p. ej. DELETE) o con Content-Length "0" no tiene cuerpo -- llamar a `response.json()` sobre ella lanzaría por JSON inválido. */
function hasEmptyBody(response: Response): boolean {
  return response.status === 204 || response.headers?.get('content-length') === '0';
}

/**
 * Intenta renovar la sesión y repetir la petición original una vez. Sin
 * refreshToken guardado, o si la renovación falla, limpia la sesión y
 * devuelve `succeeded: false` para que el 401 original se propague tal cual
 * (ver JSDoc de `sessionRefresh` en `FetchJsonOptions`).
 */
async function tryRefreshAndRetry<T>(url: string, options: FetchJsonOptions): Promise<{ succeeded: boolean; value?: T }> {
  const refreshOptions = options.sessionRefresh;
  if (!refreshOptions) return { succeeded: false };

  const session = await refreshOptions.sessionRepository.get();
  if (!session?.refreshToken) return { succeeded: false };

  let newAccessToken: string;
  try {
    const refreshed = await refreshOptions.refresh(session.refreshToken);
    await refreshOptions.sessionRepository.save({
      token: refreshed.token,
      email: session.email,
      refreshToken: refreshed.refreshToken,
      expiresAt: Date.now() + refreshed.expiresIn * 1000,
    });
    newAccessToken = refreshed.token;
  } catch {
    await refreshOptions.sessionRepository.clear();
    return { succeeded: false };
  }

  const { sessionRefresh: _sessionRefresh, ...retryOptions } = options;
  void _sessionRefresh;
  const value = await fetchJson<T>(url, {
    ...retryOptions,
    headers: { ...options.headers, Authorization: `Bearer ${newAccessToken}` },
  });
  return { succeeded: true, value };
}

/**
 * Realiza una petición HTTP y parsea su respuesta como JSON, con timeout
 * explícito vía `AbortController` (nunca queda esperando indefinidamente) y
 * un `ExternalApiError` tipado que distingue error de red, timeout, respuesta
 * no-JSON y (solo en `POST`) status HTTP de error. Infraestructura genérica y
 * reutilizable por cualquier integración HTTP — no depende de ningún plugin
 * de Tauri, solo del `fetch()` nativo disponible en navegador y WebView.
 *
 * El status HTTP solo se comprueba con `checkStatus: true`: las integraciones
 * `GET` existentes (catálogo de tipos de parada, vPIC) siempre han asumido
 * éxito implícito y no distinguen status — cambiarlo ahí sería un cambio de
 * comportamiento no pedido. Las llamadas de auth (`POST` de registro/login/
 * reset, y el `GET` autenticado de `/api/auth/me`) sí necesitan distinguir
 * 200 de 401/403/409/429, así que pasan `checkStatus: true` explícitamente.
 * @param url - URL absoluta a consultar.
 * @param options - Opciones de la petición (`timeoutMs`, `method`, `body`).
 * @returns El cuerpo de la respuesta ya parseado como `T`.
 */
export async function fetchJson<T>(url: string, options?: FetchJsonOptions): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, options?.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  try {
    let response: Response;
    try {
      response = await fetch(url, buildRequestInit(controller, options));
    } catch (err) {
      if (controller.signal.aborted) {
        throw new ExternalApiError('timeout', `Request to ${url} timed out`);
      }
      throw new ExternalApiError('network', `Network error requesting ${url}: ${String(err)}`);
    }

    if (hasEmptyBody(response)) {
      if (options?.checkStatus && !response.ok) {
        throw new ExternalApiError('http-error', `Request to ${url} failed with status ${String(response.status)}`, response.status);
      }
      return undefined as T;
    }

    let parsed: unknown;
    try {
      parsed = await response.json();
    } catch {
      throw new ExternalApiError('invalid-json', `Response from ${url} is not valid JSON`);
    }

    if (options?.checkStatus && !response.ok) {
      const retry = response.status === 401 && options.sessionRefresh
        ? await tryRefreshAndRetry<T>(url, options)
        : { succeeded: false as const };
      if (retry.succeeded) return retry.value as T;
      throw new ExternalApiError(
        'http-error',
        `Request to ${url} failed with status ${String(response.status)}`,
        response.status,
        parsed,
      );
    }

    return parsed as T;
  } finally {
    clearTimeout(timer);
  }
}
