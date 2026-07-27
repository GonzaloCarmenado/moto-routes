/**
 * Funciones de transformación y cálculo para telemetría del Cockpit.
 * Son funciones puras, sin efectos secundarios, fácilmente testeables.
 */

import type { StopDetectionState, CockpitState } from './cockpit.types.js';

const EARTH_RADIUS_KM = 6371;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Calcula la distancia entre dos puntos GPS usando la fórmula Haversine.
 * Devuelve la distancia en kilómetros.
 */
export function calculateDistance(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const sinHalfDLat = Math.sin(dLat / 2);
  const sinHalfDLng = Math.sin(dLng / 2);
  const haversine =
    sinHalfDLat * sinHalfDLat +
    Math.cos(lat1) * Math.cos(lat2) * sinHalfDLng * sinHalfDLng;

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(haversine));
}

/**
 * Formatea segundos a formato MM:SS o HH:MM:SS.
 */
export function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (n: number): string => String(n).padStart(2, '0');

  if (hours > 0) {
    return `${String(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(minutes)}:${pad(seconds)}`;
}

/**
 * Calcula la velocidad media en km/h.
 */
export function calculateAvgSpeed(distanceKm: number, timeSeconds: number): number {
  if (timeSeconds <= 0) return 0;
  return (distanceKm / timeSeconds) * 3600;
}

/**
 * Formatea la velocidad como entero para mostrar en el dial.
 */
export function formatSpeed(speedKmh: number): string {
  return String(Math.round(speedKmh));
}

const ROUTE_NAME_MAX_LENGTH = 100;

/**
 * Recorta espacios en los extremos y trunca al límite de 100 caracteres
 * (AC-003, AC-009). No decide el fallback por defecto — un resultado vacío
 * es responsabilidad del llamador (ver `buildDefaultRouteName`).
 */
export function sanitizeRouteName(raw: string): string {
  return raw.trim().slice(0, ROUTE_NAME_MAX_LENGTH);
}

/**
 * Nombre por defecto cuando el usuario no escribe ninguno al guardar (AC-002):
 * "Ruta {día} {mes abreviado} {año}, {hora}:{minuto}" — mismo formato de fecha
 * ya usado en el listado de rutas, combinado con la hora para distinguir varias
 * rutas guardadas el mismo día.
 */
export function buildDefaultRouteName(dateIso: string): string {
  const date = new Date(dateIso);
  const datePart = date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
  const timePart = date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  return `Ruta ${datePart}, ${timePart}`;
}

export interface CockpitDisplayValues {
  speed: string;
  avgSpeed: string;
  dist: string;
  time: string;
  alt: string;
}

/** Formatea los valores en bruto del estado del cockpit para mostrarlos en pantalla. */
export function getCockpitDisplayValues(state: CockpitState | undefined): CockpitDisplayValues {
  if (!state) return { speed: '0', avgSpeed: '--', dist: '--', time: '--:--', alt: '--' };
  return {
    speed: formatSpeed(state.currentSpeed),
    avgSpeed: state.avgSpeed.toFixed(0),
    dist: state.totalDistance.toFixed(1),
    time: formatDuration(state.elapsedTime),
    alt: state.altitude.toFixed(0),
  };
}

/** Clase CSS del chip de estado según el status de grabación. */
export function getStatusChipClass(status: CockpitState['status'] | undefined): string {
  if (status === 'recording') return 'chip-recording';
  if (status === 'paused') return 'chip-paused';
  return 'chip-neutral';
}

/** Etiqueta del chip de estado según el status de grabación. */
export function getStatusChipLabel(status: CockpitState['status'] | undefined): string {
  if (status === 'recording') return 'En ruta';
  if (status === 'paused') return 'Pausada';
  return 'Listo';
}

/**
 * Algoritmo conservativo de detección de paradas.
 *
 * - Velocidad < 3 km/h → estado "possible-stop", contador++
 * - Contador < 30s y velocidad > 3 km/h → reset (era semáforo)
 * - Contador >= 30s y velocidad < 3 km/h → "confirmed-stop"
 * - Sin dato GPS (undefined) → no resetea, solo incrementa contador
 */
export function detectStop(
  speedKmh: number | undefined,
  timer: number,
  currentState: StopDetectionState,
): { state: StopDetectionState; timer: number } {
  const speed = speedKmh ?? -1; // undefined = sin señal, no reseteamos

  // Sin dato de velocidad: solo incrementamos timer, no reseteamos
  if (speedKmh === undefined) {
    return { state: currentState, timer: timer + 1 };
  }

  // Móvil o reanudando tras parada confirmada
  if (speed > 3) {
    if (currentState === 'confirmed-stop') {
      return { state: 'moving', timer: 0 };
    }
    if (currentState === 'possible-stop') {
      return { state: 'moving', timer: 0 };
    }
    return { state: 'moving', timer: 0 };
  }

  // Velocidad <= 3 km/h
  const newTimer = timer + 1;

  if (currentState === 'confirmed-stop') {
    return { state: 'confirmed-stop', timer: newTimer };
  }

  if (newTimer >= 30) {
    return { state: 'confirmed-stop', timer: newTimer };
  }

  return { state: 'possible-stop', timer: newTimer };
}