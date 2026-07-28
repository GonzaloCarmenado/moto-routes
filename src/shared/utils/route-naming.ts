/**
 * Nombre de ruta: nombre por defecto al guardar y nombre a mostrar cuando el
 * usuario no personalizó ninguno (ver AC-003 de
 * `specs/features/deuda-tecnica-auditoria.md`).
 */

import { formatRouteDate } from './date.js';

/**
 * Nombre por defecto cuando el usuario no escribe ninguno al guardar (AC-002
 * de `mejoras-guardado-rutas`): "Ruta {día} {mes abreviado} {año}, {hora}:{minuto}"
 * — mismo formato de fecha que `formatRouteDate`, combinado con la hora para
 * distinguir varias rutas guardadas el mismo día.
 */
export function buildDefaultRouteName(dateIso: string): string {
  const timePart = new Date(dateIso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  return `Ruta ${formatRouteDate(dateIso)}, ${timePart}`;
}

/**
 * Nombre a mostrar en el listado/detalle de una ruta ya guardada: el nombre
 * personalizado si existe (tras `trim()`), o "Ruta {fecha}" si está vacío/en
 * blanco, `null` (rutas guardadas antes de `mejoras-guardado-rutas`, ver
 * `Route.name`) o no se escribió ninguno.
 */
export function buildRouteDisplayName(
  name: string | null | undefined,
  createdAt: string | undefined,
): string {
  if (name?.trim()) return name;
  return `Ruta ${formatRouteDate(createdAt)}`;
}
