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
  BACK_TO_LIST: 'back-to-list',
} as const;

/** Forma del `detail` de cada evento. `undefined` = evento sin payload. */
export interface AppEventDetailMap {
  'nav-grabar': undefined;
  'nav-rutas': undefined;
  'nav-perfil': undefined;
  'view-route': { routeId: string };
  'back-to-list': undefined;
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
