/**
 * Web Component `<route-sharing>`: pantalla de invitaciones de compartir
 * ruta, alcanzable desde el icono nuevo en la cabecera de `route-list`
 * (design.md D7 de `compartir-ruta`). Dos pestañas (Recibidas/Enviadas) vía
 * el `<tab-bar>` compartido — mismo patrón que `route-detail.element.ts`.
 * Al aceptar una invitación, la ruta clonada aparece en el listado a través
 * del mecanismo ya existente de `route-cloud-sync` ("ruta exclusiva de la
 * nube") — este componente no necesita empujar nada, solo volver a la lista
 * (que ya refresca al navegar, ver `route-list.element.ts::onNavRutas`).
 */
import styles from './route-sharing.element.css?inline';
import { BaseElement } from '../../shared/base-element.js';
import { APP_EVENTS, dispatchAppEvent } from '../../shared/app-events.js';
import { getApiBaseUrl } from '../../shared/http/api-config.js';
import { buildBackButton } from '../../shared/back-button.js';
import { formatRouteDate } from '../../shared/utils/date.js';
import { toErrorMessage } from '../../shared/utils/errors.js';
import { showToast } from '../../shared/feedback/toast.js';
import type { ISessionRepository } from '../../shared/models/session.repository.js';
import type { Session } from '../../shared/models/session.types.js';
import type { ReceivedRouteShareInvitation, SentRouteShareInvitation } from '../../shared/models/route-sharing.types.js';
import {
  fetchReceivedInvitations,
  fetchSentInvitations,
  acceptInvitation,
  declineInvitation,
  revokeInvitation,
} from '../../shared/http/route-sharing-api.service.js';
import '../../shared/tab-bar/tab-bar.element.js';
import type { TabBarTab } from '../../shared/tab-bar/tab-bar.element.js';

type TabBarEl = HTMLElement & { tabs: TabBarTab[] };

/** Cabecera común de una tarjeta de invitación (nombre de ruta + línea de metadato). */
function buildCardShell(dataCy: string, name: string, meta: string): HTMLElement {
  const card = document.createElement('div');
  card.className = 'card';
  card.setAttribute('data-cy', dataCy);

  const nameEl = document.createElement('p');
  nameEl.className = 'card-name';
  nameEl.textContent = name;
  card.appendChild(nameEl);

  const metaEl = document.createElement('p');
  metaEl.className = 'card-meta';
  metaEl.textContent = meta;
  card.appendChild(metaEl);

  return card;
}

interface ActionButtonOptions {
  className: string;
  dataCy: string;
  label: string;
  disabled: boolean;
  onClick: () => void;
}

/** Botón de acción de una tarjeta de invitación (aceptar/rechazar/revocar). */
function buildActionButton(options: ActionButtonOptions): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = options.className;
  btn.setAttribute('data-cy', options.dataCy);
  btn.textContent = options.label;
  btn.disabled = options.disabled;
  btn.addEventListener('click', options.onClick);
  return btn;
}

class RouteSharing extends BaseElement {
  private _sessionRepository: ISessionRepository | null = null;
  private _session: Session | null = null;
  private _received: ReceivedRouteShareInvitation[] = [];
  private _sent: SentRouteShareInvitation[] = [];
  private _loading = false;
  private _busyId: string | null = null;

  set sessionRepository(repo: ISessionRepository | null) {
    this._sessionRepository = repo;
    if (repo) void this.fetchAndRender();
  }

  get sessionRepository(): ISessionRepository | null {
    return this._sessionRepository;
  }

  private readonly onViewSharing = (): void => { void this.fetchAndRender(); };

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback(): void {
    // Sin esto, el componente solo cargaba datos una vez (al arrancar la
    // app, momento en el que normalmente no hay sesión todavía) y nunca se
    // refrescaba al volver a abrir esta pantalla ya con sesión activa —
    // mismo patrón ya usado por route-list.element.ts para NAV_RUTAS.
    window.addEventListener(APP_EVENTS.VIEW_SHARING, this.onViewSharing);
  }

  disconnectedCallback(): void {
    window.removeEventListener(APP_EVENTS.VIEW_SHARING, this.onViewSharing);
  }

  /** Ver el comentario del mismo mecanismo en `route-list.element.ts::fetchAndRender` — `fetchAndRender` aquí también puede solaparse (setter de `sessionRepository` + evento `view-sharing`). */
  private _fetchToken = 0;

  private async fetchAndRender(): Promise<void> {
    const token = ++this._fetchToken;
    this._session = (await this._sessionRepository?.get()) ?? null;
    if (token !== this._fetchToken) return;
    if (!this._session) {
      this._received = [];
      this._sent = [];
      this.render();
      return;
    }

    this._loading = true;
    this.render();

    const apiBaseUrl = getApiBaseUrl();
    const [received, sent] = await Promise.all([
      fetchReceivedInvitations(apiBaseUrl, this._session.token).catch(() => []),
      fetchSentInvitations(apiBaseUrl, this._session.token).catch(() => []),
    ]);
    if (token !== this._fetchToken) return;
    this._received = received;
    this._sent = sent;
    this._loading = false;
    this.render();
  }

