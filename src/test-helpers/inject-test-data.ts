/**
 * HELPER DE PRUEBA — se eliminará tras verificación visual en Android.
 *
 * Inyecta datos fake en SQLite para probar visualmente las features de
 * `mejoras-fotos-mapa`:
 *  - Una ruta `completed` con ~100 puntos GPS (trazado realista)
 *  - previewPolyline calculado para que se vea el SVG ámbar en el listado
 *  - 5 fotos fake distribuidas a lo largo del trazado, con blob URLs
 *    directamente (evita convertFileSrc de Tauri que puede fallar)
 *
 * No es código de producción. No tiene tests. Se borrará tras la verificación.
 */

import { SqliteRouteRepository } from '../shared/repositories/sqlite-route.repository.js';
import { createSqliteDb } from '../shared/repositories/sqlite-route.factory.js';
import { simplifyPolyline } from '../shared/services/route-polyline.service.js';
import type { CreateRoutePoint } from '../shared/models/route.types.js';

const TEST_ROUTE_ID = 'test-helper-route-001';

function generateTestPoints(): CreateRoutePoint[] {
  const centerLat = 40.42;
  const centerLng = -3.70;
  const points: CreateRoutePoint[] = [];
  const now = Date.now();

  for (let i = 0; i < 100; i++) {
    const t = i / 100;
    points.push({
      routeId: TEST_ROUTE_ID,
      timestamp: now + i * 1000,
      lat: centerLat + t * 0.02 + Math.sin(t * Math.PI * 4) * 0.003,
      lng: centerLng + t * 0.015 + Math.cos(t * Math.PI * 3) * 0.002,
      alt: 650 + Math.sin(t * Math.PI * 2) * 20,
      speed: 30 + Math.sin(t * Math.PI * 2) * 10,
    });
  }
  return points;
}

function getPhotoPoints(points: CreateRoutePoint[]): CreateRoutePoint[] {
  return [15, 35, 50, 70, 90].map((i) => points[i]!);
}

/** Crea un data URL base64 de 200x200 con un marcador numerado (persistente entre navegaciones) */
async function createFakePhotoDataUrl(index: number): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = 200;
  canvas.height = 200;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, 200, 200);
  ctx.fillStyle = '#ff8c00';
  ctx.beginPath();
  ctx.arc(100, 70, 40, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#000';
  ctx.font = 'bold 28px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`#${String(index + 1)}`, 100, 80);
  ctx.fillStyle = '#eee';
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('FOTO TEST', 100, 150);
  ctx.font = '10px sans-serif';
  ctx.fillStyle = '#aaa';
  ctx.textAlign = 'center';
  const pct = String((index + 1) * 20);
  ctx.fillText(`t=${pct}%`, 100, 175);
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      const reader = new FileReader();
      reader.onload = function (): void {
        resolve(reader.result as string);
      };
      reader.readAsDataURL(blob!);
    }, 'image/png');
  });
}

/**
 * Inyecta datos de prueba usando blob URLs para las fotos (evita el pipeline
 * de persistCapturedPhoto que depende de convertFileSrc de Tauri).
 * Las fotos se guardan en el repositorio con filePath = blob: URL y se registra
 * el blob en un registro interno para que URL.revokeObjectURL funcione.
 */
export async function injectTestData(): Promise<{ routeId: string }> {
  const db = await createSqliteDb();
  const repo = new SqliteRouteRepository(db);
  const points = generateTestPoints();
  const coords = points.map((p) => ({ lat: p.lat, lng: p.lng }));
  const previewPolyline = simplifyPolyline(coords);
  const duration = points.length;
  const totalDistance = 2.1;
  const avgSpeed = totalDistance / (duration / 3600);

  // 1. Crear la ruta
  await repo.save({
    id: TEST_ROUTE_ID, duration, totalDistance, avgSpeed,
    status: 'completed', visibility: 'private', origin: 'local',
  }, points, []);
  await repo.updatePreviewPolyline(TEST_ROUTE_ID, previewPolyline);

  // 2. Guardar fotos con data URLs (base64 — persistente entre navegaciones,
  //    a diferencia de blob: que muere al cambiar de vista)
  const photoPoints = getPhotoPoints(points);
  for (let i = 0; i < photoPoints.length; i++) {
    try {
      const dataUrl = await createFakePhotoDataUrl(i);
      const pt = photoPoints[i]!;

      const photoId = crypto.randomUUID();
      const now = new Date().toISOString();
      await db.execute(
        `INSERT INTO photos (id, route_id, file_path, latitude, longitude, captured_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [photoId, TEST_ROUTE_ID, dataUrl, pt.lat, pt.lng, now, now],
      );
    } catch (err) {
      console.warn(`Foto ${String(i)} no creada (no crítica):`, err);
    }
  }

  return { routeId: TEST_ROUTE_ID };
}

export async function removeTestData(): Promise<void> {
  const db = await createSqliteDb();
  await db.execute('DELETE FROM photos WHERE route_id = ?', [TEST_ROUTE_ID]);
  await db.execute('DELETE FROM routes WHERE id = ?', [TEST_ROUTE_ID]);
}
