import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { applyCypressSeed } from './app-seed.service.js';
import { MemoryRouteRepository } from '../shared/repositories/memory-route.repository.js';
import { MemoryProfileRepository } from '../shared/repositories/memory-profile.repository.js';
import type { Route } from '../shared/models/route.types.js';
import type { Profile } from '../shared/models/profile.types.js';

const SEED_KEY = 'cypress-seed-routes';

function buildRoute(id: string): Route {
  return {
    id,
    createdAt: '2026-01-01T00:00:00.000Z',
    duration: 100,
    totalDistance: 5,
    avgSpeed: 20,
    status: 'completed',
    visibility: 'private',
    origin: 'local',
    previewPolyline: null,
    name: null,
    notes: null,
    isFavorite: false,
  };
}

describe('applyCypressSeed', () => {
  beforeEach(() => {
    localStorage.clear();
    delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
  });

  afterEach(() => {
    localStorage.clear();
    delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
  });

  it('calls repo.seed() with the parsed data when isTauri() is false and localStorage has valid JSON with 2 routes (AC-008)', () => {
    const routeA = buildRoute('route-a');
    const routeB = buildRoute('route-b');
    localStorage.setItem(SEED_KEY, JSON.stringify({ routes: [routeA, routeB] }));

    const repo = new MemoryRouteRepository();
    const seedSpy = vi.spyOn(repo, 'seed');

    applyCypressSeed(repo);

    expect(seedSpy).toHaveBeenCalledWith([routeA, routeB], undefined, undefined);
  });

  it('does not call repo.seed() when the "cypress-seed-routes" key is absent, without throwing (AC-009)', () => {
    const repo = new MemoryRouteRepository();
    const seedSpy = vi.spyOn(repo, 'seed');

    expect(() => { applyCypressSeed(repo); }).not.toThrow();
    expect(seedSpy).not.toHaveBeenCalled();
  });

  it('does not call repo.seed() when localStorage has corrupted JSON (AC-009)', () => {
    localStorage.setItem(SEED_KEY, '{not json');
    const repo = new MemoryRouteRepository();
    const seedSpy = vi.spyOn(repo, 'seed');

    expect(() => { applyCypressSeed(repo); }).not.toThrow();
    expect(seedSpy).not.toHaveBeenCalled();
  });

  it('does not call repo.seed() when routes is an empty array (AC-009)', () => {
    localStorage.setItem(SEED_KEY, JSON.stringify({ routes: [] }));
    const repo = new MemoryRouteRepository();
    const seedSpy = vi.spyOn(repo, 'seed');

    applyCypressSeed(repo);

    expect(seedSpy).not.toHaveBeenCalled();
  });

  it('never reads localStorage nor calls repo.seed() when isTauri() is true, even with a valid seed key present (AC-010)', () => {
    (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {};
    localStorage.setItem(SEED_KEY, JSON.stringify({ routes: [buildRoute('route-a')] }));
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem');
    const repo = new MemoryRouteRepository();
    const seedSpy = vi.spyOn(repo, 'seed');
    const profileRepo = new MemoryProfileRepository();

    applyCypressSeed(repo, profileRepo);

    expect(getItemSpy).not.toHaveBeenCalled();
    expect(seedSpy).not.toHaveBeenCalled();
  });

  it('seeds the profile repository when the seed JSON includes a profile', () => {
    const profile: Profile = {
      vehicleType: 'motorcycle',
      vehicleMake: 'Honda',
      vehicleModel: 'CB500X',
    };
    localStorage.setItem(SEED_KEY, JSON.stringify({ routes: [], profile }));
    const repo = new MemoryRouteRepository();
    const profileRepo = new MemoryProfileRepository();

    applyCypressSeed(repo, profileRepo);

    void profileRepo.get().then((saved) => {
      expect(saved).toEqual(profile);
    });
  });

  it('does not seed the profile repository when the seed JSON has no profile', () => {
    localStorage.setItem(SEED_KEY, JSON.stringify({ routes: [] }));
    const repo = new MemoryRouteRepository();
    const profileRepo = new MemoryProfileRepository();
    const seedSpy = vi.spyOn(profileRepo, 'seed');

    applyCypressSeed(repo, profileRepo);

    expect(seedSpy).not.toHaveBeenCalled();
  });

  it('does not seed the profile repository when the seed key is absent', () => {
    const repo = new MemoryRouteRepository();
    const profileRepo = new MemoryProfileRepository();
    const seedSpy = vi.spyOn(profileRepo, 'seed');

    applyCypressSeed(repo, profileRepo);

    expect(seedSpy).not.toHaveBeenCalled();
  });
});
