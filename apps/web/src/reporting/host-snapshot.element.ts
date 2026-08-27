/**
 * Web Component `<host-snapshot>`: última instantánea de memoria/disco del
 * host, o un estado explícito "sin datos todavía" si el endpoint no la
 * incluye (todavía no se ha recolectado ninguna).
 */
import { BaseElement } from '../shared/base-element.js';
import type { ResourceSnapshot } from './reporting.types.js';
import styles from './host-snapshot.element.css?inline';

/** Datos que muestra `<host-snapshot>` — ausentes si todavía no hay ninguna instantánea recolectada. */
export interface HostSnapshotData {
  memory?: ResourceSnapshot | undefined;
  disk?: ResourceSnapshot | undefined;
  metricsTimestamp?: string | undefined;
}

/** Elemento `<host-snapshot>` — exportado para tipar la referencia en `reporting-view.element.ts` y en sus propios tests. */
export class HostSnapshotElement extends BaseElement {
  private currentSnapshot: HostSnapshotData | null = null;

  set snapshot(value: HostSnapshotData | null) {
    this.currentSnapshot = value;
    this.render();
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback(): void {
    this.render();
  }

  private buildResourceRow(label: string, dataCy: string, resource: ResourceSnapshot): HTMLElement {
    const row = document.createElement('div');
    row.className = 'resource-row';
    row.setAttribute('data-cy', dataCy);

    const percent = resource.totalBytes > 0 ? (resource.usedBytes / resource.totalBytes) * 100 : 0;
    const labelEl = document.createElement('span');
    labelEl.className = 'resource-label';
    labelEl.textContent = label;
    row.appendChild(labelEl);

    const valueEl = document.createElement('span');
    valueEl.className = 'resource-value';
    valueEl.textContent = `${percent.toFixed(1)}%`;
    row.appendChild(valueEl);

    return row;
  }

  private buildEmptyState(): HTMLElement {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.setAttribute('data-cy', 'host-snapshot-empty-state');
    empty.textContent = 'Sin datos todavía.';
    return empty;
  }

  protected render(): void {
    const snapshot = this.currentSnapshot;
    if (!snapshot?.memory || !snapshot.disk || !snapshot.metricsTimestamp) {
      this.renderShadow(styles, this.buildEmptyState());
      return;
    }

    const content = document.createDocumentFragment();
    content.appendChild(this.buildResourceRow('Memoria', 'host-snapshot-memory', snapshot.memory));
    content.appendChild(this.buildResourceRow('Disco', 'host-snapshot-disk', snapshot.disk));

    const timestamp = document.createElement('p');
    timestamp.className = 'timestamp';
    timestamp.setAttribute('data-cy', 'host-snapshot-timestamp');
    timestamp.textContent = snapshot.metricsTimestamp;
    content.appendChild(timestamp);

    this.renderShadow(styles, content);
  }
}

customElements.define('host-snapshot', HostSnapshotElement);
