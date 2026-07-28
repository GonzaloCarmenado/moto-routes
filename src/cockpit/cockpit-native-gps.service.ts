/**
 * GpsProvider cuya fuente de watchPosition() es la captura de ubicación nativa
 * del foreground service Android (RecordingService.kt vía FusedLocationProviderClient/
 * LocationManager), reenviada por el puente Kotlin -> Rust -> JS como el evento
 * Tauri `recording-service://location` (ver recording_service.rs).
 *
 * Se usa en lugar de `navigator.geolocation.watchPosition()` porque Chromium puede
 * pausar/limitar el WebView en segundo plano aunque el proceso Android siga vivo
 * (ver AC-011/AC-020 corregidos en la spec de grabacion-rutas, Fase 2).
 *
 * getCurrentPosition()/checkPermissions()/requestPermissions() son operaciones
 * "one-shot" sin el problema de segundo plano, así que delegan directamente en un
 * GpsProvider de fallback (normalmente el de navegador) en vez de nativizarse.
 */
import { listen } from '@tauri-apps/api/event';
import { isTauri } from '../shared/services/photo-capture-adapter.service.js';
import type { GpsProvider } from './cockpit.service.js';

export const NATIVE_LOCATION_EVENT = 'recording-service://location';

/**
 * Payload crudo que cruza el puente Kotlin -> Rust -> JS. Deliberadamente distinto
 * de `RoutePoint` (cockpit.types.ts): `RoutePoint.speed` ya está en km/h (post
 * conversión) en el resto del dominio, mientras que `speed` aquí llega en m/s crudo
 * (igual que `Location.speed` de Android / `GeolocationCoordinates.speed`).
 * Reutilizar `RoutePoint` para el wire format introduciría un bug de doble conversión.
 */
export interface NativeLocationEvent {
  lat: number;
  lng: number;
  alt: number;
  speed: number;
  timestamp: number;
}

/**
 * Fabrica un objeto compatible con GeolocationPosition a partir del payload nativo.
 * Solo se rellenan los campos que `createRecordingLoop.startWatch()` lee de verdad
 * (timestamp, coords.latitude/longitude/altitude/speed); el resto de campos de
 * `GeolocationCoordinates` (accuracy, altitudeAccuracy, heading) llevan valores por
 * defecto seguros. GeolocationPosition/GeolocationCoordinates son interfaces readonly
 * con métodos (toJSON) que no aportan nada aquí: se cablea con un cast explícito
 * documentado en vez de `any`.
 */
function toGeolocationPosition(payload: NativeLocationEvent): GeolocationPosition {
  const coords = {
    latitude: payload.lat,
    longitude: payload.lng,
    altitude: payload.alt,
    accuracy: 0,
    altitudeAccuracy: null,
    heading: null,
    speed: payload.speed,
  };
  return { coords, timestamp: payload.timestamp } as unknown as GeolocationPosition;
}

/** `true` solo dentro de un WebView Android real ejecutando Tauri — en cualquier
 * otro caso (navegador de desarrollo, desktop) se sigue usando el GpsProvider de
 * navegador. No se añade `@tauri-apps/plugin-os` (no es dependencia instalada hoy). */
export function isAndroidTauri(): boolean {
  return isTauri() && /android/i.test(navigator.userAgent);
}

/** Función pura de selección de provider, extraída para poder testearla sin
 * montar el Web Component completo. */
export function selectGpsProvider(isAndroid: boolean, native: GpsProvider, browser: GpsProvider): GpsProvider {
  return isAndroid ? native : browser;
}

export function createNativeGpsProvider(fallback: GpsProvider): GpsProvider {
  return {
    getCurrentPosition: () => fallback.getCurrentPosition(),
    checkPermissions: () => fallback.checkPermissions(),
    requestPermissions: () => fallback.requestPermissions(),
    watchPosition: (callback) => {
      let unlisten: (() => void) | null = null;
      let cancelled = false;
      listen<NativeLocationEvent>(NATIVE_LOCATION_EVENT, (event) => {
        callback(toGeolocationPosition(event.payload));
      })
        .then((fn) => {
          if (cancelled) {
            fn();
            return;
          }
          unlisten = fn;
        })
        .catch(() => { /* no-op: el evento nativo no está disponible en esta plataforma */ });

      return (): void => {
        cancelled = true;
        unlisten?.();
      };
    },
  };
}
