/**
 * Causa de un fallo de `fetchJson` al consultar una API externa:
 * - `network`: la petición no pudo completarse (fallo de red, DNS, CORS...).
 * - `timeout`: la petición se abortó por superar el tiempo máximo configurado.
 * - `invalid-json`: la respuesta se recibió, pero su cuerpo no es JSON válido.
 */
export type ExternalApiErrorKind = 'network' | 'timeout' | 'invalid-json';

/**
 * Error tipado para fallos de integraciones HTTP con APIs externas.
 * El campo `kind` permite a cada consumidor decidir cómo reaccionar
 * (p. ej. ofrecer reintento en `network`/`timeout`, pero no en `invalid-json`).
 */
export class ExternalApiError extends Error {
  /**
   * @param kind - Causa del fallo (`network`, `timeout` o `invalid-json`).
   * @param message - Mensaje descriptivo del error.
   */
  constructor(
    public readonly kind: ExternalApiErrorKind,
    message: string,
  ) {
    super(message);
    this.name = 'ExternalApiError';
  }
}

/**
 * Opciones aceptadas por `fetchJson`. Se deja abierto a crecer (p. ej. `headers`
 * en el futuro) sin romper la firma pública actual.
 */
export interface FetchJsonOptions {
  /** Tiempo máximo de espera en milisegundos antes de abortar la petición. */
  timeoutMs?: number;
}

/** Timeout aplicado por defecto cuando no se especifica `options.timeoutMs`. */
const DEFAULT_TIMEOUT_MS = 8000;

/**
 * Realiza una petición HTTP y parsea su respuesta como JSON, con timeout
 * explícito vía `AbortController` (nunca queda esperando indefinidamente) y
 * un `ExternalApiError` tipado que distingue error de red, timeout y
 * respuesta no-JSON. Infraestructura genérica y reutilizable por cualquier
 * integración con una API externa — no depende de ningún plugin de Tauri,
 * solo del `fetch()` nativo disponible en navegador y WebView.
 * @param url - URL absoluta a consultar.
 * @param options - Opciones de la petición (p. ej. `timeoutMs`).
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
      response = await fetch(url, { signal: controller.signal });
    } catch (err) {
      if (controller.signal.aborted) {
        throw new ExternalApiError('timeout', `Request to ${url} timed out`);
      }
      throw new ExternalApiError('network', `Network error requesting ${url}: ${String(err)}`);
    }

    try {
      return (await response.json()) as T;
    } catch {
      throw new ExternalApiError('invalid-json', `Response from ${url} is not valid JSON`);
    }
  } finally {
    clearTimeout(timer);
  }
}
