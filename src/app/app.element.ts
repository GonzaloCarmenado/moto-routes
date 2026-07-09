import '../cockpit/cockpit.element.js';

class AppRoot extends HTMLElement {
  connectedCallback(): void {
    const cockpit = document.createElement('cockpit-view');
    this.appendChild(cockpit);
  }
}

customElements.define('app-root', AppRoot);
