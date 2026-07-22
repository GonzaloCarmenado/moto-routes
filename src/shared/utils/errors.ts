/**
 * Extrae un mensaje legible de cualquier valor de rechazo/excepción.
 * Los rechazos de invoke() de Tauri no son instancias de Error de JS —
 * suelen ser strings o objetos planos serializados desde Rust — así que un
 * simple `err instanceof Error` pierde el mensaje real y cae a un texto genérico.
 */
export function toErrorMessage(err: unknown, fallback = 'Error desconocido'): string {
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
