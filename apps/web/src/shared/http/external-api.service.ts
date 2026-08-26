/** Causa de un fallo de `fetchJson` no relacionado con el cuerpo de la respuesta. */
export type ExternalApiErrorKind = 'network' | 'http-error';

/** Error tipado para fallos de red o de estado HTTP al llamar a `apps/api`. */
export class ExternalApiError extends Error {
  constructor(
    public readonly kind: ExternalApiErrorKind,
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'ExternalApiError';
  }
}

interface FetchJsonOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
}

/**
 * `fetch()` con parseo JSON tipado y errores normalizados. `checkStatus`
 * (implícito: siempre) lanza `ExternalApiError` en cualquier respuesta no-2xx
 * en vez de devolver el cuerpo de error como si fuera un éxito.
 */
export async function fetchJson<T>(url: string, options: FetchJsonOptions = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: options.method ?? 'GET',
      headers: {
        ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers,
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : null,
    });
  } catch (err) {
    throw new ExternalApiError('network', err instanceof Error ? err.message : String(err));
  }

  if (!response.ok) {
    throw new ExternalApiError('http-error', `HTTP ${String(response.status)}`, response.status);
  }

  return (await response.json()) as T;
}
