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

  private render(): void {
    const style = document.createElement('style');
    style.textContent = styles;

    const nav = document.createElement('nav');
    nav.className = 'bottom-nav';

    // Rutas
    const rutasBtn = document.createElement('button');
    rutasBtn.className = 'nav-item';
    rutasBtn.setAttribute('data-cy', 'nav-rutas');
    rutasBtn.innerHTML = this.buildListIcon() + '<span class="nav-label">Rutas</span>';

    // Grabar (activo, destacado)
    const grabarBtn = document.createElement('button');
    grabarBtn.className = 'nav-item nav-item--record nav-item--active';
    grabarBtn.setAttribute('data-cy', 'nav-grabar');
    grabarBtn.setAttribute('aria-label', 'Ir a grabar ruta');
    grabarBtn.innerHTML = '<span class="record-dot"></span><span class="nav-label">Grabar</span>';
    grabarBtn.addEventListener('click', () => { this.handleGrabarClick(); });

    // Perfil
    const perfilBtn = document.createElement('button');
    perfilBtn.className = 'nav-item';
    perfilBtn.setAttribute('data-cy', 'nav-perfil');
    perfilBtn.innerHTML = this.buildProfileIcon() + '<span class="nav-label">Perfil</span>';

    nav.appendChild(rutasBtn);
    nav.appendChild(grabarBtn);
    nav.appendChild(perfilBtn);

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