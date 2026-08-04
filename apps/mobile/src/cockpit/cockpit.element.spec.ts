import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import './cockpit.element.js';
import { MemoryRouteRepository } from '../shared/repositories/memory-route.repository.js';
import type { IRouteRepository } from '../shared/models/route.repository.js';
import { MemoryStopTypesCacheRepository } from '../shared/repositories/memory-stop-types-cache.repository.js';
import type { IStopTypesCacheRepository } from '../shared/models/stop-types-cache.repository.js';
import { pickFromGallery } from '../shared/services/photo-capture-adapter.service.js';
import type * as PhotoCaptureAdapter from '../shared/services/photo-capture-adapter.service.js';
import { isAndroidTauri } from './gps/cockpit-native-gps.service.js';
import type * as NativeGpsModule from './gps/cockpit-native-gps.service.js';
import { listen } from '@tauri-apps/api/event';
import { fetchGalleryPhotos, processMultiplePhotos, deleteCockpitPhoto } from './photo/cockpit-photo.service.js';
import type * as CockpitPhotoService from './photo/cockpit-photo.service.js';
import type { GalleryPhoto } from '../shared/photo-gallery/photo-gallery.element.js';

vi.mock('../shared/services/photo-capture-adapter.service.js', async (importOriginal) => {
  const actual = await importOriginal<typeof PhotoCaptureAdapter>();
  return { ...actual, pickFromGallery: vi.fn() };
});

// Paso 11 (límite de 100 fotos): envuelve las funciones reales con vi.fn() en vez
// de sustituirlas — el resto de tests del archivo (p. ej. "adds every photo
// selected from the gallery") siguen ejerciendo el pipeline real de persistencia
// sin necesitar mocks propios; solo los tests del describe de límite usan
// mockResolvedValueOnce() para forzar un recuento concreto en una llamada puntual.
vi.mock('./photo/cockpit-photo.service.js', async (importOriginal) => {
  const actual = await importOriginal<typeof CockpitPhotoService>();
  return {
    ...actual,
    fetchGalleryPhotos: vi.fn(actual.fetchGalleryPhotos),
    processMultiplePhotos: vi.fn(actual.processMultiplePhotos),
    deleteCockpitPhoto: vi.fn(actual.deleteCockpitPhoto),
  };
});

// Por defecto se comporta como fuera de Android (regresión de AC-020): los tests
// del resto del archivo, que no mencionan el provider nativo, siguen ejerciendo
// createBrowserGpsProvider() sin cambios.
vi.mock('./gps/cockpit-native-gps.service.js', async (importOriginal) => {
  const actual = await importOriginal<typeof NativeGpsModule>();
  return { ...actual, isAndroidTauri: vi.fn(() => false) };
});

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockResolvedValue(vi.fn()),
}));

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

async function mountCockpitWithRepo(
  repo: IRouteRepository,
): Promise<{ cockpit: HTMLElement; shadowRoot: ShadowRoot }> {
  const cockpit = document.createElement('cockpit-view') as HTMLElement & { repository: IRouteRepository };
  cockpit.repository = repo;
  document.body.appendChild(cockpit);
  await waitRender();
  return { cockpit, shadowRoot: cockpit.shadowRoot! };
}

/** Empieza a grabar y mantiene pulsado el botón de parada hasta completar el long-press. */
async function startAndLongPressStop(shadowRoot: ShadowRoot): Promise<void> {
  const masterBtn = shadowRoot.getElementById('cockpit-master-btn') as HTMLButtonElement;
  masterBtn.click(); // idle → recording, re-renderiza el botón como "stop"
  const stopBtn = shadowRoot.getElementById('cockpit-master-btn') as HTMLButtonElement;
  stopBtn.dispatchEvent(new Event('pointerdown'));
  await vi.advanceTimersByTimeAsync(1500);
}

function getSaveRouteDialog(): HTMLElement {
  const dialog = document.body.querySelector('cockpit-save-route-dialog');
  expect(dialog).not.toBeNull();
  return dialog as HTMLElement;
}

function getStopTypeDialog(): HTMLElement {
  const dialog = document.body.querySelector('cockpit-stop-type-dialog');
  expect(dialog).not.toBeNull();
  return dialog as HTMLElement;
}

