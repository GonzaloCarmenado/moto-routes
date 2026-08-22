/**
 * @packageDocumentation
 * Web Component `<username-form>`: campo + validación + envío del nombre de
 * usuario, sin overlay ni botón de cancelar — pieza compartida entre la
 * pantalla de bloqueo (`app.element.ts`, no descartable) y el diálogo de
 * edición desde Perfil (descartable) — el contenedor decide overlay/cancelar,
 * este componente solo el campo en sí (ver nombre-usuario, design.md
 * Decisión 5).
 */
import { BaseElement } from '../shared/base-element.js';
import { setUsername, AuthApiError, type AuthApiErrorKind } from './auth-api.service.js';
import { USERNAME_FORM_SUCCESS_EVENT, type UsernameFormSuccessDetail } from './username-form.types.js';
import styles from './username-form.element.css?inline';

/** Mismo formato que `usernamePattern` en `apps/api/internal/auth/user.go` — validación en cliente antes de llamar al backend. */
const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;

const ERROR_MESSAGES: Partial<Record<AuthApiErrorKind, string>> = {
  'username-taken': 'Ese nombre de usuario ya está en uso. Prueba con otro.',
  'invalid-username': 'El nombre de usuario debe tener 3-20 caracteres: minúsculas, dígitos y guion bajo.',
  'rate-limited': 'Demasiados intentos. Prueba de nuevo en unos minutos.',
  unauthorized: 'Tu sesión ha caducado. Vuelve a iniciar sesión.',
};
const GENERIC_ERROR_MESSAGE = 'No se pudo guardar el nombre de usuario. Inténtalo de nuevo.';
const INVALID_FORMAT_MESSAGE = 'Usa 3-20 caracteres: minúsculas, dígitos y guion bajo.';
const EMPTY_MESSAGE = 'Escribe un nombre de usuario.';

class UsernameFormElement extends BaseElement {
  private _apiBaseUrl = '';
  private _token = '';
  private currentInputValue = '';
  private errorMessage: string | null = null;
  private submitting = false;

  set apiBaseUrl(value: string) {
    this._apiBaseUrl = value;
  }

  set token(value: string) {
    this._token = value;
  }

  set currentUsername(value: string | null) {
    this.currentInputValue = value ?? '';
    this.render();
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback(): void {
    this.render();
  }

  private async handleSubmit(): Promise<void> {
    if (this.submitting) return;
    this.currentInputValue = this.shadowRoot?.querySelector<HTMLInputElement>('[data-cy="username-form-input"]')?.value ?? '';
    const username = this.currentInputValue.trim();

    if (username === '') {
      this.errorMessage = EMPTY_MESSAGE;
      this.render();
      return;
    }
    if (!USERNAME_PATTERN.test(username)) {
      this.errorMessage = INVALID_FORMAT_MESSAGE;
      this.render();
      return;
    }

    this.submitting = true;
    this.errorMessage = null;
    this.render();

    try {
      await setUsername(this._apiBaseUrl, this._token, username);
      this.submitting = false;
      this.emit<UsernameFormSuccessDetail>(USERNAME_FORM_SUCCESS_EVENT, { username });
    } catch (err) {
      this.submitting = false;
      this.errorMessage = (err instanceof AuthApiError ? ERROR_MESSAGES[err.kind] : undefined) ?? GENERIC_ERROR_MESSAGE;
      this.render();
    }
  }

  private buildField(): HTMLElement {
    const field = document.createElement('div');
    field.className = 'field';

    const label = document.createElement('label');
    label.className = 'field-label';
    label.textContent = 'Nombre de usuario';
    field.appendChild(label);

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'input';
    input.value = this.currentInputValue;
    input.setAttribute('data-cy', 'username-form-input');
    field.appendChild(input);

    return field;
  }

  protected render(): void {
    const content = document.createDocumentFragment();
    content.appendChild(this.buildField());

    if (this.errorMessage) {
      const error = document.createElement('p');
      error.className = 'error';
      error.setAttribute('data-cy', 'username-form-error');
      error.textContent = this.errorMessage;
      content.appendChild(error);
    }

    const submitBtn = document.createElement('button');
    submitBtn.type = 'button';
    submitBtn.className = 'action';
    submitBtn.setAttribute('data-cy', 'username-form-btn-guardar');
    submitBtn.textContent = this.submitting ? 'Guardando…' : 'Guardar';
    submitBtn.disabled = this.submitting;
    submitBtn.addEventListener('click', () => { void this.handleSubmit(); });
    content.appendChild(submitBtn);

    this.renderShadow(styles, content);
  }
}

customElements.define('username-form', UsernameFormElement);
