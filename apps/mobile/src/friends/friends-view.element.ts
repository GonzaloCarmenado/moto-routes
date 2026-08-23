/**
 * Web Component `<friends-view>`: pantalla "Amigos", alcanzable desde el
 * punto de entrada nuevo en Perfil (`profile-friends-link.ts`) — mismo
 * patrón de pantalla-con-estado que `route-sharing.element.ts`/
 * `achievement-list.element.ts`. Tres pestañas (Amigos/Recibidas/Enviadas)
 * vía el `<tab-bar>` compartido, con un formulario de envío de solicitud
 * (por `username`) siempre visible por encima. El backend responde siempre
 * el mismo mensaje genérico exista o no la cuenta destino (anti-enumeración,
 * ver design.md D3) — este componente no lo distingue, solo muestra ese
 * mismo mensaje. La única validación hecha en cliente es "no puedes
 * enviarte una solicitud a ti mismo" (comparando contra el username de la
 * propia sesión, ya conocido por el usuario — no es una fuga de
 * información), mismo criterio que `route-share-dialog.element.ts`.
 */
import styles from './friends-view.element.css?inline';
import { BaseElement } from '../shared/base-element.js';
import { APP_EVENTS, dispatchAppEvent } from '../shared/app-events.js';
import { getApiBaseUrl } from '../shared/http/api-config.js';
import { buildBackButton } from '../shared/back-button.js';
import { toErrorMessage } from '../shared/utils/errors.js';
import { showToast } from '../shared/feedback/toast.js';
import { fetchCurrentUser } from '../auth/auth-api.service.js';
import type { ISessionRepository } from '../shared/models/session.repository.js';
import type { Session } from '../shared/models/session.types.js';
import type { Friend, ReceivedFriendRequest, SentFriendRequest } from '../shared/models/friends.types.js';
import {
  sendFriendRequest,
  listReceivedRequests,
  listSentRequests,
  listFriends,
  acceptFriendRequest,
  declineFriendRequest,
  revokeFriendRequest,
} from '../shared/http/friends-api.service.js';
import { buildActionButton, buildFriendsPanel, buildReceivedPanel, buildSentPanel } from './friends-panels.js';
import '../shared/tab-bar/tab-bar.element.js';
import type { TabBarTab } from '../shared/tab-bar/tab-bar.element.js';
import '../shared/friend-selector/friend-selector.element.js';
import { FRIEND_SELECTOR_SELECTED_EVENT, type FriendSelectorSelectedDetail } from '../shared/friend-selector/friend-selector.element.js';

type TabBarEl = HTMLElement & { tabs: TabBarTab[] };
type FriendSelectorEl = HTMLElement & { apiBaseUrl: string; token: string; excludeUsername: string | null };

class FriendsView extends BaseElement {
  private _sessionRepository: ISessionRepository | null = null;
  private _session: Session | null = null;
  private _ownUsername: string | null = null;
  private _friends: Friend[] = [];
  private _received: ReceivedFriendRequest[] = [];
  private _sent: SentFriendRequest[] = [];
  private _loading = false;
  private _busyId: string | null = null;
  private _sending = false;
  private _sendError: string | null = null;
  private _selectedUsername: string | null = null;
  private _fetchToken = 0;

  set sessionRepository(repo: ISessionRepository | null) {
    this._sessionRepository = repo;
    if (repo) void this.fetchAndRender();
  }

  get sessionRepository(): ISessionRepository | null {
    return this._sessionRepository;
  }

  private readonly onViewFriends = (): void => { void this.fetchAndRender(); };

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback(): void {
    window.addEventListener(APP_EVENTS.VIEW_FRIENDS, this.onViewFriends);
  }

  disconnectedCallback(): void {
    window.removeEventListener(APP_EVENTS.VIEW_FRIENDS, this.onViewFriends);
  }

  private async fetchAndRender(): Promise<void> {
    const token = ++this._fetchToken;
    this._session = (await this._sessionRepository?.get()) ?? null;
    if (token !== this._fetchToken) return;
    if (!this._session) {
      this._ownUsername = null;
      this._friends = [];
      this._received = [];
      this._sent = [];
      this.render();
      return;
    }

    this._loading = true;
    this.render();

    const apiBaseUrl = getApiBaseUrl();
    const [me, friendsList, received, sent] = await Promise.all([
      fetchCurrentUser(apiBaseUrl, this._session.token).catch(() => null),
      listFriends(apiBaseUrl, this._session.token).catch(() => []),
      listReceivedRequests(apiBaseUrl, this._session.token).catch(() => []),
      listSentRequests(apiBaseUrl, this._session.token).catch(() => []),
    ]);
    if (token !== this._fetchToken) return;
    this._ownUsername = me?.username ?? null;
    this._friends = friendsList;
    this._received = received;
    this._sent = sent;
    this._loading = false;
    this.render();
  }

  // No llama a this.render() aquí: el propio <friend-selector> ya se
  // re-renderiza a sí mismo tras emitir la selección (mostrando el username
  // elegido en su input como confirmación visual) — un render aquí lo
  // sustituiría por una instancia nueva y vacía en mitad de ese mismo ciclo
  // síncrono, perdiendo esa confirmación.
  private handleFriendSelected(detail: FriendSelectorSelectedDetail): void {
    this._selectedUsername = detail.username;
    this._sendError = null;
  }

