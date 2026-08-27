/**
 * Web Component `<reporting-view>`: contenedor de la vista de reporting —
 * pide `GET /admin/status` al montarse, y compone `<events-list>` +
 * `<host-snapshot>` con la respuesta. Un fallo de red (no de sesión — eso lo
 * gestiona `app.element.ts` globalmente vía `session-invalidated`) muestra un
 * estado de error con acción de reintentar.
 */
import { BaseElement } from '../shared/base-element.js';
import { getAdminStatus } from './reporting.service.js';
import type { AdminStatusResponse } from './reporting.types.js';
import './events-list.element.js';
import type { EventsListElement } from './events-list.element.js';
import './host-snapshot.element.js';
import type { HostSnapshotElement } from './host-snapshot.element.js';
import styles from './reporting-view.element.css?inline';

type ViewState = { kind: 'loading' } | { kind: 'loaded'; data: AdminStatusResponse } | { kind: 'error' };

class ReportingViewElement extends BaseElement {
  private state: ViewState = { kind: 'loading' };

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback(): void {
    this.render();
    void this.load();
  }

  private async load(): Promise<void> {
    this.state = { kind: 'loading' };
    this.render();
    try {
      const data = await getAdminStatus();
      this.state = { kind: 'loaded', data };
    } catch {
      this.state = { kind: 'error' };
    }
    this.render();
  }

  private buildError(): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'error-state';

    const message = document.createElement('p');
    message.textContent = 'No se pudo cargar el reporting. Comprueba la conexión.';
    wrapper.appendChild(message);

    const retryBtn = document.createElement('button');
    retryBtn.type = 'button';
    retryBtn.className = 'retry-action';
    retryBtn.setAttribute('data-cy', 'reporting-button-retry');
    retryBtn.textContent = 'Reintentar';
    retryBtn.addEventListener('click', () => { void this.load(); });
    wrapper.appendChild(retryBtn);

    return wrapper;
  }

  private buildLoaded(data: AdminStatusResponse): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'loaded-state';

    const snapshotEl = document.createElement('host-snapshot') as HostSnapshotElement;
    snapshotEl.snapshot = { memory: data.memory, disk: data.disk, metricsTimestamp: data.metricsTimestamp };
    wrapper.appendChild(snapshotEl);

    const eventsEl = document.createElement('events-list') as EventsListElement;
    eventsEl.events = data.events;
    wrapper.appendChild(eventsEl);

    return wrapper;
  }

  protected render(): void {
    if (this.state.kind === 'loading') {
      const loading = document.createElement('p');
      loading.className = 'loading-state';
      loading.textContent = 'Cargando…';
      this.renderShadow(styles, loading);
      return;
    }
    if (this.state.kind === 'error') {
      this.renderShadow(styles, this.buildError());
      return;
    }
    this.renderShadow(styles, this.buildLoaded(this.state.data));
  }
}

customElements.define('reporting-view', ReportingViewElement);
