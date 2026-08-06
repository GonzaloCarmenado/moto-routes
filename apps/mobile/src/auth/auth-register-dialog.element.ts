/**
 * Web Component `<auth-register-dialog>`: modal "Crear cuenta" — email +
 * contraseña, `POST /api/auth/register`. Tras un registro correcto NO inicia
 * sesión automáticamente (la cuenta no está verificada todavía, el login
 * fallaría) — muestra un mensaje pidiendo revisar el email, con un único
 * botón para cerrar. Mismo patrón overlay/`trapFocus` que `confirm-dialog`.
 */
import { BaseElement } from '../shared/base-element.js';
import { registerAccount, AuthApiError, type AuthApiErrorKind } from './auth-api.service.js';
import styles from './auth-register-dialog.element.css?inline';

export interface AuthRegisterDialogOptions {
  apiBaseUrl: string;
}

const ERROR_MESSAGES: Partial<Record<AuthApiErrorKind, string>> = {
  'email-taken': 'Ya existe una cuenta con ese email. Prueba a iniciar sesión.',
  'weak-password': 'La contraseña debe tener al menos 8 caracteres.',
  'invalid-email': 'Introduce un email válido.',
  'rate-limited': 'Demasiados intentos. Prueba de nuevo en unos minutos.',
};
const GENERIC_ERROR_MESSAGE = 'No se pudo crear la cuenta. Inténtalo de nuevo.';

class AuthRegisterDialogElement extends BaseElement {
  private options: AuthRegisterDialogOptions | null = null;
  private onResolve: ((value: 'registered' | 'cancelled') => void) | null = null;
  private previouslyFocused: HTMLElement | null = null;
  private step: 'form' | 'success' = 'form';
  private errorMessage: string | null = null;
  private submitting = false;
  /** Valores del formulario, seguidos aparte del DOM para no perderlos al
   * re-renderizar tras un error (mismo motivo que `currentName` en
   * `profile-edit-dialog.element.ts`). */
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

  open(options: AuthRegisterDialogOptions): Promise<'registered' | 'cancelled'> {
    this.options = options;
    this.previouslyFocused = document.activeElement as HTMLElement | null;
    this.render();
    this.shadowRoot?.querySelector<HTMLInputElement>('.input')?.focus();
    return new Promise((resolve) => { this.onResolve = resolve; });
  }

  private close(result: 'registered' | 'cancelled'): void {
    this.onResolve?.(result);
    this.onResolve = null;
    this.previouslyFocused?.focus();
    this.remove();
  }

  private async handleSubmit(): Promise<void> {
    if (!this.options || this.submitting) return;
    this.currentEmail = this.shadowRoot?.querySelector<HTMLInputElement>('[data-cy="auth-input-email-registro"]')?.value ?? '';
    this.currentPassword = this.shadowRoot?.querySelector<HTMLInputElement>('[data-cy="auth-input-password-registro"]')?.value ?? '';
    const email = this.currentEmail;
    const password = this.currentPassword;

    this.submitting = true;
    this.errorMessage = null;
    this.render();

    try {
      await registerAccount(this.options.apiBaseUrl, email, password);
      this.submitting = false;
      this.step = 'success';
      this.render();
    } catch (err) {
      this.submitting = false;
      this.errorMessage =
        (err instanceof AuthApiError ? ERROR_MESSAGES[err.kind] : undefined) ?? GENERIC_ERROR_MESSAGE;
      this.render();
    }
  }

  private buildOverlay(): HTMLElement {
    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    overlay.addEventListener('click', () => { if (!this.submitting) this.close('cancelled'); });
    return overlay;
  }

  private buildFormStep(): HTMLElement {
    const dialog = document.createElement('div');
    dialog.className = 'dialog';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('data-cy', 'auth-dialog-registro');

    const title = document.createElement('h2');
    title.className = 'title';
    title.textContent = 'Crear cuenta';
    dialog.appendChild(title);

    if (this.errorMessage) {
      const error = document.createElement('p');
      error.className = 'error';
      error.textContent = this.errorMessage;
      dialog.appendChild(error);
    }

    dialog.appendChild(this.buildField('Email', 'email', 'auth-input-email-registro', this.currentEmail));
    dialog.appendChild(this.buildField('Contraseña', 'password', 'auth-input-password-registro', this.currentPassword));
    dialog.appendChild(this.buildFormActions());
    return dialog;
  }

  private buildFormActions(): HTMLElement {
    const actions = document.createElement('div');
    actions.className = 'actions';

    const confirmBtn = document.createElement('button');
    confirmBtn.type = 'button';
    confirmBtn.className = 'action action--primary';
    confirmBtn.setAttribute('data-cy', 'auth-btn-confirmar-registro');
    confirmBtn.textContent = this.submitting ? 'Creando cuenta…' : 'Crear cuenta';
    confirmBtn.disabled = this.submitting;
    confirmBtn.addEventListener('click', () => { void this.handleSubmit(); });
    actions.appendChild(confirmBtn);

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'action';
    cancelBtn.setAttribute('data-cy', 'auth-btn-cancelar-registro');
    cancelBtn.textContent = 'Cancelar';
    cancelBtn.disabled = this.submitting;
    cancelBtn.addEventListener('click', () => { this.close('cancelled'); });
    actions.appendChild(cancelBtn);

    return actions;
  }

  private buildSuccessStep(): HTMLElement {
    const dialog = document.createElement('div');
    dialog.className = 'dialog';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('data-cy', 'auth-dialog-registro');

    const title = document.createElement('h2');
    title.className = 'title';
    title.textContent = 'Cuenta creada';
    dialog.appendChild(title);

    const message = document.createElement('p');
    message.className = 'message';
    message.textContent = 'Te hemos enviado un email — verifica tu cuenta antes de iniciar sesión.';
    dialog.appendChild(message);

    const actions = document.createElement('div');
    actions.className = 'actions';
    const okBtn = document.createElement('button');
    okBtn.type = 'button';
    okBtn.className = 'action action--primary';
    okBtn.setAttribute('data-cy', 'auth-btn-confirmar-registro');
    okBtn.textContent = 'Entendido';
    okBtn.addEventListener('click', () => { this.close('registered'); });
    actions.appendChild(okBtn);
    dialog.appendChild(actions);

    return dialog;
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

  protected render(): void {
    if (!this.options) return;
    const content = this.step === 'success' ? this.buildSuccessStep() : this.buildFormStep();
    this.renderShadow(styles, this.buildOverlay(), content);
  }
}

customElements.define('auth-register-dialog', AuthRegisterDialogElement);

/** Abre un `<auth-register-dialog>` montado en `document.body`. */
export function openRegisterDialog(options: AuthRegisterDialogOptions): Promise<'registered' | 'cancelled'> {
  const el = document.createElement('auth-register-dialog') as AuthRegisterDialogElement;
  document.body.appendChild(el);
  return el.open(options);
}
