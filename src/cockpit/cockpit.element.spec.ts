import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import './cockpit.element.js';

describe('CockpitView', () => {
  beforeEach(() => {
    // Mock del GPS para evitar errores de consola
    const mockGeolocation = {
      getCurrentPosition: vi.fn((success: PositionCallback) => {
        success({
          coords: {
            latitude: 40.4168,
            longitude: -3.7038,
            altitude: 650,
            speed: 0,
            accuracy: 10,
            altitudeAccuracy: 10,
            heading: 0,
          },
          timestamp: Date.now(),
        } as GeolocationPosition);
      }),
      watchPosition: vi.fn((success: PositionCallback) => {
        success({
          coords: {
            latitude: 40.4168,
            longitude: -3.7038,
            altitude: 650,
            speed: 0,
            accuracy: 10,
            altitudeAccuracy: 10,
            heading: 0,
          },
          timestamp: Date.now(),
        } as GeolocationPosition);
        return 1;
      }),
      clearWatch: vi.fn(),
    };
    Object.defineProperty(globalThis.navigator, 'geolocation', {
      value: mockGeolocation,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('should render master button with hitbox classes (AC-009)', () => {
    const cockpit = document.createElement('cockpit-view');
    document.body.appendChild(cockpit);
    const shadowRoot = cockpit.shadowRoot!;
    const btn = shadowRoot.getElementById('cockpit-master-btn');
    expect(btn).not.toBeNull();
    expect(btn?.className).toContain('control-btn');
    document.body.removeChild(cockpit);
  });

  it('should render invisible toggle with hitbox classes (AC-009)', () => {
    const cockpit = document.createElement('cockpit-view');
    document.body.appendChild(cockpit);
    const shadowRoot = cockpit.shadowRoot!;
    const invisBtn = shadowRoot.getElementById('cockpit-invisible-btn');
    expect(invisBtn).not.toBeNull();
    expect(invisBtn?.className).toContain('invisible-toggle');
    document.body.removeChild(cockpit);
  });

  it('should have invisible button without active state when idle (AC-015)', () => {
    const cockpit = document.createElement('cockpit-view');
    document.body.appendChild(cockpit);
    const shadowRoot = cockpit.shadowRoot!;
    const invisBtn = shadowRoot.getElementById('cockpit-invisible-btn');
    expect(invisBtn).not.toBeNull();
    expect(invisBtn?.className).not.toContain('invisible-toggle--active');
    document.body.removeChild(cockpit);
  });

  it('should label the master button as "Iniciar grabación" when idle (AC-002)', () => {
    const cockpit = document.createElement('cockpit-view');
    document.body.appendChild(cockpit);
    const shadowRoot = cockpit.shadowRoot!;
    const btn = shadowRoot.getElementById('cockpit-master-btn');
    expect(btn?.getAttribute('aria-label')).toBe('Iniciar grabación');
    document.body.removeChild(cockpit);
  });

  it('should render pause button disabled when idle', () => {
    const cockpit = document.createElement('cockpit-view');
    document.body.appendChild(cockpit);
    const shadowRoot = cockpit.shadowRoot!;
    const pauseBtn = shadowRoot.getElementById('cockpit-pause-btn') as HTMLButtonElement;
    expect(pauseBtn).not.toBeNull();
    expect(pauseBtn?.getAttribute('aria-label')).toBe('Pausar ruta');
    expect(pauseBtn.disabled).toBe(true);
    document.body.removeChild(cockpit);
  });

  it('should render the speed display with value and unit', () => {
    const cockpit = document.createElement('cockpit-view');
    document.body.appendChild(cockpit);
    const shadowRoot = cockpit.shadowRoot!;
    const speedValue = shadowRoot.querySelector('.speed-display .speed-value');
    const speedUnit = shadowRoot.querySelector('.speed-display .speed-unit');
    expect(speedValue).not.toBeNull();
    expect(speedUnit?.textContent).toBe('km/h');
    document.body.removeChild(cockpit);
  });

  it('should render 3 stat tiles and the average speed banner', () => {
    const cockpit = document.createElement('cockpit-view');
    document.body.appendChild(cockpit);
    const shadowRoot = cockpit.shadowRoot!;
    const tiles = shadowRoot.querySelectorAll('.stat-tile');
    const banner = shadowRoot.querySelector('.avg-speed-banner');
    expect(tiles.length).toBe(3);
    expect(banner).not.toBeNull();
    document.body.removeChild(cockpit);
  });

  it('should show chip with "Listo" label when idle', () => {
    const cockpit = document.createElement('cockpit-view');
    document.body.appendChild(cockpit);
    const shadowRoot = cockpit.shadowRoot!;
    const chip = shadowRoot.querySelector('.chip');
    expect(chip?.textContent).toContain('Listo');
    expect(chip?.className).toContain('chip-neutral');
    document.body.removeChild(cockpit);
  });

  it('should render GPS overlay hidden initially', () => {
    const cockpit = document.createElement('cockpit-view');
    document.body.appendChild(cockpit);
    const shadowRoot = cockpit.shadowRoot!;
    const overlay = shadowRoot.getElementById('gps-overlay');
    expect(overlay).not.toBeNull();
    expect(overlay?.style.display).toBe('none');
    document.body.removeChild(cockpit);
  });

  it('should render GPS request button inside overlay', () => {
    const cockpit = document.createElement('cockpit-view');
    document.body.appendChild(cockpit);
    const shadowRoot = cockpit.shadowRoot!;
    const gpsBtn = shadowRoot.getElementById('gps-request-btn');
    expect(gpsBtn).not.toBeNull();
    expect(gpsBtn?.textContent).toContain('Abrir ajustes');
    document.body.removeChild(cockpit);
  });

  it('should render when geolocation is unavailable', () => {
    Object.defineProperty(globalThis.navigator, 'geolocation', {
      value: null,
      writable: true,
      configurable: true,
    });
    const cockpit = document.createElement('cockpit-view');
    document.body.appendChild(cockpit);
    const shadowRoot = cockpit.shadowRoot!;
    const btn = shadowRoot.getElementById('cockpit-master-btn');
    expect(btn).not.toBeNull();
    document.body.removeChild(cockpit);
  });
});