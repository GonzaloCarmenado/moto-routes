/**
 * Funciones para añadir marcadores de fotos al mapa MapLibre.
 */

import * as maplibregl from 'maplibre-gl';
import type { Photo } from '../models/photo.types.js';

const PHOTO_CLUSTER_RADIUS_METERS = 50;

/**
 * Añade marcadores de fotos al mapa MapLibre con clustering simple.
 * Los estilos de los marcadores viven en `route-map.element.css`
 * (`.route-map-marker--photo` / `--cluster`).
 */
export function addPhotoMarkers(
  map: maplibregl.Map,
  photos: Photo[],
  onPhotoClick?: (photo: Photo) => void,
): void {
  const withCoords = photos.filter((p) => p.latitude != null && p.longitude != null);
  if (withCoords.length === 0) return;

  // Group by proximity (simple clustering)
  const clusters = clusterPhotos(withCoords, PHOTO_CLUSTER_RADIUS_METERS);

  for (const cluster of clusters) {
    const isCluster = cluster.photos.length > 1;
    const el = document.createElement('div');
    el.className = isCluster
      ? 'route-map-marker route-map-marker--photo route-map-marker--cluster'
      : 'route-map-marker route-map-marker--photo';
    el.setAttribute('data-cy', isCluster ? 'photo-cluster' : 'photo-marker');

    if (isCluster) {
      el.textContent = String(cluster.photos.length);
      el.addEventListener('click', () => {
        // Zoom hacia la zona del cluster
        map.flyTo({
          center: [cluster.centerLng, cluster.centerLat],
          zoom: map.getZoom() + 2,
        });
      });
    } else {
      el.addEventListener('click', () => onPhotoClick?.(cluster.photos[0]!));
    }

    new maplibregl.Marker({ element: el })
      .setLngLat([cluster.centerLng, cluster.centerLat])
      .addTo(map);
  }
}

interface PhotoCluster {
  centerLat: number;
  centerLng: number;
  photos: Photo[];
}

/**
 * Algoritmo simple de clustering basado en distancia Haversine.
 * Agrupa fotos que están a menos de `radiusMeters` de distancia.
 */
export function clusterPhotos(
  photos: Photo[],
  radiusMeters: number,
): PhotoCluster[] {
  const clusters: PhotoCluster[] = [];
  const assigned = new Set<string>();

  for (const photo of photos) {
    if (assigned.has(photo.id)) continue;
    if (photo.latitude == null || photo.longitude == null) continue;

    const cluster: PhotoCluster = {
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