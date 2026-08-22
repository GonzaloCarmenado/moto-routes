/**
 * @packageDocumentation
 * Tipos y nombre del evento de éxito de `<username-form>`.
 */

/** Payload del evento `USERNAME_FORM_SUCCESS_EVENT`. */
export interface UsernameFormSuccessDetail {
  /** El username que quedó fijado o actualizado con éxito. */
  username: string;
}

/** Nombre del evento despachado por `<username-form>` al fijar/cambiar el username con éxito. */
export const USERNAME_FORM_SUCCESS_EVENT = 'username-form:success';
