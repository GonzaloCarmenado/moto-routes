/**
 * Web Component `<friend-selector>`: autocomplete de búsqueda de usernames
 * con avatar, reutilizable en cualquier punto donde la app necesite que se
 * elija otra cuenta (enviar una solicitud de amistad, invitar a compartir
 * una ruta) — ver selector-amigos, design.md. Componente compartido (vive en
 * `shared/`) consumido por `friends/` y `routes/detail/`, dos dominios
 * distintos, así que su contrato de props/eventos se mantiene simple y
 * estable (design.md, Riesgos).
 */
import styles from './friend-selector.element.css?inline';
import { BaseElement } from '../base-element.js';
import { buildAvatarPlaceholder } from '../icons/avatar-placeholder-icon.js';
import { searchUsers } from '../http/user-search-api.service.js';
import { resolveUserAvatarUrl } from '../http/avatar-api.service.js';
import { toErrorMessage } from '../utils/errors.js';

/** Evento emitido al seleccionar un resultado — `detail.username` es la cuenta elegida. */
export const FRIEND_SELECTOR_SELECTED_EVENT = 'friend-selector-selected';

/** `detail` de `FRIEND_SELECTOR_SELECTED_EVENT`. */
export interface FriendSelectorSelectedDetail {
  username: string;
}

/** Debounce tras la última pulsación antes de disparar la búsqueda (design.md). */
const SEARCH_DEBOUNCE_MS = 300;

/** Longitud mínima en cliente antes de buscar — el servidor igualmente acota aunque llegue menos (design.md). */
const MIN_QUERY_LENGTH = 2;

class FriendSelector extends BaseElement {
  private _apiBaseUrl = '';
  private _token = '';
  private _excludeUsername: string | null = null;
  private _query = '';
  private _results: string[] = [];
  private _avatarUrls: Record<string, string | null> = {};
  private _searched = false;
  private _error: string | null = null;
  private _debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private _searchToken = 0;
  private _inputEl: HTMLInputElement | null = null;

  set apiBaseUrl(value: string) {
    this._apiBaseUrl = value;
  }

  get apiBaseUrl(): string {
    return this._apiBaseUrl;
  }

  set token(value: string) {
    this._token = value;
  }

  get token(): string {
    return this._token;
  }

  set excludeUsername(value: string | null) {
    this._excludeUsername = value;
  }

  get excludeUsername(): string | null {
    return this._excludeUsername;
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback(): void {
    this.render();
  }

  disconnectedCallback(): void {
    if (this._debounceTimer) clearTimeout(this._debounceTimer);
  }

  private handleInput(value: string): void {
    this._query = value;
    if (this._debounceTimer) clearTimeout(this._debounceTimer);

    const trimmed = value.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) {
      this._results = [];
      this._avatarUrls = {};
      this._searched = false;
      this._error = null;
      this.updateResultsSection();
      return;
    }

    this._debounceTimer = setTimeout(() => {
      void this.search(trimmed);
    }, SEARCH_DEBOUNCE_MS);
  }

  private async search(query: string): Promise<void> {
    const token = ++this._searchToken;
    this._error = null;
    try {
      const results = await searchUsers(this._apiBaseUrl, this._token, query);
      if (token !== this._searchToken) return;
      this._results = results.filter((username) => username.toLowerCase() !== this._excludeUsername?.toLowerCase());
      this._avatarUrls = {};
      this._searched = true;
      this.updateResultsSection();
      this.resolveAvatars(token, this._results);
    } catch (err) {
      if (token !== this._searchToken) return;
      this._results = [];
      this._searched = true;
      this._error = toErrorMessage(err, 'No se ha podido completar la búsqueda');
      this.updateResultsSection();
    }
  }

  private resolveAvatars(token: number, usernames: string[]): void {
    for (const username of usernames) {
      resolveUserAvatarUrl(this._apiBaseUrl, this._token, username)
        .then((url) => {
          if (token !== this._searchToken) return;
          this._avatarUrls = { ...this._avatarUrls, [username]: url };
          this.updateResultsSection();
        })
        .catch(() => {
          // Fallo al resolver un avatar concreto: se queda con el icono
          // placeholder, sin bloquear el resto de resultados ya mostrados.
        });
    }
  }

