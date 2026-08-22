/** Payload del evento `USERNAME_FORM_SUCCESS_EVENT`. */
export interface UsernameFormSuccessDetail {
  username: string;
}

/** Nombre del evento despachado por `<username-form>` al fijar/cambiar el username con éxito. */
export const USERNAME_FORM_SUCCESS_EVENT = 'username-form:success';
