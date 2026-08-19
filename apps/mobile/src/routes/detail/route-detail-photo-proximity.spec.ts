import { describe, it, expect } from 'vitest';
import { groupPhotosByProximity } from './route-detail-photo-proximity.js';
import type { PhotoWithUrl } from './route-detail.types.js';

function makePhoto(id: string, lat: number, lng: number, capturedAt: string): PhotoWithUrl {
  return {
    id,
    routeId: 'route-1',
    filePath: `photos/${id}.jpg`,
    latitude: lat,
    longitude: lng,
    capturedAt,
    createdAt: capturedAt,
    remotePhotoId: null,
    objectUrl: `blob:${id}`,
  };
}

describe('groupPhotosByProximity', () => {
  it('groups the clicked photo with its GPS-nearby photos, excluding a distant zone', () => {
    const lunch = [
      makePhoto('l1', 40.4168, -3.7038, '2026-07-20T10:00:00.000Z'),
      makePhoto('l2', 40.41681, -3.70381, '2026-07-20T10:05:00.000Z'),
    ];
    const viewpoint = [makePhoto('v1', 40.4213, -3.7038, '2026-07-20T11:00:00.000Z')];

    const result = groupPhotosByProximity([...lunch, ...viewpoint], 'l1');

    expect(result.photos.map((p) => p.id).sort()).toEqual(['l1', 'l2']);
  });

  it('sorts the group with the most recently captured photo first', () => {
    const older = makePhoto('a', 40.4168, -3.7038, '2026-07-20T10:00:00.000Z');
    const newer = makePhoto('b', 40.41681, -3.70381, '2026-07-20T10:05:00.000Z');

    const result = groupPhotosByProximity([older, newer], 'a');

    expect(result.photos.map((p) => p.id)).toEqual(['b', 'a']);
    expect(result.startIndex).toBe(1);
  });

  it('returns a single-photo group when nothing else is within 75m', () => {
    const isolated = makePhoto('a', 40.4168, -3.7038, '2026-07-20T10:00:00.000Z');
    const farAway = makePhoto('b', 40.43, -3.72, '2026-07-20T11:00:00.000Z');

    const result = groupPhotosByProximity([isolated, farAway], 'a');

    expect(result.photos).toEqual([isolated]);
    expect(result.startIndex).toBe(0);
  });
});
