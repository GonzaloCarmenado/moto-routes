/**
 * Web Component `<username-edit-dialog>`: envuelve `<username-form>`
 * (Grupo 5, componente compartido) con overlay, título y botón "Cancelar" —
 * el formulario en sí nunca incluye cancelar por diseño (ver
 * `username-form.element.ts`), así que lo añade este contenedor
 * descartable, usado desde Perfil para editar un username ya fijado o
 * fijar uno por primera vez (ver nombre-usuario, design.md Decisión 5).
 */
import { BaseElement } from '../shared/base-element.js';
import { USERNAME_FORM_SUCCESS_EVENT, type UsernameFormSuccessDetail } from './username-form.types.js';
import './username-form.element.js';
import styles from './username-edit-dialog.element.css?inline';

export interface UsernameEditDialogOptions {
  apiBaseUrl: string;
  token: string;
  currentUsername: string | null;
}

export type UsernameEditDialogResult = { action: 'saved'; username: string } | { action: 'cancelled' };

class UsernameEditDialogElement extends BaseElement {
  private options: UsernameEditDialogOptions | null = null;
  private onResolve: ((value: UsernameEditDialogResult) => void) | null = null;
  private previouslyFocused: HTMLElement | null = null;

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') this.close({ action: 'cancelled' });
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

  open(options: UsernameEditDialogOptions): Promise<UsernameEditDialogResult> {
    this.options = options;
    this.previouslyFocused = document.activeElement as HTMLElement | null;
    this.render();
    return new Promise((resolve) => { this.onResolve = resolve; });
  }

  private close(result: UsernameEditDialogResult): void {
    this.onResolve?.(result);
    this.onResolve = null;
    this.previouslyFocused?.focus();
    this.remove();
  }

  private buildOverlay(): HTMLElement {
    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    overlay.addEventListener('click', () => { this.close({ action: 'cancelled' }); });
    return overlay;
  }

  private buildDialog(options: UsernameEditDialogOptions): HTMLElement {
    const dialog = document.createElement('div');
    dialog.className = 'dialog';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('data-cy', 'username-edit-dialog');

    const title = document.createElement('h2');
    title.className = 'title';
    title.textContent = options.currentUsername ? 'Editar nombre de usuario' : 'Elige tu nombre de usuario';
    dialog.appendChild(title);

    dialog.appendChild(this.buildForm(options));
    dialog.appendChild(this.buildCancelAction());
    return dialog;
  }

  private buildForm(options: UsernameEditDialogOptions): HTMLElement {
    const form = document.createElement('username-form') as HTMLElement & {
      apiBaseUrl: string;
      token: string;
      currentUsername: string | null;
    };
    form.apiBaseUrl = options.apiBaseUrl;
    form.token = options.token;
    form.currentUsername = options.currentUsername;
    form.addEventListener(USERNAME_FORM_SUCCESS_EVENT, ((event: CustomEvent<UsernameFormSuccessDetail>) => {
      this.close({ action: 'saved', username: event.detail.username });
    }) as EventListener);
    return form;
  }

  private buildCancelAction(): HTMLElement {
    const actions = document.createElement('div');
    actions.className = 'actions';

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'action';
    cancelBtn.setAttribute('data-cy', 'username-edit-dialog-btn-cancelar');
    cancelBtn.textContent = 'Cancelar';
    cancelBtn.addEventListener('click', () => { this.close({ action: 'cancelled' }); });
    actions.appendChild(cancelBtn);

    return actions;
  }

  protected render(): void {
    if (!this.options) return;
    this.renderShadow(styles, this.buildOverlay(), this.buildDialog(this.options));
  }
}

customElements.define('username-edit-dialog', UsernameEditDialogElement);

/** Abre un `<username-edit-dialog>` montado en `document.body`. */
export function openUsernameEditDialog(options: UsernameEditDialogOptions): Promise<UsernameEditDialogResult> {
  const el = document.createElement('username-edit-dialog') as UsernameEditDialogElement;
  document.body.appendChild(el);
  return el.open(options);
}
