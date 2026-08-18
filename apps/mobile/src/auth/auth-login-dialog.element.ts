/**
 * Web Component `<auth-login-dialog>`: modal "Iniciar sesión" — email +
 * contraseña, `POST /api/auth/login`. Un error `email-not-verified` (a
 * diferencia de credenciales incorrectas, que muestra el mismo mensaje
 * genérico que ya aplica `apps/api` para no habilitar enumeración) se
 * distingue con un botón de reenvío — quien llega aquí ya demostró conocer
 * la contraseña, así que distinguirlo no es una enumeración nueva (mismo
 * criterio que el propio backend, ver ADR-038).
 */
import { BaseElement } from '../shared/base-element.js';
import { loginAccount, requestEmailVerification, AuthApiError, type AuthApiErrorKind } from './auth-api.service.js';
import { registerDeviceTokenAfterLogin } from '../shared/services/device-token.service.js';
import type { ISessionRepository } from '../shared/models/session.repository.js';
import styles from './auth-login-dialog.element.css?inline';

export interface AuthLoginDialogOptions {
  apiBaseUrl: string;
  sessionRepository: ISessionRepository;
}

const ERROR_MESSAGES: Partial<Record<AuthApiErrorKind, string>> = {
  'invalid-credentials': 'Email o contraseña incorrectos.',
  'rate-limited': 'Demasiados intentos. Prueba de nuevo en unos minutos.',
};
const GENERIC_ERROR_MESSAGE = 'No se pudo iniciar sesión. Inténtalo de nuevo.';
const EMAIL_NOT_VERIFIED_MESSAGE = 'Todavía no has verificado tu email.';
const RESEND_CONFIRMATION_MESSAGE = 'Te hemos enviado un nuevo email de verificación.';

