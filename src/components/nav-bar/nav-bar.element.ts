import styles from './nav-bar.element.css?inline';
import { BaseElement } from '../../shared/base-element.js';
import { APP_EVENTS, dispatchAppEvent } from '../../shared/app-events.js';

class NavBar extends BaseElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
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
    btn.className = 'nav-item nav-item--record nav-item--active';
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
    return btn;
  }

  protected render(): void {
    const nav = document.createElement('nav');
    nav.className = 'bottom-nav';
    nav.appendChild(this.buildRutasBtn());
    nav.appendChild(this.buildGrabarBtn());
    nav.appendChild(this.buildPerfilBtn());

    this.renderShadow(styles, nav);
  }

  private buildListIcon(): string {
    return `<span class="nav-icon-list">
      <span class="nav-icon-list__bar"></span>
      <span class="nav-icon-list__bar"></span>
      <span class="nav-icon-list__bar nav-icon-list__bar--short"></span>
    </span>`;
  }

  private buildProfileIcon(): string {
    return `<span class="nav-icon-profile"></span>`;
  }
}

customElements.define('nav-bar', NavBar);