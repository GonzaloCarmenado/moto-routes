/**
 * Funciones para añadir marcadores de fotos al mapa MapLibre.
 */

import * as maplibregl from 'maplibre-gl';
import type { Photo } from '../models/photo.types.js';

/** Foto con su URL ya resuelta, para poder mostrar una miniatura en el popup del marcador. */
export interface MapPhoto extends Photo {
  readonly objectUrl?: string;
}

const PHOTO_CLUSTER_RADIUS_METERS = 50;
// El radio de clustering se define en metros "reales" a este zoom de referencia (calle/barrio).
// Al hacer zoom, se escala exponencialmente (igual que la resolución de Web Mercator: cada nivel
// de zoom duplica/divide la resolución), así que en zoom alto el radio efectivo se encoge y los
// clusters se desagrupan, y en zoom bajo crece y agrupa más (AC-018).
const PHOTO_CLUSTER_REFERENCE_ZOOM = 15;

/**
 * Radio fijo (en metros) para agrupar las fotos "de la misma zona" al abrir el visor a
 * pantalla completa desde un marcador del mapa. A diferencia de `PHOTO_CLUSTER_RADIUS_METERS`
 * (visual, escalado por zoom, solo evita solapar pines), este radio es semántico y no cambia
 * con el zoom: define qué fotos pertenecen a la misma parada o punto de interés.
 */
export const PHOTO_PROXIMITY_GROUP_RADIUS_METERS = 75;

/** Radio de clustering (en metros) equivalente a `PHOTO_CLUSTER_RADIUS_METERS` en el zoom dado. */
export function photoClusterRadiusForZoom(zoom: number): number {
  return PHOTO_CLUSTER_RADIUS_METERS * Math.pow(2, PHOTO_CLUSTER_REFERENCE_ZOOM - zoom);
}

/**
 * Añade marcadores de fotos al mapa MapLibre con clustering simple y devuelve los
 * `Marker` creados, para que el llamador pueda quitarlos al recalcular (p.ej. al hacer zoom).
 * Los estilos de los marcadores viven en `route-map.element.css`
 * (`.route-map-marker--photo` / `--cluster`).
 */
export function addPhotoMarkers(
  map: maplibregl.Map,
  photos: MapPhoto[],
  radiusMeters: number,
  onPhotoClick?: (photo: MapPhoto) => void,
): maplibregl.Marker[] {
  const withCoords = photos.filter((p) => p.latitude != null && p.longitude != null);
  if (withCoords.length === 0) return [];

  // Group by proximity (simple clustering)
  const clusters = clusterPhotos(withCoords, radiusMeters);
  const markers: maplibregl.Marker[] = [];

  for (const cluster of clusters) {
    const isCluster = cluster.photos.length > 1;
    const icon = document.createElement('div');
    icon.className = isCluster
      ? 'route-map-marker route-map-marker--photo route-map-marker--cluster'
      : 'route-map-marker route-map-marker--photo';

    // AC-036: el icono visible (16-32px) se envuelve en un contenedor
    // invisible más grande (--hitbox-min) para uso con guantes de moto — es
    // el wrapper, no el icono, el que MapLibre posiciona y el que recibe el
    // listener de click, así el icono no cambia de tamaño ni posición aparente.
    const hitArea = document.createElement('div');
    hitArea.className = 'route-map-marker-hitarea';
    hitArea.setAttribute('data-cy', isCluster ? 'photo-cluster' : 'photo-marker');
    hitArea.appendChild(icon);

    if (isCluster) {
      icon.textContent = String(cluster.photos.length);
    }
    // Mismo callback para marcador individual o cluster: quien lo recibe (route-detail)
    // calcula la zona de fotos GPS-cercanas a la foto pulsada y abre el visor con ella,
    // desacoplado del radio de clustering visual con el que se dibujó este pin.
    hitArea.addEventListener('click', () => onPhotoClick?.(cluster.photos[0]!));

    const marker = new maplibregl.Marker({ element: hitArea })
      .setLngLat([cluster.centerLng, cluster.centerLat])
      .addTo(map);
    markers.push(marker);
  }

  return markers;
}

interface PhotoCluster<T extends Photo> {
  centerLat: number;
  centerLng: number;
  photos: T[];
}

/**
 * Algoritmo simple de clustering basado en distancia Haversine.
 * Agrupa fotos que están a menos de `radiusMeters` de distancia.
 */
export function clusterPhotos<T extends Photo>(
  photos: T[],
  radiusMeters: number,
): PhotoCluster<T>[] {
  const clusters: PhotoCluster<T>[] = [];
  const assigned = new Set<string>();

  for (const photo of photos) {
    if (assigned.has(photo.id)) continue;
    if (photo.latitude == null || photo.longitude == null) continue;

    const cluster: PhotoCluster<T> = {
      centerLat: photo.latitude,
      centerLng: photo.longitude,
      photos: [photo],
    };
    assigned.add(photo.id);

    for (const other of photos) {
      if (assigned.has(other.id)) continue;
      if (other.latitude == null || other.longitude == null) continue;

      const dist = haversineDistance(
        cluster.centerLat, cluster.centerLng,
        other.latitude, other.longitude,
      );

      if (dist < radiusMeters) {
        cluster.photos.push(other);
        assigned.add(other.id);
        // Recalculate centroid
        const sumLat = cluster.photos.reduce((s, p) => s + (p.latitude ?? 0), 0);
        const sumLng = cluster.photos.reduce((s, p) => s + (p.longitude ?? 0), 0);
        cluster.centerLat = sumLat / cluster.photos.length;
        cluster.centerLng = sumLng / cluster.photos.length;
      }
    }

    clusters.push(cluster);
  }

  return clusters;
}

/**
 * Distancia Haversine entre dos coordenadas en metros.
 */
function haversineDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 6371000; // Earth radius in meters
  const toRad = (deg: number): number => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
