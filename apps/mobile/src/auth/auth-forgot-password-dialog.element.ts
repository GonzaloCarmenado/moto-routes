/**
 * Web Component `<auth-forgot-password-dialog>`: modal "Recuperar
 * contraseña" — solo email, `POST /api/auth/reset-password/request`. El
 * backend responde siempre el mismo éxito genérico exista o no la cuenta
 * (anti-enumeración, ADR-039) — este diálogo no distingue nada, solo muestra
 * ese mismo mensaje. El resto del flujo (escribir la contraseña nueva)
 * ocurre en la página web ya construida por `apps/api`, fuera de la app.
 */
import { BaseElement } from '../shared/base-element.js';
import { requestPasswordReset } from './auth-api.service.js';
import styles from './auth-forgot-password-dialog.element.css?inline';

export interface AuthForgotPasswordDialogOptions {
  apiBaseUrl: string;
}

class AuthForgotPasswordDialogElement extends BaseElement {
  private options: AuthForgotPasswordDialogOptions | null = null;
  private onResolve: ((value: 'sent' | 'cancelled') => void) | null = null;
  private previouslyFocused: HTMLElement | null = null;
  private step: 'form' | 'sent' = 'form';
  private submitting = false;

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

  open(options: AuthForgotPasswordDialogOptions): Promise<'sent' | 'cancelled'> {
    this.options = options;
    this.previouslyFocused = document.activeElement as HTMLElement | null;
    this.render();
    this.shadowRoot?.querySelector<HTMLInputElement>('.input')?.focus();
    return new Promise((resolve) => { this.onResolve = resolve; });
  }

  private close(result: 'sent' | 'cancelled'): void {
    this.onResolve?.(result);
    this.onResolve = null;
    this.previouslyFocused?.focus();
    this.remove();
  }

  private async handleSubmit(): Promise<void> {
    if (!this.options || this.submitting) return;
    const email = this.shadowRoot?.querySelector<HTMLInputElement>('[data-cy="auth-input-email-recuperar"]')?.value ?? '';

    this.submitting = true;
    this.render();

    await requestPasswordReset(this.options.apiBaseUrl, email);

    this.submitting = false;
    this.step = 'sent';
    this.render();
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
    dialog.setAttribute('data-cy', 'auth-dialog-recuperar');

    const title = document.createElement('h2');
    title.className = 'title';
    title.textContent = 'Recuperar contraseña';
    dialog.appendChild(title);

    const message = document.createElement('p');
    message.className = 'message';
    message.textContent = 'Te enviaremos un enlace para elegir una contraseña nueva.';
    dialog.appendChild(message);

    dialog.appendChild(this.buildEmailField());
    dialog.appendChild(this.buildFormActions());
    return dialog;
  }

  private buildEmailField(): HTMLElement {
    const field = document.createElement('div');
    field.className = 'field';
    const label = document.createElement('label');
    label.className = 'field-label';
    label.textContent = 'Email';
    field.appendChild(label);
    const input = document.createElement('input');
    input.type = 'email';
    input.className = 'input';
    input.setAttribute('data-cy', 'auth-input-email-recuperar');
    field.appendChild(input);
    return field;
  }

  private buildFormActions(): HTMLElement {
    const actions = document.createElement('div');
    actions.className = 'actions';

    const confirmBtn = document.createElement('button');
    confirmBtn.type = 'button';
    confirmBtn.className = 'action action--primary';
    confirmBtn.setAttribute('data-cy', 'auth-btn-confirmar-recuperar');
    confirmBtn.textContent = this.submitting ? 'Enviando…' : 'Enviar enlace';
    confirmBtn.disabled = this.submitting;
    confirmBtn.addEventListener('click', () => { void this.handleSubmit(); });
    actions.appendChild(confirmBtn);

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'action';
    cancelBtn.setAttribute('data-cy', 'auth-btn-cancelar-recuperar');
    cancelBtn.textContent = 'Cancelar';
    cancelBtn.disabled = this.submitting;
    cancelBtn.addEventListener('click', () => { this.close('cancelled'); });
    actions.appendChild(cancelBtn);

    return actions;
  }

  private buildSentStep(): HTMLElement {
    const dialog = document.createElement('div');
    dialog.className = 'dialog';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('data-cy', 'auth-dialog-recuperar');

    const title = document.createElement('h2');
    title.className = 'title';
    title.textContent = 'Revisa tu email';
    dialog.appendChild(title);

    const message = document.createElement('p');
    message.className = 'message';
    message.textContent = 'Si existe una cuenta con ese email, te hemos enviado un enlace para elegir una contraseña nueva.';
    dialog.appendChild(message);

    const actions = document.createElement('div');
    actions.className = 'actions';
    const okBtn = document.createElement('button');
    okBtn.type = 'button';
    okBtn.className = 'action action--primary';
    okBtn.setAttribute('data-cy', 'auth-btn-confirmar-recuperar');
    okBtn.textContent = 'Entendido';
    okBtn.addEventListener('click', () => { this.close('sent'); });
    actions.appendChild(okBtn);
    dialog.appendChild(actions);

    return dialog;
  }

  protected render(): void {
    if (!this.options) return;
    const content = this.step === 'sent' ? this.buildSentStep() : this.buildFormStep();
    this.renderShadow(styles, this.buildOverlay(), content);
  }
}

customElements.define('auth-forgot-password-dialog', AuthForgotPasswordDialogElement);

/** Abre un `<auth-forgot-password-dialog>` montado en `document.body`. */
export function openForgotPasswordDialog(options: AuthForgotPasswordDialogOptions): Promise<'sent' | 'cancelled'> {
  const el = document.createElement('auth-forgot-password-dialog') as AuthForgotPasswordDialogElement;
  document.body.appendChild(el);
  return el.open(options);
}
