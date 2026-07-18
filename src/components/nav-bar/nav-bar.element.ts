import styles from './nav-bar.element.css?inline';

class NavBar extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback(): void {
    this.render();
  }

  private handleGrabarClick(): void {
    this.dispatchEvent(new CustomEvent('nav-grabar', { bubbles: true, composed: true }));
  }

  private handleRutasClick(): void {
    this.dispatchEvent(new CustomEvent('nav-rutas', { bubbles: true, composed: true }));
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

  private render(): void {
    const style = document.createElement('style');
    style.textContent = styles;

    const nav = document.createElement('nav');
    nav.className = 'bottom-nav';
    nav.appendChild(this.buildRutasBtn());
    nav.appendChild(this.buildGrabarBtn());
    nav.appendChild(this.buildPerfilBtn());

    const root = this.shadowRoot;
    if (!root) return;
    root.innerHTML = '';
    root.appendChild(style);
    root.appendChild(nav);
  }

  private buildListIcon(): string {
    return `<span style="display:flex;flex-direction:column;gap:3px;align-items:center;">
      <span style="display:block;width:22px;height:3px;border-radius:2px;background:currentColor;"></span>
      <span style="display:block;width:22px;height:3px;border-radius:2px;background:currentColor;"></span>
      <span style="display:block;width:16px;height:3px;border-radius:2px;background:currentColor;"></span>
    </span>`;
  }

  private buildProfileIcon(): string {
    return `<span style="width:22px;height:22px;border-radius:50%;border:3px solid currentColor;display:block;"></span>`;
  }
}

customElements.define('nav-bar', NavBar);