/**
 * Web Component `<events-list>`: lista de eventos operacionales recientes,
 * en el orden recibido (el propio endpoint ya los ordena — ver
 * `registro-errores-api`, requirement "Consulta de eventos recientes").
 * Todo texto de evento se inserta como `textContent`, nunca `innerHTML`
 * (design.md, Risk de XSS con el secreto de sesión en `sessionStorage`).
 */
import { BaseElement } from '../shared/base-element.js';
import type { AdminEvent } from './reporting.types.js';
import styles from './events-list.element.css?inline';

/** Elemento `<events-list>` — exportado para tipar la referencia en `reporting-view.element.ts` y en sus propios tests. */
export class EventsListElement extends BaseElement {
  private currentEvents: AdminEvent[] = [];

  set events(value: AdminEvent[]) {
    this.currentEvents = value;
    this.render();
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback(): void {
    this.render();
  }

  private buildItem(event: AdminEvent): HTMLElement {
    const item = document.createElement('div');
    item.className = `event-item level-${event.level}`;
    item.setAttribute('data-cy', 'events-list-item');

    const badge = document.createElement('span');
    badge.className = 'event-level-badge';
    badge.textContent = event.level === 'error' ? 'Error' : 'Warning';
    item.appendChild(badge);

    const message = document.createElement('p');
    message.className = 'event-message';
    message.textContent = event.message;
    item.appendChild(message);

    const meta = document.createElement('p');
    meta.className = 'event-meta';
    const metaParts = [event.timestamp, event.method, event.route].filter((part): part is string => Boolean(part));
    meta.textContent = metaParts.join(' · ');
    item.appendChild(meta);

    return item;
  }

  private buildEmptyState(): HTMLElement {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.setAttribute('data-cy', 'events-list-empty-state');
    empty.textContent = 'No hay eventos registrados.';
    return empty;
  }

  protected render(): void {
    if (this.currentEvents.length === 0) {
      this.renderShadow(styles, this.buildEmptyState());
      return;
    }
    const list = document.createElement('div');
    list.className = 'event-list';
    for (const event of this.currentEvents) list.appendChild(this.buildItem(event));
    this.renderShadow(styles, list);
  }
}

customElements.define('events-list', EventsListElement);
