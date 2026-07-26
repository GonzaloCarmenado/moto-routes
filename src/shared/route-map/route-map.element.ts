import styles from './route-map.element.css?inline';
import maplibreStyles from 'maplibre-gl/dist/maplibre-gl.css?inline';
import * as maplibregl from 'maplibre-gl';
import { toGeoJSON, computeBounds, oklchStringToRgb } from './route-map.transform.js';
import type { RouteMapPoint } from './route-map.transform.js';

const DARK_STYLE_URL = 'https://tiles.openfreemap.org/styles/dark';
const ROUTE_SOURCE_ID = 'route-line';
const ROUTE_LAYER_ID = 'route-line-layer';
const AMBER_FALLBACK = '#d4880f';

import { addPhotoMarkers, photoClusterRadiusForZoom, type MapPhoto } from './route-map-photos.js';
import { BaseElement } from '../base-element.js';

/**
 * Emitido al pulsar la miniatura del popup de un marcador de foto individual
 * (AC-015, AC-029). Sigue el mismo patrón de desacoplo que `photo-gallery:select`:
 * `<route-map>` reporta qué foto se pulsó y deja que el llamador decida abrir
 * `<photo-viewer>`, sin importarlo ni conocerlo (AC-016 — Notas de Implementación).
 */
export const ROUTE_MAP_PHOTO_SELECT_EVENT = 'route-map:photo-select';
export interface RouteMapPhotoSelectDetail {
  photo: MapPhoto;
}

class RouteMap extends BaseElement {
  private _points: RouteMapPoint[] = [];
  private _photos: MapPhoto[] = [];
  private mapInstance: maplibregl.Map | null = null;
  private photoMarkers: maplibregl.Marker[] = [];

  set points(value: RouteMapPoint[]) {
    this._points = value;
    if (this.isConnected) this.render();
  }

  get points(): RouteMapPoint[] {
    return this._points;
  }

  set photos(value: MapPhoto[]) {
    this._photos = value;
    if (this.mapInstance) this.renderPhotoMarkers();
  }

  get photos(): MapPhoto[] {
    return this._photos;
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback(): void {
    this.render();
  }

  disconnectedCallback(): void {
    this.destroyMap();
  }

  private destroyMap(): void {
    this.photoMarkers = [];
    if (this.mapInstance) {
      this.mapInstance.remove();
      this.mapInstance = null;
    }
  }

  protected render(): void {
    this.destroyMap();
    if (!this.shadowRoot) return;

    const sheet = `${maplibreStyles}\n${styles}`;
    const container = document.createElement('div');
    container.className = 'route-map-container';
    container.setAttribute('data-cy', 'route-map-container');

    if (this._points.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'map-empty';
      empty.textContent = 'Sin datos de GPS';
      container.appendChild(empty);
      this.renderShadow(sheet, container);
      return;
    }

    const mapRoot = document.createElement('div');
    mapRoot.className = 'maplibre-root';
    container.appendChild(mapRoot);
    this.renderShadow(sheet, container);

    requestAnimationFrame(() => {
      this.initMap(mapRoot, this._points);
    });
  }

  private initMap(container: HTMLElement, points: RouteMapPoint[]): void {
    const first = points[0]!;
    const map = new maplibregl.Map({
      container,
      style: DARK_STYLE_URL,
      center: [first.lng, first.lat],
      zoom: 12,
      attributionControl: false,
    });
    this.mapInstance = map;

    map.on('load', () => {
      this.drawRoute(map, points);
      this.renderPhotoMarkers();
    });
    // El radio de clustering escala con el zoom (ver photoClusterRadiusForZoom), así que
    // hay que recalcularlo cuando el usuario hace zoom para que los clusters se desagrupen.
    map.on('zoomend', () => {
      this.renderPhotoMarkers();
    });
  }

  private renderPhotoMarkers(): void {
    const map = this.mapInstance;
    if (!map) return;
    for (const marker of this.photoMarkers) marker.remove();
    const radius = photoClusterRadiusForZoom(map.getZoom());
    this.photoMarkers = addPhotoMarkers(map, this._photos, radius, (photo) => {
      // Marcador individual: abre directamente el visor a pantalla completa,
      // sin popup ni overlay intermedio.
      this.emitPhotoSelect(photo);
    });
  }

  /** Callback compartido para emitir el evento de selección de foto */
  private emitPhotoSelect(photo: MapPhoto): void {
    this.emit<RouteMapPhotoSelectDetail>(ROUTE_MAP_PHOTO_SELECT_EVENT, { photo });
  }

  private drawRoute(map: maplibregl.Map, points: RouteMapPoint[]): void {
    const amber = this.resolveToken('--amber', AMBER_FALLBACK);

    map.addSource(ROUTE_SOURCE_ID, {
      type: 'geojson',
      data: toGeoJSON(points),
    });

    map.addLayer({
      id: ROUTE_LAYER_ID,
      type: 'line',
      source: ROUTE_SOURCE_ID,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': amber, 'line-width': 4 },
    });

    this.addMarker(map, points[0]!, 'start');
    this.addMarker(map, points[points.length - 1]!, 'end');

    const bounds = computeBounds(points);
    if (bounds) {
      map.fitBounds(bounds, { padding: 50 });
    }
  }

  private addMarker(map: maplibregl.Map, point: RouteMapPoint, kind: 'start' | 'end'): void {
    const el = document.createElement('div');
    el.className = `route-map-marker route-map-marker--${kind}`;
    new maplibregl.Marker({ element: el }).setLngLat([point.lng, point.lat]).addTo(map);
  }

  // MapLibre valida sus paint properties con su propio parser de color (no el
  // motor CSS del navegador). getComputedStyle() en un custom property
  // devuelve el oklch() literal (los navegadores ya no lo degradan a rgb()).
  // Leer píxeles de un canvas (getImageData) para forzar la conversión NO es
  // fiable: las protecciones anti-fingerprinting de algunos navegadores
  // (ej. Opera GX, extensiones de privacidad) alteran o bloquean esa lectura,
  // devolviendo negro. En su lugar, se convierte oklch→rgb con matemáticas
  // puras (route-map.transform.ts), sin depender de ninguna API de canvas.
  //
  // La sonda se inserta dentro de this.shadowRoot (NO como hijo ligero de
  // this): un hijo ligero de un host con shadow DOM y sin <slot> que lo
  // recoja no forma parte del árbol renderizado ("flat tree"), y la
  // herencia de custom properties para elementos no incluidos ahí es
  // inconsistente entre navegadores (confirmado: devolvía rgb(0,0,0) en
  // Chrome/incógnito real, aunque funcionaba en el Chrome de los tests).
  // Insertarla en el shadowRoot la coloca junto a los elementos que sí
  // heredan el token correctamente (p.ej. los marcadores).
  private resolveToken(name: string, fallback: string): string {
    const root = this.shadowRoot;
    if (!root) return fallback;
    const probe = document.createElement('span');
    probe.style.setProperty('color', `var(${name})`);
    root.appendChild(probe);
    const literal = getComputedStyle(probe).color.trim();
    probe.remove();
    if (literal.length === 0) return fallback;
    if (literal.startsWith('oklch(')) {
      return oklchStringToRgb(literal) ?? fallback;
    }
    return literal;
  }
}

customElements.define('route-map', RouteMap);
