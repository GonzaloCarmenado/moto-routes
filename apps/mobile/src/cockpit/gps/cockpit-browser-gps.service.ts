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
    // Comprobar solo que `navigator.geolocation` existe (casi siempre true) dejaba
    // `hasGpsPermission` en true de mentira tras revocarse el permiso a nivel de
    // SO (p. ej. reinstalar el APK) — RecordingService.kt crasheaba la app entera
    // al llamar startForeground sin permiso real. La Permissions API sí refleja
    // el estado real; sin ella (WebView antiguo, jsdom) se mantiene el fallback previo.
    checkPermissions: async (): Promise<boolean> => {
      if (!navigator.geolocation) return false;
      const permissions = (navigator as Navigator & { permissions?: Permissions }).permissions;
      if (!permissions?.query) return true;
      try {
        return (await permissions.query({ name: 'geolocation' })).state === 'granted';
      } catch {
        return true;
      }
    },
    requestPermissions: (): Promise<boolean> => {
      if (!navigator.geolocation) return Promise.resolve(false);
      return new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          () => { resolve(true); },
          () => { resolve(false); },
        );
      });
    },
  };
}
