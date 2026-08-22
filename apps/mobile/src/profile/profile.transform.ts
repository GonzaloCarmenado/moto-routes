/**
 * Funciones puras de transformación para el dominio `profile`: cálculo de
 * estadísticas agregadas a partir de las rutas ya cargadas. Sin dependencias
 * de repositorio, `Date` ni DOM — la carga de datos vive en
 * `profile.service.ts` (Paso 12). El nombre mostrado en Perfil ya no vive
 * aquí: es el `username` de la cuenta, sin saneado ni marcador de posición
 * propios (`unificar-perfil-cuenta`, ADR-055).
 */
import type { Route } from '../shared/models/index.js';
import { buildRouteDisplayName } from '../shared/utils/route-naming.js';

/** Estadísticas agregadas de todas las rutas completadas del usuario. */
export interface ProfileStats {
  /** Suma de `totalDistance` de todas las rutas completadas, en kilómetros. */
  totalDistanceKm: number;
  /** Suma de `duration` de todas las rutas completadas, en segundos. */
  totalDurationSeconds: number;
  /** Número de rutas completadas. */
  routeCount: number;
  /** Ruta completada con mayor distancia. */
  longestRoute: { name: string; distanceKm: number };
  /** Media aritmética simple de `avgSpeed` de las rutas completadas (AC-033). */
  avgSpeedHistoric: number;
}

/**
 * Calcula las estadísticas agregadas del Bloque 3 a partir de rutas ya
 * cargadas, considerando únicamente las de `status === 'completed'`
 * (AC-030). Devuelve `null` si no hay ninguna ruta completada (AC-031),
 * dejando el texto del estado vacío a cargo de `profile.element.ts`.
 * @param routes - Todas las rutas del usuario, de cualquier estado.
 * @returns Las estadísticas calculadas, o `null` si no hay rutas completadas.
 */
export function computeProfileStats(routes: Route[]): ProfileStats | null {
  const completed = routes.filter((route) => route.status === 'completed');
  if (completed.length === 0) return null;

  const totalDistanceKm = completed.reduce((sum, route) => sum + route.totalDistance, 0);
  const totalDurationSeconds = completed.reduce((sum, route) => sum + route.duration, 0);
  const avgSpeedHistoric =
    completed.reduce((sum, route) => sum + route.avgSpeed, 0) / completed.length;

  const longest = completed.reduce((max, route) =>
    route.totalDistance > max.totalDistance ? route : max,
  );

  return {
    totalDistanceKm,
    totalDurationSeconds,
    routeCount: completed.length,
    longestRoute: {
      name: buildRouteDisplayName(longest.name, longest.createdAt),
      distanceKm: longest.totalDistance,
    },
    avgSpeedHistoric,
  };
}
