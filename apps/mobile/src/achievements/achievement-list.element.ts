/**
 * Web Component `<achievement-list>`: pantalla "Mis logros", accesible
 * desde la cuenta del usuario (perfil) — logros conseguidos (con fecha) y
 * pendientes (con progreso actual). Mismo patrón de pantalla-con-estado que
 * `route-sharing.element.ts`. Sin sesión no realiza ninguna petición (ver
 * spec "Sin sesión activa" de sistema-logros).
 */
import styles from './achievement-list.element.css?inline';
import { BaseElement } from '../shared/base-element.js';
import { APP_EVENTS, dispatchAppEvent } from '../shared/app-events.js';
import { getApiBaseUrl } from '../shared/http/api-config.js';
import { buildBackButton } from '../shared/back-button.js';
import { formatRouteDate } from '../shared/utils/date.js';
import { fetchAchievements } from '../shared/http/achievement-api.service.js';
import { formatAchievementProgress } from './achievement-list.transform.js';
import { ACHIEVEMENT_PLACEHOLDER_ICON } from '../shared/icons/achievement-icons.js';
import type { ISessionRepository } from '../shared/models/session.repository.js';
import type { Session } from '../shared/models/session.types.js';
import type { AchievementProgress } from '../shared/models/achievement.types.js';

class AchievementList extends BaseElement {
  private _sessionRepository: ISessionRepository | null = null;
  private _session: Session | null = null;
  private _progress: AchievementProgress[] = [];
  private _loading = false;
  private _fetchToken = 0;

  set sessionRepository(repo: ISessionRepository | null) {
    this._sessionRepository = repo;
    if (repo) void this.fetchAndRender();
  }

  get sessionRepository(): ISessionRepository | null {
    return this._sessionRepository;
  }

  // Mismo motivo que route-sharing.element.ts: sin refresco al reabrir la
  // pantalla, se quedaría con el estado (sin sesión) capturado al arrancar.
  private readonly onViewAchievements = (): void => { void this.fetchAndRender(); };

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback(): void {
    window.addEventListener(APP_EVENTS.VIEW_ACHIEVEMENTS, this.onViewAchievements);
  }

  disconnectedCallback(): void {
    window.removeEventListener(APP_EVENTS.VIEW_ACHIEVEMENTS, this.onViewAchievements);
  }

  private async fetchAndRender(): Promise<void> {
    const token = ++this._fetchToken;
    this._session = (await this._sessionRepository?.get()) ?? null;
    if (token !== this._fetchToken) return;
    if (!this._session) {
      this._progress = [];
      this.render();
      return;
    }

    this._loading = true;
    this.render();

    const progress = await fetchAchievements(getApiBaseUrl(), this._session.token).catch(() => []);
    if (token !== this._fetchToken) return;
    this._progress = progress;
    this._loading = false;
    this.render();
  }

  private buildLoginRequired(): HTMLElement {
    const el = document.createElement('p');
    el.className = 'login-required';
    el.setAttribute('data-cy', 'achievement-list-login-required');
    el.textContent = 'Inicia sesión para ver tus logros';
    return el;
  }

  private buildCardStatus(progress: AchievementProgress): HTMLElement {
    const status = document.createElement('p');
    status.className = 'card-status';
    status.setAttribute('data-cy', 'achievement-list-status');
    status.textContent = progress.achievedAt
      ? `Conseguido el ${formatRouteDate(progress.achievedAt)}`
      : formatAchievementProgress(progress);
    return status;
  }

  private buildCard(progress: AchievementProgress): HTMLElement {
    const achieved = progress.achievedAt !== null;
    const card = document.createElement('div');
    card.className = `card ${achieved ? 'card--achieved' : 'card--pending'}`;
    card.setAttribute('data-cy', achieved ? 'achievement-list-card-conseguido' : 'achievement-list-card-pendiente');

    const icon = document.createElement('div');
    icon.className = 'card-icon';
    icon.innerHTML = ACHIEVEMENT_PLACEHOLDER_ICON;
    card.appendChild(icon);

    const body = document.createElement('div');
    body.className = 'card-body';
    const title = document.createElement('p');
    title.className = 'card-title';
    title.textContent = progress.achievement.title;
    const description = document.createElement('p');
    description.className = 'card-description';
    description.textContent = progress.achievement.description;
    body.append(title, description, this.buildCardStatus(progress));
    card.appendChild(body);

    return card;
  }

  private buildSection(title: string, items: AchievementProgress[], emptyText: string, emptyDataCy: string): HTMLElement {
    const section = document.createElement('div');
    section.className = 'section';

    const heading = document.createElement('h2');
    heading.className = 'section-title';
    heading.textContent = title;
    section.appendChild(heading);

    if (items.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'empty';
      empty.setAttribute('data-cy', emptyDataCy);
      empty.textContent = emptyText;
      section.appendChild(empty);
      return section;
    }

    for (const item of items) {
      section.appendChild(this.buildCard(item));
    }
    return section;
  }

  private buildSections(): HTMLElement[] {
    const achieved = this._progress.filter((p) => p.achievedAt !== null);
    const pending = this._progress.filter((p) => p.achievedAt === null);
    return [
      this.buildSection('Conseguidos', achieved, 'Todavía no has conseguido ningún logro', 'achievement-list-empty-conseguidos'),
      this.buildSection('Pendientes', pending, 'No hay logros pendientes', 'achievement-list-empty-pendientes'),
    ];
  }

  protected render(): void {
    const screen = document.createElement('div');
    screen.setAttribute('data-cy', 'achievement-list-screen');
    screen.appendChild(buildBackButton('achievement-list-btn-volver', () => { dispatchAppEvent(APP_EVENTS.NAV_PERFIL); }));

    const title = document.createElement('h1');
    title.className = 'title';
    title.textContent = 'Mis logros';
    screen.appendChild(title);

    if (!this._session) {
      screen.appendChild(this.buildLoginRequired());
    } else if (!this._loading) {
      screen.append(...this.buildSections());
    }

    this.renderShadow(styles, screen);
  }
}

customElements.define('achievement-list', AchievementList);
