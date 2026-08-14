/**
 * Web Component `<route-share-dialog>`: modal "Compartir ruta" — email del
 * destinatario, `POST /api/route-shares`. El backend responde siempre el
 * mismo mensaje genérico exista o no la cuenta (anti-enumeración, ver
 * design.md D2 de `compartir-ruta`) — este diálogo no distingue nada, solo
 * muestra ese mismo mensaje. La única validación hecha en cliente es "no
 * puedes compartir contigo mismo" (comparando contra el email de la sesión
 * activa, ya conocido por el propio usuario — no es una fuga de información).
 */
import { BaseElement } from '../../shared/base-element.js';
import { createInvitation } from '../../shared/http/route-sharing-api.service.js';
import { toErrorMessage } from '../../shared/utils/errors.js';
import styles from './route-share-dialog.element.css?inline';

export interface RouteShareDialogOptions {
  apiBaseUrl: string;
  token: string;
  routeId: string;
  /** Email de la sesión activa, para la validación "no compartir contigo mismo". */
  ownEmail: string;
}

class RouteShareDialogElement extends BaseElement {
  private options: RouteShareDialogOptions | null = null;
  private onResolve: ((value: 'sent' | 'cancelled') => void) | null = null;
  private previouslyFocused: HTMLElement | null = null;
  private step: 'form' | 'sent' = 'form';
  private submitting = false;
  private error: string | null = null;

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

  open(options: RouteShareDialogOptions): Promise<'sent' | 'cancelled'> {
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
    const email = this.shadowRoot?.querySelector<HTMLInputElement>('[data-cy="route-share-input-email"]')?.value.trim() ?? '';

    if (email.toLowerCase() === this.options.ownEmail.toLowerCase()) {
      this.error = 'No puedes compartir una ruta contigo mismo';
      this.render();
      return;
    }

    this.submitting = true;
    this.error = null;
    this.render();

    try {
      await createInvitation(this.options.apiBaseUrl, this.options.token, this.options.routeId, email);
      this.step = 'sent';
    } catch (err) {
      this.error = toErrorMessage(err, 'No se ha podido enviar la invitación');
    } finally {
      this.submitting = false;
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
    dialog.setAttribute('data-cy', 'route-share-dialog');

    const title = document.createElement('h2');
    title.className = 'title';
    title.textContent = 'Compartir ruta';
    dialog.appendChild(title);

    const message = document.createElement('p');
    message.className = 'message';
    message.textContent = 'Introduce el email de la cuenta con la que quieres compartir una copia de esta ruta.';
    dialog.appendChild(message);

    dialog.appendChild(this.buildEmailField());

    if (this.error) {
      const errorEl = document.createElement('p');
      errorEl.className = 'error';
      errorEl.setAttribute('data-cy', 'route-share-error');
      errorEl.textContent = this.error;
      dialog.appendChild(errorEl);
    }

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
    input.setAttribute('data-cy', 'route-share-input-email');
    field.appendChild(input);
    return field;
  }

  private buildFormActions(): HTMLElement {
    const actions = document.createElement('div');
    actions.className = 'actions';

    const confirmBtn = document.createElement('button');
    confirmBtn.type = 'button';
    confirmBtn.className = 'action action--primary';
    confirmBtn.setAttribute('data-cy', 'route-share-btn-confirmar');
    confirmBtn.textContent = this.submitting ? 'Enviando…' : 'Enviar invitación';
    confirmBtn.disabled = this.submitting;
    confirmBtn.addEventListener('click', () => { void this.handleSubmit(); });
    actions.appendChild(confirmBtn);

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'action';
    cancelBtn.setAttribute('data-cy', 'route-share-btn-cancelar');
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
    dialog.setAttribute('data-cy', 'route-share-dialog');

    const title = document.createElement('h2');
    title.className = 'title';
    title.textContent = 'Invitación enviada';
    dialog.appendChild(title);

    const message = document.createElement('p');
    message.className = 'message';
    message.textContent = 'Si la cuenta existe, verá la invitación la próxima vez que abra la app.';
    dialog.appendChild(message);

    const actions = document.createElement('div');
    actions.className = 'actions';
    const okBtn = document.createElement('button');
    okBtn.type = 'button';
    okBtn.className = 'action action--primary';
    okBtn.setAttribute('data-cy', 'route-share-btn-confirmar');
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

customElements.define('route-share-dialog', RouteShareDialogElement);

/** Abre un `<route-share-dialog>` montado en `document.body`. */
export function openRouteShareDialog(options: RouteShareDialogOptions): Promise<'sent' | 'cancelled'> {
  const el = document.createElement('route-share-dialog') as RouteShareDialogElement;
  document.body.appendChild(el);
  return el.open(options);
}
