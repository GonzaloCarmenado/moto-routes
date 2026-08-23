/**
 * Web Component `<route-share-dialog>`: modal "Compartir ruta" — selector de
 * cuenta por username (`<friend-selector>`, ver selector-amigos),
 * `POST /api/route-shares`. El backend responde siempre el mismo mensaje
 * genérico exista o no la cuenta (anti-enumeración, ver design.md D2 de
 * `compartir-ruta`) — este diálogo no distingue nada, solo muestra ese mismo
 * mensaje. La validación "no puedes compartir contigo mismo" se hace en
 * cliente por partida doble: el propio `<friend-selector>` ya excluye la
 * cuenta propia de sus resultados (`excludeUsername`), y `handleSubmit`
 * repite la comprobación como defensa en profundidad — mismo criterio que
 * `friends-view.element.ts`.
 */
import { BaseElement } from '../../shared/base-element.js';
import { createInvitation } from '../../shared/http/route-sharing-api.service.js';
import { fetchCurrentUser } from '../../auth/auth-api.service.js';
import { toErrorMessage } from '../../shared/utils/errors.js';
import '../../shared/friend-selector/friend-selector.element.js';
import { FRIEND_SELECTOR_SELECTED_EVENT, type FriendSelectorSelectedDetail } from '../../shared/friend-selector/friend-selector.element.js';
import styles from './route-share-dialog.element.css?inline';

type FriendSelectorEl = HTMLElement & { apiBaseUrl: string; token: string; excludeUsername: string | null };

export interface RouteShareDialogOptions {
  apiBaseUrl: string;
  token: string;
  routeId: string;
}

class RouteShareDialogElement extends BaseElement {
  private options: RouteShareDialogOptions | null = null;
  private onResolve: ((value: 'sent' | 'cancelled') => void) | null = null;
  private previouslyFocused: HTMLElement | null = null;
  private step: 'form' | 'sent' = 'form';
  private submitting = false;
  private error: string | null = null;
  private ownUsername: string | null = null;
  private selectedUsername: string | null = null;
  private selectorEl: FriendSelectorEl | null = null;

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
    this.selectorEl?.shadowRoot?.querySelector<HTMLInputElement>('[data-cy="friend-selector-input"]')?.focus();
    this.resolveOwnUsername(options);
    return new Promise((resolve) => { this.onResolve = resolve; });
  }

  /**
   * Resuelve el username propio en segundo plano, sin bloquear el primer
   * render ni destruir el `<friend-selector>` ya montado (a diferencia de
   * `this.render()`, que lo sustituiría por uno nuevo vacío en mitad de una
   * búsqueda — mismo motivo documentado en `friends-view.element.ts`).
   */
  private resolveOwnUsername(options: RouteShareDialogOptions): void {
    fetchCurrentUser(options.apiBaseUrl, options.token)
      .then((user) => {
        this.ownUsername = user.username;
        if (this.selectorEl) this.selectorEl.excludeUsername = this.ownUsername;
      })
      .catch(() => {
        // Sin username propio disponible, el selector simplemente no excluye
        // ninguna cuenta — la defensa en profundidad de handleSubmit sigue
        // aplicando en cuanto se resuelva.
      });
  }

  private close(result: 'sent' | 'cancelled'): void {
    this.onResolve?.(result);
    this.onResolve = null;
    this.previouslyFocused?.focus();
    this.remove();
  }

  private handleFriendSelected(detail: FriendSelectorSelectedDetail): void {
    this.selectedUsername = detail.username;
    this.error = null;
  }

  private async handleSubmit(): Promise<void> {
    if (!this.options || this.submitting) return;
    const username = this.selectedUsername;
    if (!username) return;

    if (this.ownUsername && username.toLowerCase() === this.ownUsername.toLowerCase()) {
      this.error = 'No puedes compartir una ruta contigo mismo';
      this.render();
      return;
    }

    this.submitting = true;
    this.error = null;
    this.render();

    try {
      await createInvitation(this.options.apiBaseUrl, this.options.token, this.options.routeId, username);
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
    message.textContent = 'Busca el nombre de usuario de la cuenta con la que quieres compartir una copia de esta ruta.';
    dialog.appendChild(message);

    dialog.appendChild(this.buildUsernameField());

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

  private buildUsernameField(): HTMLElement {
    const field = document.createElement('div');
    field.className = 'field';
    const label = document.createElement('label');
    label.className = 'field-label';
    label.textContent = 'Nombre de usuario';
    field.appendChild(label);

    const selector = document.createElement('friend-selector') as FriendSelectorEl;
    selector.apiBaseUrl = this.options?.apiBaseUrl ?? '';
    selector.token = this.options?.token ?? '';
    selector.excludeUsername = this.ownUsername;
    selector.addEventListener(FRIEND_SELECTOR_SELECTED_EVENT, (event) => {
      this.handleFriendSelected((event as CustomEvent<FriendSelectorSelectedDetail>).detail);
    });
    this.selectorEl = selector;
    field.appendChild(selector);

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
    this.selectorEl = null;
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
