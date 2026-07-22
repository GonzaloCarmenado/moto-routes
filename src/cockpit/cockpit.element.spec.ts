import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import './cockpit.element.js';

beforeEach(() => {
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

async function waitRender(): Promise<void> {
  // 50ms (no 10ms): connectedCallback encadena varios await reales (initService()
  // intenta createSqliteDb() antes de caer a MemoryRouteRepository) y bajo carga
  // (suite completa + cobertura v8) 10ms resultaba intermitente.
  await new Promise((r) => setTimeout(r, 50));
}

async function mountCockpit(): Promise<{ cockpit: HTMLElement; shadowRoot: ShadowRoot }> {
  const cockpit = document.createElement('cockpit-view');
  document.body.appendChild(cockpit);
  await waitRender();
  return { cockpit, shadowRoot: cockpit.shadowRoot! };
}

describe('CockpitView - controles principales', () => {
  it('should render master button with hitbox classes (AC-009)', async () => {
    const { cockpit, shadowRoot } = await mountCockpit();
    const btn = shadowRoot.getElementById('cockpit-master-btn');
    expect(btn).not.toBeNull();
    expect(btn?.className).toContain('control-btn');
    document.body.removeChild(cockpit);
  });

  it('should render invisible toggle with hitbox classes (AC-009)', async () => {
    const { cockpit, shadowRoot } = await mountCockpit();
    const invisBtn = shadowRoot.getElementById('cockpit-invisible-btn');
    expect(invisBtn).not.toBeNull();
    expect(invisBtn?.className).toContain('invisible-toggle');
    document.body.removeChild(cockpit);
  });

  it('should have invisible button without active state when idle (AC-015)', async () => {
    const { cockpit, shadowRoot } = await mountCockpit();
    const invisBtn = shadowRoot.getElementById('cockpit-invisible-btn');
    expect(invisBtn).not.toBeNull();
    expect(invisBtn?.className).not.toContain('invisible-toggle--active');
    document.body.removeChild(cockpit);
  });

  it('should label the master button as "Iniciar grabación" when idle (AC-002)', async () => {
    const { cockpit, shadowRoot } = await mountCockpit();
    const btn = shadowRoot.getElementById('cockpit-master-btn');
    expect(btn?.getAttribute('aria-label')).toBe('Iniciar grabación');
    document.body.removeChild(cockpit);
  });

  it('should render pause button disabled when idle', async () => {
    const { cockpit, shadowRoot } = await mountCockpit();
    const pauseBtn = shadowRoot.getElementById('cockpit-pause-btn') as HTMLButtonElement;
    expect(pauseBtn).not.toBeNull();
    expect(pauseBtn?.getAttribute('aria-label')).toBe('Pausar ruta');
    expect(pauseBtn.disabled).toBe(true);
    document.body.removeChild(cockpit);
  });
});

describe('CockpitView - pantalla de datos', () => {
  it('should render the speed display with value and unit', async () => {
    const { cockpit, shadowRoot } = await mountCockpit();
    const speedValue = shadowRoot.querySelector('.speed-display .speed-value');
    const speedUnit = shadowRoot.querySelector('.speed-display .speed-unit');
    expect(speedValue).not.toBeNull();
    expect(speedUnit?.textContent).toBe('km/h');
    document.body.removeChild(cockpit);
  });

  it('should render 3 stat tiles and the average speed banner', async () => {
    const { cockpit, shadowRoot } = await mountCockpit();
    const tiles = shadowRoot.querySelectorAll('.stat-tile');
    const banner = shadowRoot.querySelector('.avg-speed-banner');
    expect(tiles.length).toBe(3);
    expect(banner).not.toBeNull();
    document.body.removeChild(cockpit);
  });

  it('should show chip with "Listo" label when idle', async () => {
    const { cockpit, shadowRoot } = await mountCockpit();
    const chip = shadowRoot.querySelector('.chip');
    expect(chip?.textContent).toContain('Listo');
    expect(chip?.className).toContain('chip-neutral');
    document.body.removeChild(cockpit);
  });
});

describe('CockpitView - GPS', () => {
  it('should render GPS overlay hidden initially', async () => {
    const { cockpit, shadowRoot } = await mountCockpit();
    const overlay = shadowRoot.getElementById('gps-overlay');
    expect(overlay).not.toBeNull();
    expect(overlay?.style.display).toBe('none');
    document.body.removeChild(cockpit);
  });

  it('should render GPS request button inside overlay', async () => {
    const { cockpit, shadowRoot } = await mountCockpit();
    const gpsBtn = shadowRoot.getElementById('gps-request-btn');
    expect(gpsBtn).not.toBeNull();
    expect(gpsBtn?.textContent).toContain('Abrir ajustes');
    document.body.removeChild(cockpit);
  });

  it('should render when geolocation is unavailable', async () => {
    Object.defineProperty(globalThis.navigator, 'geolocation', {
      value: null,
      writable: true,
      configurable: true,
    });
    const { cockpit, shadowRoot } = await mountCockpit();
    const btn = shadowRoot.getElementById('cockpit-master-btn');
    expect(btn).not.toBeNull();
    document.body.removeChild(cockpit);
  });
});

describe('CockpitView - foto durante grabación', () => {
  it('does not render the photo-capture button while idle (AC-027)', async () => {
    const { cockpit, shadowRoot } = await mountCockpit();
    expect(shadowRoot.querySelector('[data-cy="cockpit-photo-capture"]')).toBeNull();
    document.body.removeChild(cockpit);
  });

  it('renders the photo-capture button once recording starts (AC-027)', async () => {
    const { cockpit, shadowRoot } = await mountCockpit();
    const masterBtn = shadowRoot.getElementById('cockpit-master-btn') as HTMLButtonElement;
    masterBtn.click();
    expect(shadowRoot.querySelector('[data-cy="cockpit-photo-capture"]')).not.toBeNull();
    document.body.removeChild(cockpit);
  });

  it('should keep the photo-capture menu open across a recording tick (regression: the DOM used to be torn down every second)', async () => {
    const { cockpit, shadowRoot } = await mountCockpit();
    const masterBtn = shadowRoot.getElementById('cockpit-master-btn') as HTMLButtonElement;

    // Fake timers must be active *before* starting the recording, so the setInterval
    // it registers (the 1s cronómetro tick) is one vi.advanceTimersByTimeAsync can drive.
    vi.useFakeTimers();
    try {
      masterBtn.click();

      const photoCapture = shadowRoot.querySelector('[data-cy="cockpit-photo-capture"]');
      expect(photoCapture).not.toBeNull();

      const innerBtn = photoCapture!.shadowRoot!.querySelector('.photo-btn') as HTMLButtonElement;
      innerBtn.click();
      expect(photoCapture!.shadowRoot!.querySelector('.photo-menu')?.classList.contains('menu-open')).toBe(true);

      // Simulate the 1s cronómetro tick that used to call render() (root.innerHTML = '')
      // and silently destroy <photo-capture> together with its just-opened menu.
      await vi.advanceTimersByTimeAsync(1000);

      const photoCaptureAfterTick = shadowRoot.querySelector('[data-cy="cockpit-photo-capture"]');
      expect(photoCaptureAfterTick).toBe(photoCapture);
      expect(photoCaptureAfterTick!.shadowRoot!.querySelector('.photo-menu')?.classList.contains('menu-open')).toBe(true);
    } finally {
      vi.useRealTimers();
    }

    document.body.removeChild(cockpit);
  });

  it('should still update the live time/speed display while the menu is open', async () => {
    const { cockpit, shadowRoot } = await mountCockpit();
    const masterBtn = shadowRoot.getElementById('cockpit-master-btn') as HTMLButtonElement;

    vi.useFakeTimers();
    try {
      masterBtn.click();
      await vi.advanceTimersByTimeAsync(3000);

      const time = shadowRoot.querySelector('.app-header__time');
      expect(time?.textContent).toBe('00:03');
    } finally {
      vi.useRealTimers();
    }

    document.body.removeChild(cockpit);
  });
});
