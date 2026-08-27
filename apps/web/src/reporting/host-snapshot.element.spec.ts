import { describe, it, expect, beforeEach } from 'vitest';
import './host-snapshot.element.js';
import type { HostSnapshotElement } from './host-snapshot.element.js';

describe('<host-snapshot>', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  function mount(): HostSnapshotElement {
    const el = document.createElement('host-snapshot') as HostSnapshotElement;
    document.body.appendChild(el);
    return el;
  }

  it('sin instantánea todavía: muestra el estado explícito "sin datos todavía"', () => {
    const el = mount();
    el.snapshot = null;
    const root = el.shadowRoot!;
    expect(root.querySelector('[data-cy="host-snapshot-empty-state"]')).not.toBeNull();
  });

  it('con instantánea disponible: muestra memoria, disco y el timestamp', () => {
    const el = mount();
    el.snapshot = {
      memory: { usedBytes: 500, totalBytes: 1000 },
      disk: { usedBytes: 250, totalBytes: 1000 },
      metricsTimestamp: '2026-08-26T10:00:00Z',
    };
    const root = el.shadowRoot!;
    expect(root.querySelector('[data-cy="host-snapshot-memory"]')).not.toBeNull();
    expect(root.querySelector('[data-cy="host-snapshot-disk"]')).not.toBeNull();
    expect(root.querySelector('[data-cy="host-snapshot-timestamp"]')?.textContent).toContain('2026-08-26T10:00:00Z');
    expect(root.querySelector('[data-cy="host-snapshot-empty-state"]')).toBeNull();
  });
});
