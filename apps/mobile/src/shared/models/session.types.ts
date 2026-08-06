/** Sesión de usuario persistida localmente tras un login correcto. */
export interface Session {
  /** Token de sesión (JWT) emitido por `apps/api`. */
  token: string;
  /** Email de la cuenta autenticada. */
  email: string;
}