  private async handleSend(): Promise<void> {
    if (!this._session || this._sending) return;
    const username = this._selectedUsername;
    if (!username) return;

    // Defensa en profundidad: el propio selector ya excluye la cuenta propia
    // de sus resultados (excludeUsername), pero este chequeo se mantiene por
    // si acaso llega igualmente (ver tasks.md 5.2).
    if (this._ownUsername && username.toLowerCase() === this._ownUsername.toLowerCase()) {
      this._sendError = 'No puedes enviarte una solicitud de amistad a ti mismo';
      this.render();
      return;
    }

    this._sending = true;
    this._sendError = null;
    this.render();

    try {
      await sendFriendRequest(getApiBaseUrl(), this._session.token, username);
      showToast('Si la cuenta existe, se le ha enviado la solicitud', 'success');
      this._selectedUsername = null;
      await this.fetchAndRender();
    } catch (err) {
      this._sendError = toErrorMessage(err, 'No se ha podido enviar la solicitud');
    } finally {
      this._sending = false;
      this.render();
    }
  }

  private async handleAccept(requestId: string): Promise<void> {
    if (!this._session || this._busyId) return;
    this._busyId = requestId;
    this.render();
    try {
      await acceptFriendRequest(getApiBaseUrl(), this._session.token, requestId);
      showToast('Solicitud aceptada', 'success');
      await this.fetchAndRender();
    } catch (err) {
      showToast(toErrorMessage(err, 'No se ha podido aceptar la solicitud'), 'error');
    } finally {
      this._busyId = null;
      this.render();
    }
  }

  private async handleDecline(requestId: string): Promise<void> {
    if (!this._session || this._busyId) return;
    this._busyId = requestId;
    this.render();
    try {
      await declineFriendRequest(getApiBaseUrl(), this._session.token, requestId);
      await this.fetchAndRender();
    } catch (err) {
      showToast(toErrorMessage(err, 'No se ha podido rechazar la solicitud'), 'error');
    } finally {
      this._busyId = null;
      this.render();
    }
  }

  private async handleRevoke(requestId: string): Promise<void> {
    if (!this._session || this._busyId) return;
    this._busyId = requestId;
    this.render();
    try {
      await revokeFriendRequest(getApiBaseUrl(), this._session.token, requestId);
      await this.fetchAndRender();
    } catch (err) {
      showToast(toErrorMessage(err, 'No se ha podido revocar la solicitud'), 'error');
    } finally {
      this._busyId = null;
      this.render();
    }
  }

  private buildSendForm(): HTMLElement {
    const form = document.createElement('div');
    form.className = 'send-form';

    const field = document.createElement('div');
    field.className = 'field';
    const label = document.createElement('label');
    label.className = 'field-label';
    label.textContent = 'Nombre de usuario';
    field.appendChild(label);
    const selector = document.createElement('friend-selector') as FriendSelectorEl;
    selector.apiBaseUrl = getApiBaseUrl();
    selector.token = this._session?.token ?? '';
    selector.excludeUsername = this._ownUsername;
    selector.addEventListener(FRIEND_SELECTOR_SELECTED_EVENT, (event) => {
      this.handleFriendSelected((event as CustomEvent<FriendSelectorSelectedDetail>).detail);
    });
    field.appendChild(selector);
    form.appendChild(field);

    if (this._sendError) {
      const errorEl = document.createElement('p');
      errorEl.className = 'error';
      errorEl.setAttribute('data-cy', 'friends-send-error');
      errorEl.textContent = this._sendError;
      form.appendChild(errorEl);
    }

    const sendBtn = buildActionButton({
      className: 'action action--primary', dataCy: 'friends-btn-enviar', label: this._sending ? 'Enviando…' : 'Enviar solicitud', disabled: this._sending,
      onClick: () => { void this.handleSend(); },
    });
    form.appendChild(sendBtn);

    return form;
  }

  private buildTabs(): TabBarEl {
    const tabBar = document.createElement('tab-bar') as TabBarEl;
    tabBar.tabs = [
      // Prefijo 'friends-' porque route-sharing.element.ts ya usa los ids
      // 'recibidas'/'enviadas' para su propio <tab-bar> — ambos componentes
      // están montados a la vez en app.element.ts (solo alternan
      // display:none), así que un id compartido produce dos elementos con
      // el mismo data-cy en el DOM (bug real encontrado en Cypress).
      { id: 'friends-amigos', label: 'Amigos' },
      { id: 'friends-recibidas', label: 'Recibidas' },
      { id: 'friends-enviadas', label: 'Enviadas' },
    ];
    tabBar.appendChild(buildFriendsPanel(this._friends));
    tabBar.appendChild(buildReceivedPanel(
      this._received,
      this._busyId,
      (id) => { void this.handleAccept(id); },
      (id) => { void this.handleDecline(id); },
    ));
    tabBar.appendChild(buildSentPanel(this._sent, this._busyId, (id) => { void this.handleRevoke(id); }));
    return tabBar;
  }

  protected render(): void {
    const screen = document.createElement('div');
    screen.setAttribute('data-cy', 'friends-view-screen');
    screen.appendChild(buildBackButton('friends-view-btn-volver', () => { dispatchAppEvent(APP_EVENTS.NAV_PERFIL); }));

    const title = document.createElement('h1');
    title.className = 'title';
    title.textContent = 'Amigos';
    screen.appendChild(title);

    if (this._session) screen.appendChild(this.buildSendForm());
    if (!this._loading) screen.appendChild(this.buildTabs());

    this.renderShadow(styles, screen);
  }
}

customElements.define('friends-view', FriendsView);
