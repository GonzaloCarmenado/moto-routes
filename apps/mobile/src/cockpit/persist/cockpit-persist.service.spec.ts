import { describe, it, expect, vi, beforeEach } from 'vitest';
import { persistRouteOnStop, persistRouteOnStart } from './cockpit-persist.service.js';
import type { IRouteRepository } from '../../shared/models/route.repository.js';
import type { CockpitState } from '../cockpit.types.js';

vi.mock('../../shared/feedback/toast.js', () => ({
  showToast: vi.fn(),
}));
import { showToast } from '../../shared/feedback/toast.js';

const BACKUP_KEY = 'moto-routes-pending-backup';

function flushPromises(): Promise<void> {
  return new Promise((resolve) => { setTimeout(resolve, 0); });
}

function createState(overrides: Partial<CockpitState> = {}): CockpitState {
  return {
    routeId: 'route-1',
    status: 'stopped',
    currentSpeed: 0,
    avgSpeed: 42,
    totalDistance: 12000,
    elapsedTime: 1800,
    altitude: 0,
    points: [
      { timestamp: 1000, lat: 40.4, lng: -3.7, alt: 650, speed: 30 },
      { timestamp: 2000, lat: 40.41, lng: -3.71, alt: 655, speed: 45 },
    ],
    stopState: 'idle',
    stopTimer: 0,
    manualStops: [
      { timestamp: 1500, lat: 40.405, lng: -3.705, stopCategoryId: 3 },
    ],
    hasGpsPermission: true,
    gpsSignalLost: false,
    gpsLostTimer: 0,
    ...overrides,
  } as CockpitState;
}

function createRepository(): IRouteRepository {
  return {
    save: vi.fn().mockResolvedValue({}),
    updatePreviewPolyline: vi.fn().mockResolvedValue(undefined),
    getById: vi.fn(),
  } as unknown as IRouteRepository;
}

describe('persistRouteOnStop', () => {
  beforeEach(() => {
    localStorage.removeItem(BACKUP_KEY);
    vi.mocked(showToast).mockReset();
  });

  it('does nothing when there is no repository', () => {
    expect(() => { persistRouteOnStop(undefined, createState(), 'Ruta de prueba'); }).not.toThrow();
  });

  it('saves the completed route with its points and manual stops, and updates the preview polyline', () => {
    const repository = createRepository();
    const state = createState();

    persistRouteOnStop(repository, state, 'Ruta de prueba');

    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'route-1',
        duration: 1800,
        totalDistance: 12000,
        avgSpeed: 42,
        status: 'completed',
        visibility: 'private',
        origin: 'local',
        name: 'Ruta de prueba',
      }),
      expect.arrayContaining([expect.objectContaining({ lat: 40.4, lng: -3.7 })]),
      expect.arrayContaining([expect.objectContaining({ stopCategoryId: 3, type: 'manual' })]),
    );
    expect(repository.updatePreviewPolyline).toHaveBeenCalledWith('route-1', expect.any(Array));
  });

  it('writes a localStorage backup when save() fails, without throwing', async () => {
    const repository = createRepository();
    (repository.save as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('db offline'));
    const state = createState();

    expect(() => { persistRouteOnStop(repository, state, 'Ruta de prueba'); }).not.toThrow();
    await flushPromises();

    const backup = localStorage.getItem(BACKUP_KEY);
    expect(backup).not.toBeNull();
    expect(JSON.parse(backup!)).toMatchObject({ route: { id: 'route-1', name: 'Ruta de prueba' } });
  });

  it('shows a visible error toast when save() fails, so the loss is never silent (bug real: rutas largas perdían todos sus puntos GPS sin ningún aviso)', async () => {
    const repository = createRepository();
    (repository.save as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('too many SQL variables'));
    const state = createState();

    persistRouteOnStop(repository, state, 'Ruta de prueba');
    await flushPromises();

    expect(showToast).toHaveBeenCalledWith(expect.stringContaining('No se pudo guardar'), 'error');
  });

  it('does not write a backup when only updatePreviewPolyline() fails (non-critical)', async () => {
    const repository = createRepository();
    (repository.updatePreviewPolyline as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('polyline failed'));
    const state = createState();

    persistRouteOnStop(repository, state, 'Ruta de prueba');
    await flushPromises();

    expect(localStorage.getItem(BACKUP_KEY)).toBeNull();
  });
});

describe('persistRouteOnStart', () => {
  it('does nothing when there is no repository', () => {
    expect(() => { persistRouteOnStart(undefined, createState()); }).not.toThrow();
  });

  it('inserts an active route row with no points or stops yet', () => {
    const repository = createRepository();
    const state = createState();

    persistRouteOnStart(repository, state);

    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'route-1', status: 'active', duration: 0, totalDistance: 0, avgSpeed: 0 }),
      [],
      [],
    );
  });

  it('does not throw when save() fails (persistRouteOnStop will retry the full insert later)', async () => {
    const repository = createRepository();
    (repository.save as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('db offline'));

    expect(() => { persistRouteOnStart(repository, createState()); }).not.toThrow();
    await flushPromises();
  });
});
