import '../cockpit/cockpit.element.js';
import '../components/nav-bar/nav-bar.element.js';

type ViewName = 'cockpit' | 'routes' | 'profile';

class AppRoot extends HTMLElement {
  private currentView: ViewName = 'cockpit';

  connectedCallback(): void {
    this.render();
  }

  private navigateTo(view: ViewName): void {
    this.currentView = view;
    this.render();
  }

  private render(): void {
    this.innerHTML = '';

    if (this.currentView === 'cockpit') {
      const cockpit = document.createElement('cockpit-view');
      this.appendChild(cockpit);
    }

    const navBar = document.createElement('nav-bar');
    navBar.addEventListener('nav-grabar', () => { this.navigateTo('cockpit'); });
    this.appendChild(navBar);
  }
}

customElements.define('app-root', AppRoot);