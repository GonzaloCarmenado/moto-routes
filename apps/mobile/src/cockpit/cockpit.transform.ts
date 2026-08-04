/**
 * Funciones de transformación y cálculo para telemetría del Cockpit.
 * Son funciones puras, sin efectos secundarios, fácilmente testeables.
 */

import type { StopDetectionState, CockpitState, RoutePoint } from './cockpit.types.js';
import { formatDuration } from '../shared/utils/format.js';
import { sanitizeText } from '../shared/utils/text.js';

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
 * es responsabilidad del llamador (ver `buildDefaultRouteName`). Wrapper
 * fino sobre `sanitizeText` (`shared/utils/text.ts`), que generaliza esta
 * misma regla para otros dominios (p. ej. `profile`).
 */
export function sanitizeRouteName(raw: string): string {
  return sanitizeText(raw, ROUTE_NAME_MAX_LENGTH);
}

/** Valores formateados para mostrar en pantalla (speed/avgSpeed/dist/time/alt). */
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
 *
 * Única función de este archivo que se sigue importando desde fuera de
 * `cockpit/` (por `route-timeline.transform.ts`): depende de
 * `StopDetectionState`, un tipo específico del dominio cockpit, así que no
 * se movió a `shared/` junto al resto. Excepción admitida por AC-001 de
 * `specs/features/deuda-tecnica-auditoria.md` — no usarla como precedente
 * para nuevos imports cruzados `routes` → `cockpit`.
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

/** Contexto derivado del estado para asociar una foto capturada en pleno directo a su ruta y ubicación. */
export interface PhotoCaptureContext {
  routeId: string;
  lastPoint: RoutePoint | null;
  routePoints: { lat: number; lng: number }[];
}

/**
 * Deriva de qué ruta y ubicación depende una foto capturada durante la
 * grabación: el `routeId` pre-generado al empezar (ver `CockpitState.routeId`)
 * y el último punto GPS conocido, para no asociar la foto a una posición vieja.
 */
export function buildPhotoCaptureContext(state: CockpitState): PhotoCaptureContext {
  return {
    routeId: state.routeId,
    lastPoint: state.points.length > 0 ? state.points[state.points.length - 1]! : null,
    routePoints: state.points.map((p) => ({ lat: p.lat, lng: p.lng })),
  };
}