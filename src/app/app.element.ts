import { BaseElement } from '../shared/base-element.js';
import styles from './app.element.css?inline';

class AppRoot extends BaseElement {
  private isRecording = false;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback(): void {
    this.render();
  }

  private toggleRecording(): void {
    this.isRecording = !this.isRecording;
    this.render();
  }

  private buildStatusBar(): HTMLElement {
    const bar = document.createElement('div');
    bar.className = 'status-bar';
    bar.innerHTML = `
      <span>Moto Routes</span>
      <div class="status-bar__recording">
        <span class="status-dot ${this.isRecording ? '' : 'status-dot--stopped'}"></span>
        <span>${this.isRecording ? 'REC' : 'STOP'}</span>
      </div>
    `;
    return bar;
  }

  private buildDial(): HTMLElement {
    const dial = document.createElement('div');
    dial.className = 'cockpit-dial';
    dial.innerHTML = `
      <div class="cockpit-dial__value">${this.isRecording ? '86' : '0'}</div>
      <div class="cockpit-dial__unit">km/h</div>
    `;
    return dial;
  }

  private buildRecordButton(): HTMLElement {
    const btn = document.createElement('button');
    btn.className = `btn-master-rec ${this.isRecording ? 'btn-master-rec--active' : ''}`;
    btn.textContent = this.isRecording ? 'STOP' : '● START';
    btn.addEventListener('click', () => {
      this.toggleRecording();
    });
    return btn;
  }

  private buildTelemetryGrid(): HTMLElement {
    const grid = document.createElement('div');
    grid.className = 'telemetry-grid';
    grid.innerHTML = `
      <div class="telemetry-block ${this.isRecording ? 'telemetry-block--highlight' : ''}">
        <div class="telemetry-block__label">Vel. Media</div>
        <div class="telemetry-block__value">${this.isRecording ? '72' : '--'}<span>km/h</span></div>
      </div>
      <div class="telemetry-block">
        <div class="telemetry-block__label">Distancia</div>
        <div class="telemetry-block__value">${this.isRecording ? '12.4' : '--'}<span>km</span></div>
      </div>
      <div class="telemetry-block">
        <div class="telemetry-block__label">Tiempo</div>
        <div class="telemetry-block__value">${this.isRecording ? '14:32' : '--:--'}<span>min</span></div>
      </div>
      <div class="telemetry-block">
        <div class="telemetry-block__label">Altitud</div>
        <div class="telemetry-block__value">${this.isRecording ? '845' : '--'}<span>m</span></div>
      </div>
    `;
    return grid;
  }

  private buildNavigation(): HTMLElement {
    const nav = document.createElement('nav');
    nav.className = 'navbar-bottom';
    nav.innerHTML = `
      <button class="nav-item nav-item--active">
        <svg viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" fill="none" stroke-width="2"/><circle cx="12" cy="12" r="3" fill="none" stroke-width="2"/></svg>
        <span class="nav-item__label">Ruta</span>
      </button>
      <button class="nav-item">
        <svg viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16v16H4z" fill="none" stroke-width="2"/><path d="M9 4v16" fill="none" stroke-width="2"/><path d="M15 4v16" fill="none" stroke-width="2"/><path d="M4 9h16" fill="none" stroke-width="2"/><path d="M4 15h16" fill="none" stroke-width="2"/></svg>
        <span class="nav-item__label">Rutas</span>
      </button>
      <button class="nav-item">
        <svg viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z" fill="none" stroke-width="2"/><path d="M2 17l10 5 10-5" fill="none" stroke-width="2"/><path d="M2 12l10 5 10-5" fill="none" stroke-width="2"/></svg>
        <span class="nav-item__label">Garaje</span>
      </button>
      <button class="nav-item">
        <svg viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3" fill="none" stroke-width="2"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" fill="none" stroke-width="2"/></svg>
        <span class="nav-item__label">Ajustes</span>
      </button>
    `;
    return nav;
  }

  protected render(): void {
    const root = this.shadowRoot;
    if (!root) return;

    const style = document.createElement('style');
    style.textContent = styles;

    const wrapper = document.createElement('div');
    wrapper.className = 'app-wrapper';
    wrapper.appendChild(this.buildStatusBar());
    wrapper.appendChild(this.buildDial());
    wrapper.appendChild(this.buildRecordButton());
    wrapper.appendChild(this.buildTelemetryGrid());
    wrapper.appendChild(this.buildNavigation());

    root.innerHTML = '';
    root.appendChild(style);
    root.appendChild(wrapper);
  }
}

customElements.define('app-root', AppRoot);