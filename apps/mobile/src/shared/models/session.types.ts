/**
 * Sesión de usuario persistida localmente tras un login correcto. `token` es
 * el access token de vida corta; `refreshToken`/`expiresAt` permiten
 * renovarlo sin contraseña (ver renovacion-token-sesion, ADR-057) — ambos
 * opcionales porque una sesión guardada antes de este cambio no los tiene
 * (formato viejo, sin nada con qué renovarse).
 */
export interface Session {
  /** Access token de sesión (JWT) emitido por `apps/api`. */
  token: string;
  /** Email de la cuenta autenticada. */
  email: string;
  /** Refresh token de vida larga, canjeable por un access token nuevo sin contraseña. */
  refreshToken?: string;
  /** Epoch ms en el que expira `token` — usado para renovar de forma proactiva al abrir la app. */
  expiresAt?: number;
}
