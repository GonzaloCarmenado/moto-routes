/**
 * Proveedor de GPS basado en la Geolocation API del navegador.
 * Extraído de cockpit.service.ts para mantener ese archivo bajo el límite de
 * tamaño (specs/ui/frontend-conventions.md), igual que ya se hizo con
 * persist/cockpit-persist.service.ts y stop/cockpit-stop.service.ts.
 */

/** Proveedor de ubicación (navegador o nativo Android) con permisos. */
export interface GpsProvider {
  getCurrentPosition(): Promise<GeolocationPosition>;
  watchPosition(callback: (pos: GeolocationPosition) => void): () => void;
  checkPermissions(): Promise<boolean>;
  requestPermissions(): Promise<boolean>;
}

// Techo de seguridad para el sondeo de permiso real (ver probeGeolocationPermission):
// getCurrentPosition() sin enableHighAccuracy suele resolver por localización de
// red en 1-3s con datos/WiFi; 8s cubre el caso sin ninguna de las dos sin bloquear
// el arranque del cockpit de forma perceptible en el caso normal.
const PERMISSION_PROBE_TIMEOUT_MS = 8000;

/**
 * Único punto fiable para saber si el permiso de ubicación está realmente
 * concedido a nivel de SO. `navigator.permissions.query({name:'geolocation'})`
 * (usado antes aquí) parecía la vía correcta, pero en el WebView real de
 * Android de este proyecto se confirmó en dispositivo (Realme 75fe536b,
 * 2026-08-05, `adb shell dumpsys package` mostraba `ACCESS_FINE_LOCATION:
 * granted=true` mientras `permissions.query` seguía devolviendo `'prompt'`
 * indefinidamente) que refleja un estado interno del propio WebView, no el
 * permiso real del SO — se queda encallado en "prompt" aunque el permiso ya
 * esté concedido, mostrando el overlay de permiso en cada apertura. Pedir una
 * localización real y mirar el código de error es la única señal que sí
 * coincide con el permiso real: solo `PERMISSION_DENIED` significa que de
 * verdad no hay permiso; `TIMEOUT`/`POSITION_UNAVAILABLE` (sin señal todavía)
 * no lo son y no deben bloquear al usuario ni mostrar el overlay.
 */
function probeGeolocationPermission(): Promise<boolean> {
  if (!navigator.geolocation) return Promise.resolve(false);
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      () => { resolve(true); },
      (error) => { resolve(error.code !== error.PERMISSION_DENIED); },
      { timeout: PERMISSION_PROBE_TIMEOUT_MS },
    );
  });
}

/** GpsProvider basado en la Geolocation API del navegador (usable tanto en web como en el WebView de Tauri). */
export function createBrowserGpsProvider(): GpsProvider {
  return {
    getCurrentPosition: () =>
      new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject);
      }),
    watchPosition: (callback) => {
      const id = navigator.geolocation.watchPosition(callback, () => { /* GPS error silently ignored */ });
      return (): void => { navigator.geolocation.clearWatch(id); };
    },
    // checkPermissions() y requestPermissions() son el mismo sondeo real: la
    // Geolocation API del navegador no distingue "consultar sin pedir" de
    // "pedir" — ver probeGeolocationPermission().
    checkPermissions: probeGeolocationPermission,
    requestPermissions: probeGeolocationPermission,
  };
}
