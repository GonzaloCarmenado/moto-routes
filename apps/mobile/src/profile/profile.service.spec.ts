import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { IProfileRepository } from '../shared/models/profile.repository.js';
import type { Profile, CreateProfile } from '../shared/models/profile.types.js';
import type { Route } from '../shared/models/route.types.js';
import { MemoryRouteRepository } from '../shared/repositories/memory-route.repository.js';
import { uploadAccountAvatar } from '../shared/http/avatar-api.service.js';
import { fetchVehicleMakes, fetchVehicleModels } from './vpic.service.js';

vi.mock('../shared/http/avatar-api.service.js', () => ({
  uploadAccountAvatar: vi.fn(),
}));

vi.mock('./vpic.service.js', () => ({
  fetchVehicleMakes: vi.fn(),
  fetchVehicleModels: vi.fn(),
}));

import { loadProfile, saveAccountAvatar, saveVehicle, loadRouteStats } from './profile.service.js';

/** Repositorio de perfil fake mínimo, usado cuando el test necesita inspeccionar los
 * argumentos exactos pasados a `save()` sin depender del coalescido real de `MemoryProfileRepository`. */
function createFakeProfileRepository(overrides: Partial<IProfileRepository> = {}): IProfileRepository {
  return {
    get: vi.fn().mockResolvedValue(null),
    save: vi.fn().mockImplementation((patch: CreateProfile) => {
      const merged: Profile = {
        vehicleType: null,
        vehicleMake: null,
        vehicleModel: null,
        ...patch,
      };
      return Promise.resolve(merged);
    }),
    ...overrides,
  };
}

function buildRoute(overrides: Partial<Route>): Route {
  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    duration: 0,
    totalDistance: 0,
    avgSpeed: 0,
    status: 'completed',
    visibility: 'private',
    origin: 'local',
    previewPolyline: null,
    name: null,
    notes: null,
    isFavorite: false,
    ...overrides,
  };
}

describe('loadProfile', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('con repo.get() resolviendo null devuelve vehicle a null, sin llamar a vpic.service (AC-024)', async () => {
    const repo = createFakeProfileRepository();

    const result = await loadProfile(repo);

    expect(result).toEqual({ vehicle: null });
    expect(fetchVehicleMakes).not.toHaveBeenCalled();
    expect(fetchVehicleModels).not.toHaveBeenCalled();
  });

  it('vehicle es {vehicleType, vehicleMake, vehicleModel} si los tres campos están presentes', async () => {
    const repo = createFakeProfileRepository({
      get: vi.fn().mockResolvedValue({
        vehicleType: 'motorcycle',
        vehicleMake: 'Honda',
        vehicleModel: 'CB500X',
      } satisfies Profile),
    });

    const result = await loadProfile(repo);

    expect(result.vehicle).toEqual({
      vehicleType: 'motorcycle',
      vehicleMake: 'Honda',
      vehicleModel: 'CB500X',
    });
  });

  it('vehicle es null si falta cualquiera de los tres campos del vehículo', async () => {
    const repo = createFakeProfileRepository({
      get: vi.fn().mockResolvedValue({
        vehicleType: 'motorcycle',
        vehicleMake: null,
        vehicleModel: null,
      } satisfies Profile),
    });

    const result = await loadProfile(repo);

    expect(result.vehicle).toBeNull();
  });
});

describe('saveAccountAvatar', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('sube el archivo a la cuenta vía uploadAccountAvatar, con su propio nombre de fichero', async () => {
    const file = new File(['x'], 'avatar.png', { type: 'image/png' });

    await saveAccountAvatar('http://localhost:8080', 'jwt-token', file);

    expect(uploadAccountAvatar).toHaveBeenCalledWith('http://localhost:8080', 'jwt-token', file, 'avatar.png');
  });

  it('propaga el rechazo de uploadAccountAvatar sin capturarlo', async () => {
    const uploadError = new Error('fallo de red');
    vi.mocked(uploadAccountAvatar).mockRejectedValue(uploadError);
    const file = new File(['x'], 'avatar.png', { type: 'image/png' });

    await expect(saveAccountAvatar('http://localhost:8080', 'jwt-token', file)).rejects.toBe(uploadError);
  });
});

describe('saveVehicle', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('llama a repo.save() solo con los tres campos del vehículo (AC-021, AC-022)', async () => {
    const repo = createFakeProfileRepository();

    await saveVehicle(repo, { vehicleType: 'car', vehicleMake: 'Seat', vehicleModel: 'Ibiza' });

    expect(repo.save).toHaveBeenCalledWith({
      vehicleType: 'car',
      vehicleMake: 'Seat',
      vehicleModel: 'Ibiza',
    });
  });
});

describe('loadRouteStats', () => {
  it('llama a routeRepo.getAll() y delega el cálculo en computeProfileStats, ignorando rutas no completadas', async () => {
    const routeRepo = new MemoryRouteRepository();
    routeRepo.seed([
      buildRoute({ status: 'completed', totalDistance: 20, avgSpeed: 40 }),
      buildRoute({ status: 'completed', totalDistance: 45, avgSpeed: 50 }),
      buildRoute({ status: 'completed', totalDistance: 120, avgSpeed: 80 }),
      buildRoute({ status: 'active', totalDistance: 999, avgSpeed: 999 }),
    ]);

    const stats = await loadRouteStats(routeRepo);

    expect(stats?.routeCount).toBe(3);
    expect(stats?.totalDistanceKm).toBe(185);
    expect(stats?.longestRoute.distanceKm).toBe(120);
  });

  it('devuelve null si no hay ninguna ruta completada', async () => {
    const routeRepo = new MemoryRouteRepository();
    routeRepo.seed([buildRoute({ status: 'active' })]);

    const stats = await loadRouteStats(routeRepo);

    expect(stats).toBeNull();
  });
});

describe('profile.service.ts — regla de diseño (AC-024/AC-026)', () => {
  it('no importa nada de vpic.service.ts — el servicio de perfil nunca decide llamar a la API externa', () => {
    const sourcePath = resolve(process.cwd(), 'src/profile/profile.service.ts');
    const source = readFileSync(sourcePath, 'utf8');
    const importLines = source
      .split('\n')
      .filter((line) => /^\s*import\b/.test(line));

    for (const line of importLines) {
      expect(line).not.toMatch(/vpic\.(service|types)/);
    }
  });
});