class AuthLoginDialogElement extends BaseElement {
  private options: AuthLoginDialogOptions | null = null;
  private onResolve: ((value: 'logged-in' | 'cancelled') => void) | null = null;
  private previouslyFocused: HTMLElement | null = null;
  private errorMessage: string | null = null;
  private emailNotVerified = false;
  private resendConfirmation: string | null = null;
  private submitting = false;
  /** Valores del formulario, seguidos aparte del DOM para no perderlos al
   * re-renderizar tras un error (mismo motivo que `currentName` en
   * `profile-edit-dialog.element.ts`: `render()` reconstruye los inputs). */
  private currentEmail = '';
  private currentPassword = '';

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape' && !this.submitting) this.close('cancelled');
  };

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback(): void {
    document.addEventListener('keydown', this.onKeyDown);
  }

  disconnectedCallback(): void {
    document.removeEventListener('keydown', this.onKeyDown);
  }

  open(options: AuthLoginDialogOptions): Promise<'logged-in' | 'cancelled'> {
    this.options = options;
    this.previouslyFocused = document.activeElement as HTMLElement | null;
    this.render();
    this.shadowRoot?.querySelector<HTMLInputElement>('.input')?.focus();
    return new Promise((resolve) => { this.onResolve = resolve; });
  }

  private close(result: 'logged-in' | 'cancelled'): void {
    this.onResolve?.(result);
    this.onResolve = null;
    this.previouslyFocused?.focus();
    this.remove();
  }

  private async handleSubmit(): Promise<void> {
    if (!this.options || this.submitting) return;
    this.currentEmail = this.shadowRoot?.querySelector<HTMLInputElement>('[data-cy="auth-input-email-login"]')?.value ?? '';
    this.currentPassword = this.shadowRoot?.querySelector<HTMLInputElement>('[data-cy="auth-input-password-login"]')?.value ?? '';
    const email = this.currentEmail;
    const password = this.currentPassword;

    this.submitting = true;
    this.errorMessage = null;
    this.emailNotVerified = false;
    this.resendConfirmation = null;
    this.render();

    try {
      const { token } = await loginAccount(this.options.apiBaseUrl, email, password);
      await this.options.sessionRepository.save({ token, email });
      // Fire-and-forget: el permiso/registro de notificaciones nunca debe
      // retrasar el cierre del diálogo de login (best-effort, ver JSDoc del
      // propio servicio).
      void registerDeviceTokenAfterLogin(this.options.apiBaseUrl, { token, email });
      this.submitting = false;
      this.close('logged-in');
    } catch (err) {
      this.submitting = false;
      if (err instanceof AuthApiError && err.kind === 'email-not-verified') {
        this.errorMessage = EMAIL_NOT_VERIFIED_MESSAGE;
        this.emailNotVerified = true;
      } else {
        this.errorMessage = (err instanceof AuthApiError ? ERROR_MESSAGES[err.kind] : undefined) ?? GENERIC_ERROR_MESSAGE;
      }
      this.render();
    }
  }

  private async handleResend(): Promise<void> {
    if (!this.options) return;
    await requestEmailVerification(this.options.apiBaseUrl, this.currentEmail);
    this.resendConfirmation = RESEND_CONFIRMATION_MESSAGE;
    this.render();
  }

  private buildOverlay(): HTMLElement {
    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    overlay.addEventListener('click', () => { if (!this.submitting) this.close('cancelled'); });
    return overlay;
  }

  private buildField(label: string, type: string, dataCy: string, value: string): HTMLElement {
    const field = document.createElement('div');
    field.className = 'field';
    const labelEl = document.createElement('label');
    labelEl.className = 'field-label';
    labelEl.textContent = label;
    field.appendChild(labelEl);
    const input = document.createElement('input');
    input.type = type;
    input.className = 'input';
    input.value = value;
    input.setAttribute('data-cy', dataCy);
    field.appendChild(input);
    return field;
  }

  private buildDialog(): HTMLElement {
    const dialog = document.createElement('div');
    dialog.className = 'dialog';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('data-cy', 'auth-dialog-login');

    const title = document.createElement('h2');
    title.className = 'title';
    title.textContent = 'Iniciar sesión';
    dialog.appendChild(title);

    if (this.errorMessage) {
      const error = document.createElement('p');
      error.className = 'error';
      error.textContent = this.errorMessage;
      dialog.appendChild(error);
    }

    if (this.emailNotVerified) {
      dialog.appendChild(this.buildResendControl());
    }

    dialog.appendChild(this.buildField('Email', 'email', 'auth-input-email-login', this.currentEmail));
    dialog.appendChild(this.buildField('Contraseña', 'password', 'auth-input-password-login', this.currentPassword));
    dialog.appendChild(this.buildActions());

    return dialog;
  }

  private buildResendControl(): HTMLElement {
    const wrapper = document.createElement('div');

    if (this.resendConfirmation) {
      const message = document.createElement('p');
      message.className = 'message';
      message.textContent = this.resendConfirmation;
      wrapper.appendChild(message);
      return wrapper;
    }

    const resendBtn = document.createElement('button');
    resendBtn.type = 'button';
    resendBtn.className = 'action action--link';
    resendBtn.setAttribute('data-cy', 'auth-btn-reenviar-verificacion');
    resendBtn.textContent = 'Reenviar email de verificación';
    resendBtn.addEventListener('click', () => { void this.handleResend(); });
    wrapper.appendChild(resendBtn);
    return wrapper;
  }

  private buildActions(): HTMLElement {
    const actions = document.createElement('div');
    actions.className = 'actions';

    const confirmBtn = document.createElement('button');
    confirmBtn.type = 'button';
    confirmBtn.className = 'action action--primary';
    confirmBtn.setAttribute('data-cy', 'auth-btn-confirmar-login');
    confirmBtn.textContent = this.submitting ? 'Entrando…' : 'Iniciar sesión';
    confirmBtn.disabled = this.submitting;
    confirmBtn.addEventListener('click', () => { void this.handleSubmit(); });
    actions.appendChild(confirmBtn);

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'action';
    cancelBtn.setAttribute('data-cy', 'auth-btn-cancelar-login');
    cancelBtn.textContent = 'Cancelar';
    cancelBtn.disabled = this.submitting;
    cancelBtn.addEventListener('click', () => { this.close('cancelled'); });
    actions.appendChild(cancelBtn);

    return actions;
  }

  protected render(): void {
    if (!this.options) return;
    this.renderShadow(styles, this.buildOverlay(), this.buildDialog());
  }
}

customElements.define('auth-login-dialog', AuthLoginDialogElement);

/** Abre un `<auth-login-dialog>` montado en `document.body`. */
export function openLoginDialog(options: AuthLoginDialogOptions): Promise<'logged-in' | 'cancelled'> {
  const el = document.createElement('auth-login-dialog') as AuthLoginDialogElement;
  document.body.appendChild(el);
  return el.open(options);
}
