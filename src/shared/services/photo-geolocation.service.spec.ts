import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Mock de exifr para que no haya dependencia real.
 * Ponemos parse en la raíz del módulo porque la implementación
 * hace `import('exifr')` y accede a `.parse` directamente.
 */
const mockParse = vi.fn();
vi.mock('exifr', () => ({
  parse: mockParse,
}));

import { extractPhotoLocation } from './photo-geolocation.service.js';

describe('extractPhotoLocation', () => {
  beforeEach(() => {
    mockParse.mockReset();
  });

  it('debería devolver coordenadas EXIF si la imagen tiene GPS', async () => {
    mockParse.mockResolvedValue({
      latitude: 40.416775,
      longitude: -3.70379,
    });

    const result = await extractPhotoLocation(new File([], 'test.jpg'));
    expect(result).toEqual({ lat: 40.416775, lng: -3.70379 });
  });

  it('debería devolver null si EXIF no tiene GPS', async () => {
    mockParse.mockResolvedValue(undefined);

    const result = await extractPhotoLocation(new File([], 'test.jpg'));
    expect(result).toBeNull();
  });

  it('debería usar el fallbackPoint si EXIF no tiene GPS y se proporciona', async () => {
    mockParse.mockResolvedValue(undefined);

    const result = await extractPhotoLocation(new File([], 'test.jpg'), {
      lat: 41.3874,
      lng: 2.1686,
    });
    expect(result).toEqual({ lat: 41.3874, lng: 2.1686 });
  });

  it('debería usar el centroide de routePoints si no hay EXIF ni fallbackPoint', async () => {
    mockParse.mockResolvedValue(undefined);

    const routePoints = [
      { lat: 40.41, lng: -3.7 },
      { lat: 40.42, lng: -3.71 },
      { lat: 40.43, lng: -3.72 },
    ];

    const result = await extractPhotoLocation(
      new File([], 'test.jpg'),
      undefined,
      routePoints,
    );

    // Centroide: (40.41 + 40.42 + 40.43) / 3 ≈ 40.42
    //            (-3.7 + -3.71 + -3.72) / 3 ≈ -3.71
    expect(result).not.toBeNull();
    expect(result!.lat).toBeCloseTo(40.42, 2);
    expect(result!.lng).toBeCloseTo(-3.71, 2);
  });

  it('debería devolver null si no hay EXIF, ni fallbackPoint, ni routePoints', async () => {
    mockParse.mockResolvedValue(undefined);

    const result = await extractPhotoLocation(new File([], 'test.jpg'));
    expect(result).toBeNull();
  });

  it('debería hacer fallback si EXIF devuelve coordenadas inválidas (lat fuera de rango)', async () => {
    mockParse.mockResolvedValue({
      latitude: 200, // inválido
      longitude: -3.70379,
    });

    const result = await extractPhotoLocation(new File([], 'test.jpg'), {
      lat: 41.3874,
      lng: 2.1686,
    });
    // Debería fallback al fallbackPoint por coordenadas inválidas
    expect(result).toEqual({ lat: 41.3874, lng: 2.1686 });
  });

  it('debería tratar coordenadas null como ausencia de GPS', async () => {
    mockParse.mockResolvedValue({
      latitude: null,
      longitude: null,
    });

    const result = await extractPhotoLocation(new File([], 'test.jpg'), {
      lat: 41.3874,
      lng: 2.1686,
    });
    expect(result).toEqual({ lat: 41.3874, lng: 2.1686 });
  });

  it('debería devolver null si routePoints está vacío y no hay otras fuentes', async () => {
    mockParse.mockResolvedValue(undefined);

    const result = await extractPhotoLocation(
      new File([], 'test.jpg'),
      undefined,
      [],
    );
    expect(result).toBeNull();
  });
});