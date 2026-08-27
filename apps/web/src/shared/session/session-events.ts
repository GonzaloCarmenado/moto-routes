/** Evento global: la sesión de operador ha dejado de ser válida (401 del servidor, o cierre de sesión explícito). `app.element.ts` es el único listener — vuelve a mostrar el login. */
export const SESSION_INVALIDATED_EVENT = 'session-invalidated';

/** Despacha `SESSION_INVALIDATED_EVENT` en `window`. */
export function dispatchSessionInvalidated(): void {
  window.dispatchEvent(new CustomEvent(SESSION_INVALIDATED_EVENT));
}
