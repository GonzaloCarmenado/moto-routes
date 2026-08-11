import styles from './nav-bar.element.css?inline';
import { BaseElement } from '../../shared/base-element.js';
import { APP_EVENTS, dispatchAppEvent } from '../../shared/app-events.js';
import { ROUTES_TAB_ICON, PROFILE_TAB_ICON } from '../../shared/icons/nav-icons.js';

/** Vista activa que `<nav-bar>` es capaz de representar visualmente. */
export type NavBarActiveView = 'cockpit' | 'routes' | 'profile';

/**
 * Mapa `data-cy` del botón → vista que representa, usado por
 * `updateActiveClasses()` para no repetir comparaciones ad-hoc por botón.
 */
const VIEW_BY_DATA_CY: Record<string, NavBarActiveView> = {
  'nav-grabar': 'cockpit',
  'nav-rutas': 'routes',
  'nav-perfil': 'profile',
};

class NavBar extends BaseElement {
  private _activeView: NavBarActiveView = 'cockpit';
  private navButtons: HTMLButtonElement[] = [];

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  /**
   * Vista actualmente activa, reflejada visualmente con `nav-item--active`
   * en el botón correspondiente (AC-036). Por defecto `'cockpit'`, para no
   * alterar el comportamiento visual inicial ya existente (Grabar activo).
   */
  set activeView(view: NavBarActiveView) {
    this._activeView = view;
    this.updateActiveClasses();
  }

  get activeView(): NavBarActiveView {
    return this._activeView;
  }

  connectedCallback(): void {
    this.render();
  }
  private handleGrabarClick(): void {
    dispatchAppEvent(APP_EVENTS.NAV_GRABAR);
  }

  private handleRutasClick(): void {
    dispatchAppEvent(APP_EVENTS.NAV_RUTAS);
  }

  private handlePerfilClick(): void {
    dispatchAppEvent(APP_EVENTS.NAV_PERFIL);
  }

  private buildRutasBtn(): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.className = 'nav-item';
    btn.setAttribute('data-cy', 'nav-rutas');
    btn.innerHTML = this.buildListIcon() + '<span class="nav-label">Rutas</span>';
    btn.addEventListener('click', () => { this.handleRutasClick(); });
    return btn;
  }

  private buildGrabarBtn(): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.className = 'nav-item nav-item--record';
    btn.setAttribute('data-cy', 'nav-grabar');
    btn.setAttribute('aria-label', 'Ir a grabar ruta');
    btn.innerHTML = '<span class="record-dot"></span><span class="nav-label">Grabar</span>';
    btn.addEventListener('click', () => { this.handleGrabarClick(); });
    return btn;
  }

  private buildPerfilBtn(): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.className = 'nav-item';
    btn.setAttribute('data-cy', 'nav-perfil');
    btn.innerHTML = this.buildProfileIcon() + '<span class="nav-label">Perfil</span>';
    btn.addEventListener('click', () => { this.handlePerfilClick(); });
    return btn;
  }

  protected render(): void {
    const nav = document.createElement('nav');
    nav.className = 'bottom-nav';
    this.navButtons = [this.buildRutasBtn(), this.buildGrabarBtn(), this.buildPerfilBtn()];
    for (const btn of this.navButtons) nav.appendChild(btn);

    this.renderShadow(styles, nav);
    this.updateActiveClasses();
  }

  /** Quita `nav-item--active` de los tres botones y la añade solo al que corresponde a `activeView` (AC-036). */
  private updateActiveClasses(): void {
    for (const btn of this.navButtons) {
      const dataCy = btn.getAttribute('data-cy') ?? '';
      const isActive = VIEW_BY_DATA_CY[dataCy] === this._activeView;
      btn.classList.toggle('nav-item--active', isActive);
    }
  }

  private buildListIcon(): string {
    return `<span class="nav-icon">${ROUTES_TAB_ICON}</span>`;
  }

  private buildProfileIcon(): string {
    return `<span class="nav-icon">${PROFILE_TAB_ICON}</span>`;
  }
}

customElements.define('nav-bar', NavBar);