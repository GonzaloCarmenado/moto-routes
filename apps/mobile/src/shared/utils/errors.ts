import { ExternalApiError } from '../http/external-api.service.js';

/**
 * Extrae un mensaje legible de cualquier valor de rechazo/excepción.
 * Los rechazos de invoke() de Tauri no son instancias de Error de JS —
 * suelen ser strings o objetos planos serializados desde Rust — así que un
 * simple `err instanceof Error` pierde el mensaje real y cae a un texto genérico.
 */
export function toErrorMessage(err: unknown, fallback = 'Error desconocido'): string {
  // `ExternalApiError.message` es texto técnico dirigido a devs (incluye URLs
  // completas, "Request to ... timed out") — nunca pensado para el usuario
  // final. Se prioriza siempre el fallback legible que cada llamador ya pasa
  // para este caso (bug real: un timeout de red al reintentar subir una foto
  // mostraba literalmente el mensaje técnico completo en el toast).
  if (err instanceof ExternalApiError) return fallback;
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  if (
    err !== null
    && typeof err === 'object'
    && 'message' in err
    && typeof err.message === 'string'
  ) {
    return err.message;
  }
  try {
    return JSON.stringify(err) ?? fallback;
  } catch {
    return fallback;
  }
}