  private selectResult(username: string): void {
    this.emit<FriendSelectorSelectedDetail>(FRIEND_SELECTOR_SELECTED_EVENT, { username });
    this._query = username;
    this._results = [];
    this._avatarUrls = {};
    this._searched = false;
    if (this._inputEl) this._inputEl.value = username;
    this.updateResultsSection();
  }

  protected render(): void {
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'input';
    input.setAttribute('data-cy', 'friend-selector-input');
    input.value = this._query;
    input.placeholder = 'Buscar por nombre de usuario';
    input.setAttribute('autocapitalize', 'none');
    input.setAttribute('autocorrect', 'off');
    input.spellcheck = false;
    // Transforma en vivo, mismo criterio que username-form.element.ts (bug
    // real ya conocido en este proyecto): el username es siempre en
    // minúsculas (usernamePattern del backend), así que el usuario nunca
    // debería tener que darse cuenta de que las mayúsculas no aportan nada —
    // aquí además el teclado de Android capitaliza la primera letra por
    // defecto pese a autocapitalize="none" en algunos dispositivos, así que
    // la búsqueda ya era case-insensitive en el servidor (`ILIKE`) pero el
    // campo debía reflejarlo también.
    input.addEventListener('input', () => {
      const lower = input.value.toLowerCase();
      if (input.value !== lower) input.value = lower;
      this.handleInput(input.value);
    });
    this._inputEl = input;

    this.renderShadow(styles, input, this.buildResultsSection());
  }

  /**
   * Sustituye solo la sección de resultados (lista, vacío o error), sin
   * tocar el `<input>` — un `render()` completo lo destruiría y recrearía en
   * cada tecla, perdiendo el foco y cerrando el teclado en Android (mismo
   * gap ya documentado y resuelto en `route-list.element.ts::updateBodyOnly`,
   * bug real encontrado verificando en dispositivo, no en Vitest/Cypress:
   * ninguno de los dos detecta pérdida de foco al reconstruir el DOM).
   */
  private updateResultsSection(): void {
    const root = this.shadowRoot;
    if (!root) return;
    const old = root.querySelector('.results-section');
    const next = this.buildResultsSection();
    if (old) old.replaceWith(next);
    else root.appendChild(next);
  }

  private buildResultsSection(): HTMLElement {
    const section = document.createElement('div');
    section.className = 'results-section';

    if (this._results.length > 0) {
      section.appendChild(this.buildResultsList());
    } else if (this._error) {
      const errorEl = document.createElement('p');
      errorEl.className = 'error';
      errorEl.setAttribute('data-cy', 'friend-selector-error');
      errorEl.textContent = this._error;
      section.appendChild(errorEl);
    } else if (this._searched) {
      const emptyEl = document.createElement('p');
      emptyEl.className = 'empty';
      emptyEl.setAttribute('data-cy', 'friend-selector-empty');
      emptyEl.textContent = 'Sin resultados';
      section.appendChild(emptyEl);
    }

    return section;
  }

  private buildResultsList(): HTMLUListElement {
    const list = document.createElement('ul');
    list.className = 'results';

    for (const username of this._results) {
      const item = document.createElement('li');
      item.appendChild(this.buildResultButton(username));
      list.appendChild(item);
    }

    return list;
  }

  private buildResultButton(username: string): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'result';
    button.setAttribute('data-cy', 'friend-selector-result');
    button.addEventListener('click', () => { this.selectResult(username); });
    button.appendChild(this.buildResultAvatar(username));

    const usernameEl = document.createElement('span');
    usernameEl.className = 'result-username';
    usernameEl.textContent = username;
    button.appendChild(usernameEl);

    return button;
  }

  private buildResultAvatar(username: string): HTMLImageElement | SVGSVGElement {
    const avatarUrl = this._avatarUrls[username];
    if (!avatarUrl) {
      const placeholder = buildAvatarPlaceholder();
      placeholder.classList.add('result-avatar-placeholder');
      return placeholder;
    }

    const img = document.createElement('img');
    img.className = 'result-avatar';
    img.src = avatarUrl;
    img.alt = '';
    return img;
  }
}

customElements.define('friend-selector', FriendSelector);
