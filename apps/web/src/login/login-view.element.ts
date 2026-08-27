/**
 * Web Component `<login-view>`: pantalla de login de un único operador contra
 * el secreto administrativo ya existente (`ADMIN_STATUS_TOKEN`) — sin cuentas
 * de usuario ni backend de sesión propio (ver design.md, Decisión 2).
 */
import { BaseElement } from '../shared/base-element.js';
import { login, LoginError } from './login.service.js';
import { LOGIN_VIEW_SUCCESS_EVENT } from './login-view.types.js';
import styles from './login-view.element.css?inline';

class LoginViewElement extends BaseElement {
  private errorMessage: string | null = null;
  private currentToken = '';
  private submitting = false;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback(): void {
    this.render();
  }

  private async handleSubmit(): Promise<void> {
    if (this.submitting) return;
    this.currentToken = this.shadowRoot?.querySelector<HTMLInputElement>('[data-cy="login-input-token"]')?.value ?? '';

    this.submitting = true;
    this.errorMessage = null;
    this.render();

    try {
      await login(this.currentToken);
      this.submitting = false;
      this.emit<undefined>(LOGIN_VIEW_SUCCESS_EVENT, undefined);
    } catch (err) {
      this.submitting = false;
      this.errorMessage = err instanceof LoginError ? err.message : 'No se pudo iniciar sesión. Inténtalo de nuevo.';
      this.render();
    }
  }

  private buildField(): HTMLElement {
    const field = document.createElement('div');
    field.className = 'field';

    const label = document.createElement('label');
    label.className = 'field-label';
    label.textContent = 'Credencial de operador';
    field.appendChild(label);

    const input = document.createElement('input');
    input.type = 'password';
    input.className = 'input';
    input.value = this.currentToken;
    input.setAttribute('data-cy', 'login-input-token');
    field.appendChild(input);

    return field;
  }

  protected render(): void {
    const content = document.createDocumentFragment();

    const title = document.createElement('h1');
    title.className = 'title';
    title.textContent = 'Moto Routes — Panel';
    content.appendChild(title);

    content.appendChild(this.buildField());

    if (this.errorMessage) {
      const error = document.createElement('p');
      error.className = 'error';
      error.setAttribute('data-cy', 'login-error-message');
      error.textContent = this.errorMessage;
      content.appendChild(error);
    }

    const submitBtn = document.createElement('button');
    submitBtn.type = 'button';
    submitBtn.className = 'action';
    submitBtn.setAttribute('data-cy', 'login-button-submit');
    submitBtn.textContent = this.submitting ? 'Entrando…' : 'Entrar';
    submitBtn.disabled = this.submitting;
    submitBtn.addEventListener('click', () => { void this.handleSubmit(); });
    content.appendChild(submitBtn);

    this.renderShadow(styles, content);
  }
}

customElements.define('login-view', LoginViewElement);
