/**
 * @packageDocumentation
 * Bus de eventos de navegación de la app.
 *
 * Los eventos de navegación viajan por `window` (bus global), no por el árbol de
 * componentes, porque conectan piezas hermanas montadas por `app-root` sin
 * relación padre/hijo directa. Este módulo centraliza sus nombres y la forma de
 * su `detail` para no repetir strings literales sueltos por toda la app.
 */

export const APP_EVENTS = {
  NAV_GRABAR: 'nav-grabar',
  NAV_RUTAS: 'nav-rutas',
  NAV_PERFIL: 'nav-perfil',
  VIEW_ROUTE: 'view-route',
  VIEW_SHARING: 'view-sharing',
  VIEW_ACHIEVEMENTS: 'view-achievements',
  VIEW_FRIENDS: 'view-friends',
  BACK_TO_LIST: 'back-to-list',
  AUTH_LOGGED_IN: 'auth-logged-in',
  ROUTE_SAVED: 'route-saved',
  UPDATE_DOWNLOAD_REQUESTED: 'update-download-requested',
  UPDATE_INSTALL_REQUESTED: 'update-install-requested',
} as const;

/** Forma del `detail` de cada evento. `undefined` = evento sin payload. */
export interface AppEventDetailMap {
  'nav-grabar': undefined;
  'nav-rutas': undefined;
  'nav-perfil': undefined;
  'view-route': { routeId: string };
  'view-sharing': undefined;
  'view-achievements': undefined;
  'view-friends': undefined;
  'back-to-list': undefined;
  /** Despachado tras un login interactivo correcto (`profile-account.ts`) — permite
   * a `app-root` re-comprobar el bloqueo por username sin fijar (nombre-usuario,
   * design.md Decisión 3) sin esperar al próximo arranque de la app. */
  'auth-logged-in': undefined;
  /** Despachado desde `cockpit-persist.service.ts::persistRouteOnStop` solo cuando
   * el guardado local de la ruta recién grabada resuelve con éxito — nunca si
   * falla, nunca desde `persistRouteOnStart`. `cockpit` no sabe nada de auth/nube
   * (separación de dominios ya existente); `app-root` escucha esto para intentar
   * la subida automática (ver subida-automatica-rutas, design.md D1). */
  'route-saved': { routeId: string };
  /** Despachado desde `<update-banner>` al pulsar "Descargar" (actualizacion-in-app,
   * design.md D7) — `app-root` escucha esto para delegar en el servicio de descarga,
   * mismo patrón ya usado para `route-saved`/`app-route-upload.ts`. */
  'update-download-requested': { downloadUrl: string; latestVersion: string };
  /** Despachado desde `<update-banner>` al pulsar "Instalar" tras una descarga
   * completa. Sin payload: el orquestador (`app-update-download.ts`) ya conoce
   * la ruta del APK descargado, la propia descarga la generó. */
  'update-install-requested': undefined;
}

/** Nombre de evento de navegación (clave de `AppEventDetailMap`). */
export type AppEventName = keyof AppEventDetailMap;

/**
 * Despacha un evento de navegación en `window` de forma tipada: los eventos con
 * `detail` (p. ej. `view-route`) exigen pasarlo; los que no lo tienen prohíben
 * pasar un segundo argumento.
 */
export function dispatchAppEvent<K extends AppEventName>(
  name: K,
  ...detail: AppEventDetailMap[K] extends undefined ? [] : [AppEventDetailMap[K]]
): void {
  window.dispatchEvent(new CustomEvent(name, { detail: detail[0] }));
}
