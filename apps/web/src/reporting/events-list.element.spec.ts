import { describe, it, expect, beforeEach } from 'vitest';
import './events-list.element.js';
import type { AdminEvent } from './reporting.types.js';
import type { EventsListElement } from './events-list.element.js';

describe('<events-list>', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  function mount(): EventsListElement {
    const el = document.createElement('events-list') as EventsListElement;
    document.body.appendChild(el);
    return el;
  }

  it('sin eventos: muestra el estado vacío explícito', () => {
    const el = mount();
    el.events = [];
    const root = el.shadowRoot!;
    expect(root.querySelector('[data-cy="events-list-empty-state"]')).not.toBeNull();
    expect(root.querySelectorAll('[data-cy="events-list-item"]')).toHaveLength(0);
  });

  it('con eventos: los lista todos, en el mismo orden recibido', () => {
    const events: AdminEvent[] = [
      { timestamp: '2026-08-26T10:05:00Z', level: 'error', message: 'segundo más reciente' },
      { timestamp: '2026-08-26T10:00:00Z', level: 'warning', message: 'más antiguo' },
    ];
    const el = mount();
    el.events = events;
    const root = el.shadowRoot!;
    const items = root.querySelectorAll('[data-cy="events-list-item"]');
    expect(items).toHaveLength(2);
    expect(items[0]?.textContent).toContain('segundo más reciente');
    expect(items[1]?.textContent).toContain('más antiguo');
  });

  it('el nivel error y warning llevan clases distintas', () => {
    const events: AdminEvent[] = [
      { timestamp: '2026-08-26T10:00:00Z', level: 'error', message: 'e' },
      { timestamp: '2026-08-26T10:00:00Z', level: 'warning', message: 'w' },
    ];
    const el = mount();
    el.events = events;
    const items = el.shadowRoot!.querySelectorAll('[data-cy="events-list-item"]');
    expect(items[0]?.className).toContain('level-error');
    expect(items[1]?.className).toContain('level-warning');
  });

  it('el mensaje de un evento se inserta como texto plano, nunca como HTML', () => {
    const events: AdminEvent[] = [
      { timestamp: '2026-08-26T10:00:00Z', level: 'error', message: '<img src=x onerror=alert(1)>' },
    ];
    const el = mount();
    el.events = events;
    const root = el.shadowRoot!;
    expect(root.querySelector('img')).toBeNull();
    expect(root.querySelector('[data-cy="events-list-item"]')?.textContent).toContain('<img src=x onerror=alert(1)>');
  });
});
