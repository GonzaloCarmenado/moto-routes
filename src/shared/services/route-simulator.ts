import type { IRouteRepository } from '../models/route.repository.js';
import type { CreateRoute, CreateRoutePoint, CreateRouteStop } from '../models/route.types.js';

/**
 * Genera datos GPS falsos y los guarda en el repositorio.
 * Aislado y fácil de eliminar: solo se importa desde un botón temporal.
 */
export async function simulateRecording(repo: IRouteRepository): Promise<{ routeName: string; pointCount: number }> {
  const duration = Math.floor(Math.random() * 600) + 300; // 5-15 minutos en segundos
  const pointCount = duration; // 1 punto por segundo aprox
  const avgSpeed = Math.floor(Math.random() * 40) + 30; // 30-70 km/h

  // Coordenadas base: Madrid centro
  const baseLat = 40.4168 + (Math.random() - 0.5) * 0.05;
  const baseLng = -3.7038 + (Math.random() - 0.5) * 0.05;

  const route: CreateRoute = {
    duration,
    totalDistance: (avgSpeed * duration) / 3600, // km
    avgSpeed,
    status: 'completed',
    visibility: 'private',
    origin: 'local',
  };

  const routeId = crypto.randomUUID();

  const points: CreateRoutePoint[] = [];
  for (let i = 0; i < pointCount; i++) {
    // Simular movimiento: desplazamiento incremental con algo de ruido
    const lat = baseLat + i * 0.00005 + (Math.random() - 0.5) * 0.0001;
    const lng = baseLng + i * 0.00005 + (Math.random() - 0.5) * 0.0001;
    const speed = avgSpeed + (Math.random() - 0.5) * 20;
    points.push({
      routeId,
      timestamp: Date.now() + i * 1000,
      lat,
      lng,
      alt: 650 + Math.random() * 50,
      speed: Math.max(0, speed),
    });
  }

  // Generar 1-3 paradas aleatorias
  const stops: CreateRouteStop[] = [];
  const stopCount = Math.floor(Math.random() * 3) + 1;
  for (let i = 0; i < stopCount; i++) {
    const stopTime = Math.floor(Math.random() * duration);
    const stopIdx = stopTime;
    stops.push({
      routeId,
      startTime: points[Math.min(stopIdx, points.length - 1)]?.timestamp ?? Date.now(),
      endTime: (points[Math.min(stopIdx + 30, points.length - 1)]?.timestamp ?? Date.now()) + 60000,
      lat: baseLat + stopIdx * 0.0001,
      lng: baseLng + stopIdx * 0.0001,
      type: 'auto',
    });
  }

  const saved = await repo.save(route, points, stops);
  return {
    routeName: `Simulación ${new Date(saved.createdAt).toLocaleTimeString()}`,
    pointCount: points.length,
  };
}