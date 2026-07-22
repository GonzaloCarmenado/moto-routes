import { describe, it, expect } from 'vitest';
import { buildHeader, buildSpeedDisplay, buildStatGrid, buildAvgSpeedBanner, updateLiveDisplay } from './cockpit.render.js';

function mountShadowRoot(...children: HTMLElement[]): ShadowRoot {
  const host = document.createElement('div');
  const root = host.attachShadow({ mode: 'open' });
  for (const child of children) root.appendChild(child);
  return root;
}

describe('updateLiveDisplay', () => {
  it('updates time, speed, distance, altitude and avg speed in place without touching structure', () => {
    const root = mountShadowRoot(
      buildHeader('00:00', 'chip-recording', 'En ruta'),
      buildSpeedDisplay('0'),
      buildStatGrid('0.0', '00:00', '0'),
      buildAvgSpeedBanner('0'),
    );

    updateLiveDisplay(root, { speed: '42', avgSpeed: '35', dist: '12.3', time: '05:30', alt: '650' });

    expect(root.querySelector('.app-header__time')?.textContent).toBe('05:30');
    expect(root.querySelector('.speed-value')?.textContent).toBe('42');
    expect(root.querySelector('[data-live="dist"]')?.textContent).toBe('12.3');
    expect(root.querySelector('[data-live="time-tile"]')?.textContent).toBe('05:30');
    expect(root.querySelector('[data-live="alt"]')?.textContent).toBe('650');
    expect(root.querySelector('[data-live="avg-speed"]')?.textContent).toBe('35 km/h');

    // Unit suffixes are untouched — proves this is a targeted text update, not innerHTML replacement
    expect(root.querySelector('.stat-grid')?.textContent).toContain('km');
    expect(root.querySelector('.stat-grid')?.textContent).toContain('m');
  });

  it('does nothing when the expected nodes are missing (no throw)', () => {
    const root = mountShadowRoot();
    expect(() => {
      updateLiveDisplay(root, { speed: '1', avgSpeed: '2', dist: '3', time: '4', alt: '5' });
    }).not.toThrow();
  });
});
