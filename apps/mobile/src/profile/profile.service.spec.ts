import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { IProfileRepository } from '../shared/models/profile.repository.js';
import type { Profile, CreateProfile } from '../shared/models/profile.types.js';
import type { Route } from '../shared/models/route.types.js';
import { MemoryProfileRepository } from '../shared/repositories/memory-profile.repository.js';
import { MemoryRouteRepository } from '../shared/repositories/memory-route.repository.js';
import { savePhotoFile, getPhotoUrl } from '../shared/services/photo-storage.service.js';
import { fetchVehicleMakes, fetchVehicleModels } from './vpic.service.js';

vi.mock('../shared/services/photo-storage.service.js', () => ({
  savePhotoFile: vi.fn(),
  getPhotoUrl: vi.fn(),
}));

vi.mock('./vpic.service.js', () => ({
  fetchVehicleMakes: vi.fn(),
  fetchVehicleModels: vi.fn(),
}));

import { loadProfile, saveProfileInfo, saveVehicle, loadRouteStats, applyProfileEditResult } from './profile.service.js';

/** Repositorio de perfil fake mínimo, usado cuando el test necesita inspeccionar los
 * argumentos exactos pasados a `save()` sin depender del coalescido real de `MemoryProfileRepository`. */
function createFakeProfileRepository(overrides: Partial<IProfileRepository> = {}): IProfileRepository {
  return {
    get: vi.fn().mockResolvedValue(null),
    save: vi.fn().mockImplementation((patch: CreateProfile) => {
      const merged: Profile = {
        avatarPath: null,
        name: null,
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

  it('con repo.get() resolviendo null devuelve avatarUrl/name/vehicle a null, sin llamar a vpic.service (AC-024)', async () => {
    const repo = createFakeProfileRepository();

    const result = await loadProfile(repo);

    expect(result).toEqual({ avatarUrl: null, name: null, vehicle: null });
    expect(fetchVehicleMakes).not.toHaveBeenCalled();
    expect(fetchVehicleModels).not.toHaveBeenCalled();
  });

  it('con un perfil guardado que tiene avatarPath, resuelve avatarUrl llamando a getPhotoUrl (AC-013, AC-014)', async () => {
    vi.mocked(getPhotoUrl).mockResolvedValue('blob:resolved-avatar');
    const repo = createFakeProfileRepository({
      get: vi.fn().mockResolvedValue({
        avatarPath: '/app-data/photos/avatar.jpg',
        name: 'Marc',
        vehicleType: null,
        vehicleMake: null,
        vehicleModel: null,
      } satisfies Profile),
    });

    const result = await loadProfile(repo);

    expect(getPhotoUrl).toHaveBeenCalledWith('/app-data/photos/avatar.jpg');
    expect(result).toEqual({ avatarUrl: 'blob:resolved-avatar', name: 'Marc', vehicle: null });
  });

  it('devuelve vehicle: null si el perfil no tiene avatarPath (sin llamar a getPhotoUrl)', async () => {
    const repo = createFakeProfileRepository({
      get: vi.fn().mockResolvedValue({
        avatarPath: null,
        name: 'Marc',
        vehicleType: null,
        vehicleMake: null,
        vehicleModel: null,
      } satisfies Profile),
    });

    const result = await loadProfile(repo);

    expect(getPhotoUrl).not.toHaveBeenCalled();
    expect(result.avatarUrl).toBeNull();
  });

  it('vehicle es {vehicleType, vehicleMake, vehicleModel} si los tres campos están presentes', async () => {
    const repo = createFakeProfileRepository({
      get: vi.fn().mockResolvedValue({
        avatarPath: null,
        name: null,
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
        avatarPath: null,
        name: null,
        vehicleType: 'motorcycle',
        vehicleMake: null,
        vehicleModel: null,
      } satisfies Profile),
    });

    const result = await loadProfile(repo);

    expect(result.vehicle).toBeNull();
  });
});

describe('saveProfileInfo', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('con avatarFile, llama a savePhotoFile y luego a repo.save con avatarPath y el nombre saneado (AC-009)', async () => {
    vi.mocked(savePhotoFile).mockResolvedValue('/app-data/photos/new-avatar.jpg');
    const repo = createFakeProfileRepository();
    const file = new File(['x'], 'avatar.jpg', { type: 'image/jpeg' });

    await saveProfileInfo(repo, { avatarFile: file, rawName: '  Marc  ', currentAvatarPath: null });

    expect(savePhotoFile).toHaveBeenCalledWith(file);
    expect(repo.save).toHaveBeenCalledWith({ avatarPath: '/app-data/photos/new-avatar.jpg', name: 'Marc' });
  });

  it('con avatarFile null, no llama a savePhotoFile ni incluye avatarPath en el patch (conserva el existente por coalescido)', async () => {
    const repo = createFakeProfileRepository();

    await saveProfileInfo(repo, { avatarFile: null, rawName: 'Marc', currentAvatarPath: '/old/avatar.jpg' });

    expect(savePhotoFile).not.toHaveBeenCalled();
    const patch = vi.mocked(repo.save).mock.calls[0]?.[0] as CreateProfile;
    expect('avatarPath' in patch).toBe(false);
    expect(patch.name).toBe('Marc');
  });

  it('con rawName vacío o solo espacios, no incluye name en el patch, conservando el nombre previo — de extremo a extremo con MemoryProfileRepository real (AC-009, AC-010)', async () => {
    const repo = new MemoryProfileRepository();
    await repo.save({ name: 'Marc' });

    await saveProfileInfo(repo, { avatarFile: null, rawName: '   ', currentAvatarPath: null });

    const profile = await repo.get();
    expect(profile?.name).toBe('Marc');
  });

  it('propaga el rechazo de repo.save() sin capturarlo (AC-012, a nivel de propagación)', async () => {
    const dbError = new Error('fallo de BBDD');
    const repo = createFakeProfileRepository({ save: vi.fn().mockRejectedValue(dbError) });

    await expect(
      saveProfileInfo(repo, { avatarFile: null, rawName: 'Marc', currentAvatarPath: null }),
    ).rejects.toBe(dbError);
  });
});

describe('applyProfileEditResult', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('con avatarPath resuelto, lo incluye en el patch tal cual (sin volver a llamar a savePhotoFile) junto al nombre saneado (AC-009)', async () => {
    const repo = createFakeProfileRepository();

    await applyProfileEditResult(repo, { avatarPath: '/app-data/photos/new-avatar.jpg', name: '  Marc  ' });

    expect(savePhotoFile).not.toHaveBeenCalled();
    expect(repo.save).toHaveBeenCalledWith({ avatarPath: '/app-data/photos/new-avatar.jpg', name: 'Marc' });
  });

  it('con avatarPath null, no incluye avatarPath en el patch (conserva el existente por coalescido)', async () => {
    const repo = createFakeProfileRepository();

    await applyProfileEditResult(repo, { avatarPath: null, name: 'Marc' });

    const patch = vi.mocked(repo.save).mock.calls[0]?.[0] as CreateProfile;
    expect('avatarPath' in patch).toBe(false);
    expect(patch.name).toBe('Marc');
  });

  it('con name vacío o solo espacios, no incluye name en el patch, conservando el nombre previo — de extremo a extremo con MemoryProfileRepository real (AC-010)', async () => {
    const repo = new MemoryProfileRepository();
    await repo.save({ name: 'Marc' });

    await applyProfileEditResult(repo, { avatarPath: null, name: '   ' });

    const profile = await repo.get();
    expect(profile?.name).toBe('Marc');
  });
});

describe('saveVehicle', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('llama a repo.save() solo con los tres campos del vehículo, sin tocar avatarPath/name (AC-021, AC-022)', async () => {
    const repo = createFakeProfileRepository();

    await saveVehicle(repo, { vehicleType: 'car', vehicleMake: 'Seat', vehicleModel: 'Ibiza' });

    expect(repo.save).toHaveBeenCalledWith({
      vehicleType: 'car',
      vehicleMake: 'Seat',
      vehicleModel: 'Ibiza',
    });
    const patch = vi.mocked(repo.save).mock.calls[0]?.[0] as CreateProfile;
    expect('avatarPath' in patch).toBe(false);
    expect('name' in patch).toBe(false);
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
