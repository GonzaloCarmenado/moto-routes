import { describe, it, expect, vi, afterEach } from 'vitest';
import { uploadRoute, fetchCloudRoutes, fetchCloudRouteDetail, exportRouteGPX, RouteCloudApiError } from './route-cloud-api.service.js';
import type { Route, RoutePoint, RouteStop } from '../models/route.types.js';

const BASE_URL = 'http://localhost:8080';
const TOKEN = 'jwt-token';

function stubFetch(response: { ok: boolean; status: number; json: () => Promise<unknown> }): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const sampleRoute: Route = {
  id: 'route-1',
  createdAt: '2026-08-07T10:00:00.000Z',
  duration: 60,
  totalDistance: 10,
  avgSpeed: 30,
  status: 'completed',
  visibility: 'private',
  origin: 'local',
  previewPolyline: null,
  name: 'Ruta de prueba',
  notes: null,
  isFavorite: true,
};

const samplePoints: RoutePoint[] = [
  { id: 'p1', routeId: 'route-1', timestamp: 1000, lat: 40.1, lng: -3.1, alt: 600, speed: 10 },
];

const sampleStops: RouteStop[] = [
  { id: 's1', routeId: 'route-1', startTime: 1500, endTime: 1600, lat: 40.15, lng: -3.15, type: 'manual', stopCategoryId: 1 },
];

describe('uploadRoute', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('envía la ruta, sus puntos y paradas en snake_case con el Bearer del token', async () => {
    const fetchMock = stubFetch({ ok: true, status: 200, json: () => Promise.resolve({ id: 'route-1' }) });

    await uploadRoute(BASE_URL, TOKEN, { route: sampleRoute, points: samplePoints, stops: sampleStops });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${BASE_URL}/api/routes`);
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer jwt-token');
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body['id']).toBe('route-1');
    expect(body['total_distance']).toBe(10);
    expect(body['is_favorite']).toBe(true);
    expect((body['points'] as unknown[])[0]).toMatchObject({ timestamp: 1000, lat: 40.1 });
    expect((body['stops'] as unknown[])[0]).toMatchObject({ start_time: 1500, stop_category_id: 1 });
  });

  it('lanza RouteCloudApiError kind "too-many-points" en 400', async () => {
    stubFetch({ ok: false, status: 400, json: () => Promise.resolve({ error: 'route exceeds the maximum number of points' }) });

    const promise = uploadRoute(BASE_URL, TOKEN, { route: sampleRoute, points: samplePoints, stops: sampleStops });

    await expect(promise).rejects.toBeInstanceOf(RouteCloudApiError);
    await expect(promise).rejects.toMatchObject({ kind: 'too-many-points' });
  });

  it('lanza RouteCloudApiError kind "unauthorized" en 401', async () => {
    stubFetch({ ok: false, status: 401, json: () => Promise.resolve({ error: 'missing or invalid token' }) });

    const promise = uploadRoute(BASE_URL, TOKEN, { route: sampleRoute, points: samplePoints, stops: sampleStops });

    await expect(promise).rejects.toMatchObject({ kind: 'unauthorized' });
  });

  it('lanza RouteCloudApiError kind "network" sin conexión', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

    const promise = uploadRoute(BASE_URL, TOKEN, { route: sampleRoute, points: samplePoints, stops: sampleStops });

    await expect(promise).rejects.toMatchObject({ kind: 'network' });
  });
});

describe('fetchCloudRoutes', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('mapea el resumen de rutas de snake_case a camelCase', async () => {
    stubFetch({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve([
          { id: 'route-1', created_at: '2026-08-07T10:00:00.000Z', duration: 60, total_distance: 10, avg_speed: 30, status: 'completed', name: null, notes: null, is_favorite: true },
        ]),
    });

    const result = await fetchCloudRoutes(BASE_URL, TOKEN);

    expect(result).toEqual([
      { id: 'route-1', createdAt: '2026-08-07T10:00:00.000Z', duration: 60, totalDistance: 10, avgSpeed: 30, status: 'completed', name: null, notes: null, isFavorite: true },
    ]);
  });

  it('devuelve una lista vacía si el usuario no ha subido nada', async () => {
    stubFetch({ ok: true, status: 200, json: () => Promise.resolve([]) });

    const result = await fetchCloudRoutes(BASE_URL, TOKEN);

    expect(result).toEqual([]);
  });
});

describe('fetchCloudRouteDetail', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('mapea el detalle completo (puntos+paradas) de snake_case a camelCase', async () => {
    stubFetch({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          id: 'route-1',
          created_at: '2026-08-07T10:00:00.000Z',
          duration: 60,
          total_distance: 10,
          avg_speed: 30,
          status: 'completed',
          name: null,
          notes: null,
          is_favorite: true,
          points: [{ timestamp: 1000, lat: 40.1, lng: -3.1, alt: 600, speed: 10 }],
          stops: [{ start_time: 1500, end_time: 1600, lat: 40.15, lng: -3.15, type: 'manual', stop_category_id: 1 }],
        }),
    });

    const result = await fetchCloudRouteDetail(BASE_URL, TOKEN, 'route-1');

    expect(result.points).toEqual([{ timestamp: 1000, lat: 40.1, lng: -3.1, alt: 600, speed: 10 }]);
    expect(result.stops).toEqual([{ startTime: 1500, endTime: 1600, lat: 40.15, lng: -3.15, type: 'manual', stopCategoryId: 1 }]);
    expect(result.isFavorite).toBe(true);
  });

  it('lanza RouteCloudApiError en 404 (no existe o es de otra cuenta)', async () => {
    stubFetch({ ok: false, status: 404, json: () => Promise.resolve({ error: 'route not found' }) });

    const promise = fetchCloudRouteDetail(BASE_URL, TOKEN, 'unknown');

    await expect(promise).rejects.toMatchObject({ kind: 'not-found' });
  });
});

describe('exportRouteGPX', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('descarga el GPX con el Bearer del token', async () => {
    const gpxBlob = new Blob(['<gpx></gpx>'], { type: 'application/gpx+xml' });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, blob: () => Promise.resolve(gpxBlob) });
    vi.stubGlobal('fetch', fetchMock);

    const result = await exportRouteGPX(BASE_URL, TOKEN, 'route-1');

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${BASE_URL}/api/routes/route-1/export.gpx`);
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer jwt-token');
    expect(result).toBe(gpxBlob);
  });

  it('lanza RouteCloudApiError kind "not-found" en 404', async () => {
    stubFetch({ ok: false, status: 404, json: () => Promise.resolve({ error: 'route not found' }) });

    const promise = exportRouteGPX(BASE_URL, TOKEN, 'unknown');

    await expect(promise).rejects.toBeInstanceOf(RouteCloudApiError);
    await expect(promise).rejects.toMatchObject({ kind: 'not-found' });
  });

  it('lanza RouteCloudApiError kind "network" sin conexión', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

    const promise = exportRouteGPX(BASE_URL, TOKEN, 'route-1');

    await expect(promise).rejects.toMatchObject({ kind: 'network' });
  });

  it('lanza RouteCloudApiError con el mensaje del servidor si el body de error no es JSON', async () => {
    stubFetch({
      ok: false,
      status: 400,
      json: () => Promise.reject(new Error('not json')),
    });

    const promise = exportRouteGPX(BASE_URL, TOKEN, 'route-1');

    await expect(promise).rejects.toMatchObject({ kind: 'unknown' });
  });
});