async function mountCockpitWithStopTypesCache(
  cache: IStopTypesCacheRepository,
): Promise<{ cockpit: HTMLElement; shadowRoot: ShadowRoot }> {
  const cockpit = document.createElement('cockpit-view') as HTMLElement & {
    repository: IRouteRepository;
    stopTypesCacheRepository: IStopTypesCacheRepository;
  };
  cockpit.repository = new MemoryRouteRepository();
  cockpit.stopTypesCacheRepository = cache;
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

  it('does not render the photo gallery while idle (AC-014)', async () => {
    const { cockpit, shadowRoot } = await mountCockpit();
    expect(shadowRoot.querySelector('photo-gallery')).toBeNull();
    document.body.removeChild(cockpit);
  });

  it('renders the photo gallery (initially empty) once recording starts (AC-014)', async () => {
    const { cockpit, shadowRoot } = await mountCockpit();
    const masterBtn = shadowRoot.getElementById('cockpit-master-btn') as HTMLButtonElement;
    masterBtn.click();
    await waitRender();

    const gallery = shadowRoot.querySelector('[data-cy="cockpit-photo-gallery"]');
    expect(gallery).not.toBeNull();
    expect(gallery!.shadowRoot!.querySelector('[data-cy="photo-placeholder"]')).not.toBeNull();
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

  it('adds every photo selected from the gallery, not just the last one (bug regression)', async () => {
    const { cockpit, shadowRoot } = await mountCockpit();
    const masterBtn = shadowRoot.getElementById('cockpit-master-btn') as HTMLButtonElement;
    masterBtn.click();
    await waitRender();

    vi.mocked(pickFromGallery).mockResolvedValue([
      new File([''], 'a.jpg', { type: 'image/jpeg' }),
      new File([''], 'b.jpg', { type: 'image/jpeg' }),
      new File([''], 'c.jpg', { type: 'image/jpeg' }),
    ]);

    const photoCapture = shadowRoot.querySelector('[data-cy="cockpit-photo-capture"]')!;
    (photoCapture.shadowRoot!.querySelector('.photo-btn') as HTMLButtonElement).click();
    (photoCapture.shadowRoot!.querySelector('[data-cy="photo-menu-gallery"]') as HTMLButtonElement).click();
    await new Promise((r) => setTimeout(r, 200));

    const gallery = shadowRoot.querySelector('[data-cy="cockpit-photo-gallery"]')!;
    expect(gallery.shadowRoot!.querySelectorAll('[data-cy="photo-thumbnail"]')).toHaveLength(3);
    expect(document.body.querySelector('[data-cy="photo-toast"]')?.textContent).toBe('📷 3 fotos añadidas');
    document.body.removeChild(cockpit);
  });
});

describe('CockpitView - marcar parada manual (catalogo-tipos-parada)', () => {
  const categories = [
    { id: 1, key: 'bar-restaurante', label: 'Bar / restaurante', icon: '🍽️' },
    { id: 2, key: 'mirador', label: 'Mirador', icon: '🏔️' },
  ];

  it('does not show the control while idle', async () => {
    const { shadowRoot } = await mountCockpit();

    expect(shadowRoot.querySelector('[data-cy="cockpit-mark-stop"]')).toBeNull();
  });

  it('shows the control once recording starts', async () => {
    const { shadowRoot } = await mountCockpit();
    const masterBtn = shadowRoot.getElementById('cockpit-master-btn') as HTMLButtonElement;
    masterBtn.click();
    await waitRender();

    expect(shadowRoot.querySelector('[data-cy="cockpit-mark-stop"]')).not.toBeNull();
  });

  it('opens the stop-type modal with the cached catalog when pressed', async () => {
    const cache = new MemoryStopTypesCacheRepository();
    await cache.replaceAll(categories);
    const { shadowRoot } = await mountCockpitWithStopTypesCache(cache);
    const masterBtn = shadowRoot.getElementById('cockpit-master-btn') as HTMLButtonElement;
    masterBtn.click();
    await waitRender();

    (shadowRoot.querySelector('[data-cy="cockpit-mark-stop"]') as HTMLButtonElement).click();
    await waitRender();

    const dialog = getStopTypeDialog();
    expect(dialog.shadowRoot!.querySelector('[data-cy="stop-type-dialog-option-mirador"]')).not.toBeNull();
  });

  it('registers the manual stop and shows a confirmation toast when a category is chosen', async () => {
    const cache = new MemoryStopTypesCacheRepository();
    await cache.replaceAll(categories);
    const repo = new MemoryRouteRepository();
    const cockpit = document.createElement('cockpit-view') as HTMLElement & {
      repository: IRouteRepository;
      stopTypesCacheRepository: IStopTypesCacheRepository;
    };
    cockpit.repository = repo;
    cockpit.stopTypesCacheRepository = cache;
    document.body.appendChild(cockpit);
    await waitRender();
    const shadowRoot = cockpit.shadowRoot!;
    const masterBtn = shadowRoot.getElementById('cockpit-master-btn') as HTMLButtonElement;
    masterBtn.click();
    await waitRender();

    (shadowRoot.querySelector('[data-cy="cockpit-mark-stop"]') as HTMLButtonElement).click();
    await waitRender();
    const dialog = getStopTypeDialog();
    (dialog.shadowRoot!.querySelector('[data-cy="stop-type-dialog-option-mirador"]') as HTMLButtonElement).click();
    await waitRender();

    expect(document.body.querySelector('[data-cy="photo-toast"]')?.textContent).toBe('🏔️ Parada marcada: Mirador');
    document.body.removeChild(cockpit);
  });

  it('does not register any manual stop when the dialog is cancelled', async () => {
    const cache = new MemoryStopTypesCacheRepository();
    await cache.replaceAll(categories);
    const { shadowRoot } = await mountCockpitWithStopTypesCache(cache);
    const masterBtn = shadowRoot.getElementById('cockpit-master-btn') as HTMLButtonElement;
    masterBtn.click();
    await waitRender();

    (shadowRoot.querySelector('[data-cy="cockpit-mark-stop"]') as HTMLButtonElement).click();
    await waitRender();
    const dialog = getStopTypeDialog();
    (dialog.shadowRoot!.querySelector('[data-cy="stop-type-dialog-cancel"]') as HTMLButtonElement).click();
    await waitRender();

    expect(document.body.querySelector('[data-cy="photo-toast"]')).toBeNull();
  });
});

function buildGalleryPhotos(count: number): GalleryPhoto[] {
  return Array.from({ length: count }, (_, i) => ({ id: `photo-${String(i)}`, objectUrl: `blob:mock-${String(i)}` }));
}

describe('CockpitView - límite de 100 fotos por ruta (AC-041, AC-043 a AC-045)', () => {
  afterEach(() => {
    document.body.querySelector('photo-viewer')?.remove();
  });

  it('disables <photo-capture> when the active recording already has 100 photos loaded (AC-041)', async () => {
    vi.mocked(fetchGalleryPhotos).mockResolvedValueOnce(buildGalleryPhotos(100));
    const { cockpit, shadowRoot } = await mountCockpit();
    const masterBtn = shadowRoot.getElementById('cockpit-master-btn') as HTMLButtonElement;
    masterBtn.click();
    await waitRender();

    const photoCapture = shadowRoot.querySelector('[data-cy="cockpit-photo-capture"]');
    expect(photoCapture?.hasAttribute('disabled')).toBe(true);
    document.body.removeChild(cockpit);
  });

  it('does not disable <photo-capture> when the active recording has 99 photos (AC-043)', async () => {
    vi.mocked(fetchGalleryPhotos).mockResolvedValueOnce(buildGalleryPhotos(99));
    const { cockpit, shadowRoot } = await mountCockpit();
    const masterBtn = shadowRoot.getElementById('cockpit-master-btn') as HTMLButtonElement;
    masterBtn.click();
    await waitRender();

    const photoCapture = shadowRoot.querySelector('[data-cy="cockpit-photo-capture"]');
    expect(photoCapture?.hasAttribute('disabled')).toBe(false);
    document.body.removeChild(cockpit);
  });

  it('disables <photo-capture> right after adding the 100th photo, without reloading (AC-044)', async () => {
    vi.mocked(fetchGalleryPhotos)
      .mockResolvedValueOnce(buildGalleryPhotos(99))
      .mockResolvedValueOnce(buildGalleryPhotos(100));
    vi.mocked(pickFromGallery).mockResolvedValueOnce([new File([''], 'nueva.jpg', { type: 'image/jpeg' })]);
    vi.mocked(processMultiplePhotos).mockResolvedValueOnce(1);

    const { cockpit, shadowRoot } = await mountCockpit();
    const masterBtn = shadowRoot.getElementById('cockpit-master-btn') as HTMLButtonElement;
    masterBtn.click();
    await waitRender();

    const photoCaptureBefore = shadowRoot.querySelector('[data-cy="cockpit-photo-capture"]')!;
    expect(photoCaptureBefore.hasAttribute('disabled')).toBe(false);

    (photoCaptureBefore.shadowRoot!.querySelector('.photo-btn') as HTMLButtonElement).click();
    (photoCaptureBefore.shadowRoot!.querySelector('[data-cy="photo-menu-gallery"]') as HTMLButtonElement).click();
    await waitRender();

    const photoCaptureAfter = shadowRoot.querySelector('[data-cy="cockpit-photo-capture"]');
    expect(photoCaptureAfter?.hasAttribute('disabled')).toBe(true);
    document.body.removeChild(cockpit);
  });

  it('re-enables <photo-capture> after deleting a photo from an active recording at the 100-photo limit (AC-045)', async () => {
    vi.mocked(fetchGalleryPhotos).mockResolvedValueOnce(buildGalleryPhotos(100));
    vi.mocked(deleteCockpitPhoto).mockResolvedValueOnce(true);

    const { cockpit, shadowRoot } = await mountCockpit();
    const masterBtn = shadowRoot.getElementById('cockpit-master-btn') as HTMLButtonElement;
    masterBtn.click();
    await waitRender();

    const photoCaptureBefore = shadowRoot.querySelector('[data-cy="cockpit-photo-capture"]');
    expect(photoCaptureBefore?.hasAttribute('disabled')).toBe(true);

    const gallery = shadowRoot.querySelector('[data-cy="cockpit-photo-gallery"]')!;
    (gallery.shadowRoot!.querySelector('[data-cy="photo-thumbnail"]') as HTMLElement).click();
    const viewer = document.body.querySelector('photo-viewer')!;
    (viewer.shadowRoot!.querySelector('[data-cy="photo-viewer-delete"]') as HTMLButtonElement).click();
    await waitRender();

    const photoCaptureAfter = shadowRoot.querySelector('[data-cy="cockpit-photo-capture"]');
    expect(photoCaptureAfter?.hasAttribute('disabled')).toBe(false);
    document.body.removeChild(cockpit);
  });
});

describe('CockpitView - guardar/descartar al parar (AC-003 a AC-006)', () => {
  afterEach(() => {
    document.body.querySelector('cockpit-save-route-dialog')?.remove();
  });

  it('opens a save-route dialog on completing the long-press stop, without persisting a completed route yet (AC-003)', async () => {
    const repo = new MemoryRouteRepository();
    const { cockpit, shadowRoot } = await mountCockpitWithRepo(repo);

    vi.useFakeTimers();
    try {
      await startAndLongPressStop(shadowRoot);
      getSaveRouteDialog();

      const all = await repo.getAll();
      expect(all.filter((r) => r.status === 'completed')).toHaveLength(0);
    } finally {
      vi.useRealTimers();
    }
    document.body.removeChild(cockpit);
  });

  it('persists the route as completed and shows a success toast when the user chooses "Guardar" (AC-004)', async () => {
    const repo = new MemoryRouteRepository();
    const { cockpit, shadowRoot } = await mountCockpitWithRepo(repo);

    vi.useFakeTimers();
    try {
      await startAndLongPressStop(shadowRoot);
      const dialog = getSaveRouteDialog();
      const saveBtn = dialog.shadowRoot!.querySelector('[data-cy="save-route-dialog-action-save"]') as HTMLButtonElement;
      saveBtn.click();
      await vi.advanceTimersByTimeAsync(50);

      const all = await repo.getAll();
      expect(all.filter((r) => r.status === 'completed')).toHaveLength(1);
      expect(document.body.querySelector('[data-cy="photo-toast"]')?.textContent).toBe('Ruta guardada');
      expect(document.body.querySelector('cockpit-save-route-dialog')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
    document.body.removeChild(cockpit);
  });

  it('deletes the route and shows a toast when the user chooses "Descartar" (AC-005)', async () => {
    const repo = new MemoryRouteRepository();
    const { cockpit, shadowRoot } = await mountCockpitWithRepo(repo);

    vi.useFakeTimers();
    let dialog: HTMLElement;
    try {
      await startAndLongPressStop(shadowRoot);
      dialog = getSaveRouteDialog();
    } finally {
      // El descarte encadena un import() dinámico (getPhotoRepo → createPhotoRepository)
      // que no resuelve de forma fiable solo avanzando fake timers; a partir de aquí,
      // igual que el resto de flujos async del cockpit, se espera con timers reales.
      vi.useRealTimers();
    }

    const discardBtn = dialog.shadowRoot!.querySelector('[data-cy="save-route-dialog-action-discard"]') as HTMLButtonElement;
    discardBtn.click();
    await waitRender();

    const all = await repo.getAll();
    expect(all).toHaveLength(0);
    expect(document.body.querySelector('[data-cy="photo-toast"]')?.textContent).toBe('Ruta descartada');
    document.body.removeChild(cockpit);
  });

  it('cannot be dismissed with ESC or by clicking outside — parar obliga a decidir (AC-006)', async () => {
    const repo = new MemoryRouteRepository();
    const { cockpit, shadowRoot } = await mountCockpitWithRepo(repo);

    vi.useFakeTimers();
    try {
      await startAndLongPressStop(shadowRoot);
      const dialog = getSaveRouteDialog();

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      expect(document.body.querySelector('cockpit-save-route-dialog')).not.toBeNull();

      const overlay = dialog.shadowRoot!.querySelector('[data-cy="save-route-dialog-overlay"]') as HTMLElement;
      overlay.click();
      expect(document.body.querySelector('cockpit-save-route-dialog')).not.toBeNull();
    } finally {
      vi.useRealTimers();
    }
    document.body.removeChild(cockpit);
  });
});

describe('CockpitView - selección de GpsProvider nativo en Android (Fase 2, AC-020)', () => {
  beforeEach(() => {
    // El afterEach global del archivo hace vi.restoreAllMocks() tras cada test,
    // lo que borra el mockResolvedValue configurado en la factory de vi.mock()
    // para `listen` (un vi.fn() sin implementación "original" a la que volver).
    // Se re-configura aquí para que cada test de este describe arranque con un
    // listen() que devuelve una promesa válida, en vez de undefined.
    vi.mocked(listen).mockResolvedValue(vi.fn());
  });

  afterEach(() => {
    vi.mocked(isAndroidTauri).mockReturnValue(false);
  });

  it('uses the native GPS provider (subscribes to the Tauri location event) when isAndroidTauri() is true', async () => {
    vi.mocked(isAndroidTauri).mockReturnValue(true);

    const { cockpit, shadowRoot } = await mountCockpit();
    const masterBtn = shadowRoot.getElementById('cockpit-master-btn') as HTMLButtonElement;
    masterBtn.click();
    await waitRender();

    expect(listen).toHaveBeenCalledWith('recording-service://location', expect.any(Function));
    document.body.removeChild(cockpit);
  });

  it('keeps using navigator.geolocation.watchPosition when isAndroidTauri() is false (no regression)', async () => {
    vi.mocked(isAndroidTauri).mockReturnValue(false);
    const { cockpit, shadowRoot } = await mountCockpit();
    const masterBtn = shadowRoot.getElementById('cockpit-master-btn') as HTMLButtonElement;
    masterBtn.click();
    await waitRender();

    expect(navigator.geolocation.watchPosition).toHaveBeenCalled();
    document.body.removeChild(cockpit);
  });
});
