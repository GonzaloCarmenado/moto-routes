import { describe, it, expect } from 'vitest';
import { applyListControls, type ListControls } from './route-list-filters.transform.js';
import type { RouteListItem } from './route-list-sync.transform.js';
import type { Route } from '../../shared/models/route.types.js';

function item(overrides: Partial<Route> & { syncState?: RouteListItem['syncState'] }): RouteListItem {
  const { syncState = 'local', ...routeOverrides } = overrides;
  const route: Route = {
    id: 'r1',
    createdAt: '2026-01-01T10:00:00.000Z',
    duration: 100,
    totalDistance: 10,
    avgSpeed: 50,
    status: 'completed',
    visibility: 'private',
    origin: 'local',
    previewPolyline: null,
    name: null,
    notes: null,
    isFavorite: false,
    ...routeOverrides,
  };
  return { route, syncState };
}

const defaultControls: ListControls = {
  showFavoritesOnly: false,
  showLocalOnly: false,
  showCloudOnly: false,
  searchQuery: '',
  sortBy: 'date',
};

describe('applyListControls', () => {
  it('returns every item unchanged when no control is active (default date order)', () => {
    const older = item({ id: 'a', createdAt: '2026-01-01T10:00:00.000Z' });
    const newer = item({ id: 'b', createdAt: '2026-01-02T10:00:00.000Z' });

    const result = applyListControls([older, newer], defaultControls);

    expect(result.map((i) => i.route.id)).toEqual(['b', 'a']);
  });

  it('filters by favoritas only', () => {
    const fav = item({ id: 'a', isFavorite: true });
    const normal = item({ id: 'b', isFavorite: false });

    const result = applyListControls([fav, normal], { ...defaultControls, showFavoritesOnly: true });

    expect(result.map((i) => i.route.id)).toEqual(['a']);
  });

  it('filters by "solo locales"', () => {
    const local = item({ id: 'a', syncState: 'local' });
    const synced = item({ id: 'b', syncState: 'synced' });
    const cloudOnly = item({ id: 'c', syncState: 'cloud-only' });

    const result = applyListControls([local, synced, cloudOnly], { ...defaultControls, showLocalOnly: true });

    expect(result.map((i) => i.route.id)).toEqual(['a']);
  });

  it('filters by "solo en la nube" (synced + cloud-only)', () => {
    const local = item({ id: 'a', syncState: 'local' });
    const synced = item({ id: 'b', syncState: 'synced' });
    const cloudOnly = item({ id: 'c', syncState: 'cloud-only' });

    const result = applyListControls([local, synced, cloudOnly], { ...defaultControls, showCloudOnly: true });

    expect(result.map((i) => i.route.id)).toEqual(['b', 'c']);
  });

  it('combining "solo locales" and "solo en la nube" yields no results (no state is both)', () => {
    const local = item({ id: 'a', syncState: 'local' });
    const synced = item({ id: 'b', syncState: 'synced' });

    const result = applyListControls([local, synced], { ...defaultControls, showLocalOnly: true, showCloudOnly: true });

    expect(result).toEqual([]);
  });

  it('filters by search query, case-insensitive, matching the displayed name', () => {
    const malaga = item({ id: 'a', name: 'Ruta a Málaga' });
    const otra = item({ id: 'b', name: 'Otra ruta' });

    const result = applyListControls([malaga, otra], { ...defaultControls, searchQuery: 'málaga' });

    expect(result.map((i) => i.route.id)).toEqual(['a']);
  });

  it('search matches the fallback display name for a route with name: null', () => {
    const withoutName = item({ id: 'a', name: null, createdAt: '2026-03-05T10:00:00.000Z' });

    const result = applyListControls([withoutName], { ...defaultControls, searchQuery: 'ruta' });

    expect(result.map((i) => i.route.id)).toEqual(['a']);
  });

  it('a search query matching nothing returns an empty array', () => {
    const route = item({ id: 'a', name: 'Ruta al norte' });

    const result = applyListControls([route], { ...defaultControls, searchQuery: 'inexistente' });

    expect(result).toEqual([]);
  });

  it('sorts by name (A-Z, locale-aware) when sortBy is "name"', () => {
    const zeta = item({ id: 'a', name: 'Zeta' });
    const alfa = item({ id: 'b', name: 'Álvarez' });

    const result = applyListControls([zeta, alfa], { ...defaultControls, sortBy: 'name' });

    expect(result.map((i) => i.route.id)).toEqual(['b', 'a']);
  });

  it('applies sorting on top of the already-filtered result, not the full list', () => {
    const fav = item({ id: 'a', isFavorite: true, name: 'Zeta favorita' });
    const favB = item({ id: 'b', isFavorite: true, name: 'Alfa favorita' });
    const notFav = item({ id: 'c', isFavorite: false, name: 'AAA no favorita' });

    const result = applyListControls([fav, favB, notFav], {
      ...defaultControls,
      showFavoritesOnly: true,
      sortBy: 'name',
    });

    expect(result.map((i) => i.route.id)).toEqual(['b', 'a']);
  });
});
