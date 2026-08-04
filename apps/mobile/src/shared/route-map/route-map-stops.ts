/**
 * Funciones para añadir marcadores de parada (con tipo del catálogo) al mapa MapLibre.
 */

import * as maplibregl from 'maplibre-gl';
import type { StopCategory } from '../stop-types/stop-types.types.js';

/** Parada con lo mínimo que necesita el mapa: ubicación y su categoría (si tiene). */
export interface MapStop {
  lat: number;
  lng: number;
  stopCategoryId: number | null;
}

/**
 * Añade un marcador por cada parada con categoría resuelta en el catálogo
 * (AC-7.1) — cada tipo distinto muestra su propio icono del catálogo, ya
 * distinguible entre sí sin lógica adicional (AC-7.2). Una parada sin
 * categoría, o cuyo id no está en `categoriesById` (caché desactualizada),
 * se descarta por completo — nunca se dibuja un marcador sin tipo (AC-7.3),
 * mismo criterio que `buildStopDelimiters` en la timeline.
 */
export function addStopMarkers(
  map: maplibregl.Map,
  stops: MapStop[],
  categoriesById: Map<number, StopCategory>,
): maplibregl.Marker[] {
  const markers: maplibregl.Marker[] = [];

  for (const stop of stops) {
    if (stop.stopCategoryId === null) continue;
    const category = categoriesById.get(stop.stopCategoryId);
    if (!category) continue;

    const icon = document.createElement('div');
    icon.className = 'route-map-marker route-map-marker--stop';
    icon.textContent = category.icon;

    // Mismo patrón de hitarea que los marcadores de foto (route-map-photos.ts):
    // el icono visible queda pequeño, pero el área de clic/toque mantiene
    // --hitbox-min para uso con guantes de moto.
    const hitArea = document.createElement('div');
    hitArea.className = 'route-map-marker-hitarea';
    hitArea.setAttribute('data-cy', 'route-map-stop-marker');
    hitArea.title = category.label;
    hitArea.appendChild(icon);

    const marker = new maplibregl.Marker({ element: hitArea, anchor: 'bottom' })
      .setLngLat([stop.lng, stop.lat])
      .addTo(map);
    markers.push(marker);
  }

  return markers;
}
