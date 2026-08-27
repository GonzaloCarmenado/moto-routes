/** Clave de `sessionStorage` donde vive el token de operador mientras dure la sesión de navegador. */
const SESSION_STORAGE_KEY = 'operatorToken';

/**
 * Sesión de operador en `sessionStorage` — deliberadamente no `localStorage`
 * (design.md, Decisión 2): acota la exposición del secreto real a la
 * pestaña/sesión de navegador actual, nunca persiste indefinidamente.
 */
export const sessionStore = {
  /** Token de operador de la sesión actual, o `null` si no hay ninguna sesión abierta. */
  getToken(): string | null {
    return sessionStorage.getItem(SESSION_STORAGE_KEY);
  },

  /** Abre una sesión de operador guardando su token. */
  setToken(token: string): void {
    sessionStorage.setItem(SESSION_STORAGE_KEY, token);
  },

  /** Cierra la sesión de operador actual, si la hay. */
  clear(): void {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
  },
};