  private async handleAccept(invitationId: string): Promise<void> {
    if (!this._session || this._busyId) return;
    this._busyId = invitationId;
    this.render();
    try {
      await acceptInvitation(getApiBaseUrl(), this._session.token, invitationId);
      showToast('Ruta añadida a tu cuenta', 'success');
      await this.fetchAndRender();
    } catch (err) {
      showToast(toErrorMessage(err, 'No se ha podido aceptar la invitación'), 'error');
    } finally {
      this._busyId = null;
      this.render();
    }
  }

  private async handleDecline(invitationId: string): Promise<void> {
    if (!this._session || this._busyId) return;
    this._busyId = invitationId;
    this.render();
    try {
      await declineInvitation(getApiBaseUrl(), this._session.token, invitationId);
      await this.fetchAndRender();
    } catch (err) {
      showToast(toErrorMessage(err, 'No se ha podido rechazar la invitación'), 'error');
    } finally {
      this._busyId = null;
      this.render();
    }
  }

  private async handleRevoke(invitationId: string): Promise<void> {
    if (!this._session || this._busyId) return;
    this._busyId = invitationId;
    this.render();
    try {
      await revokeInvitation(getApiBaseUrl(), this._session.token, invitationId);
      await this.fetchAndRender();
    } catch (err) {
      showToast(toErrorMessage(err, 'No se ha podido revocar la invitación'), 'error');
    } finally {
      this._busyId = null;
      this.render();
    }
  }

  private buildReceivedPanel(): HTMLElement {
    const panel = document.createElement('div');
    panel.className = 'panel';
    panel.slot = 'recibidas';

    if (this._received.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'empty';
      empty.setAttribute('data-cy', 'route-sharing-empty-recibidas');
      empty.textContent = 'No tienes invitaciones pendientes';
      panel.appendChild(empty);
      return panel;
    }

    for (const inv of this._received) {
      panel.appendChild(this.buildReceivedCard(inv));
    }
    return panel;
  }

  private buildReceivedCard(inv: ReceivedRouteShareInvitation): HTMLElement {
    const card = buildCardShell('route-sharing-card-recibida', inv.routeName ?? formatRouteDate(inv.routeCreatedAt), `Compartida por ${inv.fromEmail}`);
    const busy = this._busyId === inv.id;

    const actions = document.createElement('div');
    actions.className = 'card-actions';
    actions.appendChild(buildActionButton({
      className: 'action action--primary', dataCy: 'route-sharing-btn-aceptar', label: 'Aceptar', disabled: busy,
      onClick: () => { void this.handleAccept(inv.id); },
    }));
    actions.appendChild(buildActionButton({
      className: 'action', dataCy: 'route-sharing-btn-rechazar', label: 'Rechazar', disabled: busy,
      onClick: () => { void this.handleDecline(inv.id); },
    }));
    card.appendChild(actions);
    return card;
  }

  private buildSentPanel(): HTMLElement {
    const panel = document.createElement('div');
    panel.className = 'panel';
    panel.slot = 'enviadas';

    if (this._sent.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'empty';
      empty.setAttribute('data-cy', 'route-sharing-empty-enviadas');
      empty.textContent = 'No has compartido ninguna ruta todavía';
      panel.appendChild(empty);
      return panel;
    }

    for (const inv of this._sent) {
      panel.appendChild(this.buildSentCard(inv));
    }
    return panel;
  }

  private buildSentCard(inv: SentRouteShareInvitation): HTMLElement {
    const card = buildCardShell('route-sharing-card-enviada', inv.routeName ?? formatRouteDate(inv.routeCreatedAt), `Para ${inv.toEmail}`);

    const status = document.createElement('p');
    status.className = `card-status card-status--${inv.status}`;
    status.setAttribute('data-cy', 'route-sharing-status');
    status.textContent = STATUS_LABEL[inv.status];
    card.appendChild(status);

    if (inv.status === 'pending') {
      const actions = document.createElement('div');
      actions.className = 'card-actions';
      actions.appendChild(buildActionButton({
        className: 'action action--danger', dataCy: 'route-sharing-btn-revocar', label: 'Revocar', disabled: this._busyId === inv.id,
        onClick: () => { void this.handleRevoke(inv.id); },
      }));
      card.appendChild(actions);
    }

    return card;
  }

  private buildTabs(): TabBarEl {
    const tabBar = document.createElement('tab-bar') as TabBarEl;
    tabBar.tabs = [
      { id: 'recibidas', label: 'Recibidas' },
      { id: 'enviadas', label: 'Enviadas' },
    ];
    tabBar.appendChild(this.buildReceivedPanel());
    tabBar.appendChild(this.buildSentPanel());
    return tabBar;
  }

  protected render(): void {
    const screen = document.createElement('div');
    screen.setAttribute('data-cy', 'route-sharing-screen');
    screen.appendChild(buildBackButton('route-sharing-btn-volver', () => { dispatchAppEvent(APP_EVENTS.NAV_RUTAS); }));

    const title = document.createElement('h1');
    title.className = 'title';
    title.textContent = 'Invitaciones';
    screen.appendChild(title);

    if (!this._loading) screen.appendChild(this.buildTabs());

    this.renderShadow(styles, screen);
  }
}

const STATUS_LABEL: Record<SentRouteShareInvitation['status'], string> = {
  pending: 'Pendiente',
  accepted: 'Aceptada',
  declined: 'Rechazada',
  revoked: 'Revocada',
};

customElements.define('route-sharing', RouteSharing);
