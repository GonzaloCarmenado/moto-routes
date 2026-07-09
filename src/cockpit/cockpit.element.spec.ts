import { describe, it, expect } from 'vitest';
import './cockpit.element.js';

describe('CockpitView', () => {
  it('should render master button with hitbox classes (AC-009)', () => {
    const cockpit = document.createElement('cockpit-view');
    document.body.appendChild(cockpit);

    const shadowRoot = cockpit.shadowRoot!;
    const btn = shadowRoot.getElementById('cockpit-master-btn');

    expect(btn).not.toBeNull();
    expect(btn?.className).toContain('btn-master-rec');

    document.body.removeChild(cockpit);
  });

  it('should render action buttons with hitbox classes (AC-009)', () => {
    const cockpit = document.createElement('cockpit-view');
    document.body.appendChild(cockpit);

    const shadowRoot = cockpit.shadowRoot!;
    const invisBtn = shadowRoot.getElementById('cockpit-invisible-btn');

    expect(invisBtn).not.toBeNull();
    expect(invisBtn?.className).toContain('action-btn');

    document.body.removeChild(cockpit);
  });

  it('should have invisible button present but with disabled appearance when idle (AC-015)', () => {
    const cockpit = document.createElement('cockpit-view');
    document.body.appendChild(cockpit);

    const shadowRoot = cockpit.shadowRoot!;
    const invisBtn = shadowRoot.getElementById('cockpit-invisible-btn');

    expect(invisBtn).not.toBeNull();
    // El botón invisible existe pero no tiene clase activa en reposo
    expect(invisBtn?.className).not.toContain('action-btn--active');

    document.body.removeChild(cockpit);
  });

  it('should show START button text when idle (AC-002)', () => {
    const cockpit = document.createElement('cockpit-view');
    document.body.appendChild(cockpit);

    const shadowRoot = cockpit.shadowRoot!;
    const btn = shadowRoot.getElementById('cockpit-master-btn');

    expect(btn?.textContent).toContain('START');

    document.body.removeChild(cockpit);
  });

  it('should render pause button with correct label', () => {
    const cockpit = document.createElement('cockpit-view');
    document.body.appendChild(cockpit);

    const shadowRoot = cockpit.shadowRoot!;
    const pauseBtn = shadowRoot.getElementById('cockpit-pause-btn');

    expect(pauseBtn).not.toBeNull();
    expect(pauseBtn?.textContent).toContain('Pausa');

    document.body.removeChild(cockpit);
  });

  it('should render the dial with speed value and unit', () => {
    const cockpit = document.createElement('cockpit-view');
    document.body.appendChild(cockpit);

    const shadowRoot = cockpit.shadowRoot!;
    const dialValue = shadowRoot.querySelector('.cockpit-dial__value');
    const dialUnit = shadowRoot.querySelector('.cockpit-dial__unit');

    expect(dialValue).not.toBeNull();
    expect(dialUnit?.textContent).toBe('km/h');

    document.body.removeChild(cockpit);
  });

  it('should render telemetry blocks', () => {
    const cockpit = document.createElement('cockpit-view');
    document.body.appendChild(cockpit);

    const shadowRoot = cockpit.shadowRoot!;
    const blocks = shadowRoot.querySelectorAll('.telemetry-block');

    expect(blocks.length).toBe(4);

    document.body.removeChild(cockpit);
  });
});