import styles from './route-map.element.css?inline';
import maplibreStyles from 'maplibre-gl/dist/maplibre-gl.css?inline';
import * as maplibregl from 'maplibre-gl';
import { toGeoJSON, computeBounds, oklchStringToRgb } from './route-map.transform.js';
import type { RouteMapPoint } from './route-map.transform.js';

const DARK_STYLE_URL = 'https://tiles.openfreemap.org/styles/dark';
const ROUTE_SOURCE_ID = 'route-line';
const ROUTE_LAYER_ID = 'route-line-layer';
const AMBER_FALLBACK = '#d4880f';
// Aproximación en rgb de --ink-soft (oklch(70% 0.015 55)) — fallback solo
// para el caso extremo en que resolveToken() no pueda leer el token (sin
// shadowRoot todavía).
const ROAD_CONTRAST_FALLBACK = '#b3a894';
// Icono de pin para los marcadores de inicio/fin (AC-010): `fill="currentColor"`
// deja que el color lo decida el CSS del marcador (`--start`/`--end`), nunca
// un valor fijo en el propio SVG (AC-011).
const ROUTE_MARKER_PIN_SVG =
  '<svg viewBox="0 0 24 30" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
  '<path fill="currentColor" d="M12 0C5.373 0 0 5.373 0 12c0 9 12 18 12 18s12-9 12-18C24 5.373 18.627 0 12 0z' +
  'M12 16.5A4.5 4.5 0 1 1 12 7.5a4.5 4.5 0 0 1 0 9z" fill-rule="evenodd"/>' +
  '</svg>';

import { addPhotoMarkers, photoClusterRadiusForZoom, type MapPhoto } from './route-map-photos.js';
import { buildRoadContrastOverrides } from './route-map-contrast.js';
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
  private skeletonElement: HTMLElement | null = null;

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
    this.skeletonElement = null;
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

    // Skeleton de carga (AC-005, AC-006, AC-023): tapa `mapRoot` mientras
    // MapLibre aún no ha disparado `load` (tiles todavía sin pintar), en vez
    // de dejar el contenedor vacío o un flash en blanco. Va DESPUÉS de
    // `mapRoot` en el DOM para pintarse encima (ambos son `position:
    // absolute`, sin z-index explícito) — se quita del DOM en cuanto `load`
    // se dispara (ver initMap), sin necesidad de ocultar mapRoot.
    const skeleton = document.createElement('div');
    skeleton.className = 'route-map-skeleton';
    skeleton.setAttribute('data-cy', 'route-map-skeleton');
    container.appendChild(skeleton);
    this.skeletonElement = skeleton;

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
      // AC-008/AC-024: revierte el `attributionControl: false` previo — la
      // licencia de OpenFreeMap/OSM exige mostrar el crédito. `compact: true`
      // (opción nativa de MapLibre) lo colapsa en un botón "i" discreto en
      // vez de dejar el texto completo siempre visible (AC-009, estilo
      // afinado además vía CSS — ver override de `.maplibregl-ctrl-attrib`).
      attributionControl: { compact: true },
    });
    this.mapInstance = map;

    map.on('load', () => {
      // Quita el skeleton ANTES de dibujar la ruta/marcadores (AC-006): así
      // no queda un frame con el skeleton y el mapa ya pintado superpuestos.
      this.skeletonElement?.remove();
      this.skeletonElement = null;
      this.applyContrastOverrides(map);
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

  // AC-001/AC-004: aumenta el contraste de las capas de carretera del estilo
  // `dark` (casi indistinguibles del fondo por defecto) con un tono
  // cálido/neutro de la paleta "Asfalto Nocturno" (--ink-soft), sin
  // sustituir el estilo base ni tocar el color del trazado (--amber).
  // AC-003: cada override va en su propio try/catch — si el estilo de
  // terceros renombra/quita una capa, ese fallo aislado no debe abortar el
  // resto de overrides ni el resto del ciclo de vida del mapa (trazado,
  // marcadores, fitBounds siguen dibujándose con normalidad).
  private applyContrastOverrides(map: maplibregl.Map): void {
    const color = this.resolveToken('--ink-soft', ROAD_CONTRAST_FALLBACK);
    for (const { layerId, property, value } of buildRoadContrastOverrides(color)) {
      try {
        map.setPaintProperty(layerId, property, value);
      } catch {
        // Capa no existente en el estilo cargado — ver comentario de arriba.
      }
    }
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

  // AC-010/AC-025: sustituye el círculo CSS plano anterior por un icono tipo
  // pin (SVG inline, `fill="currentColor"`) con mejor legibilidad sobre el
  // mapa oscuro. El color base sigue viniendo de `.route-map-marker--start`/
  // `--end` (AC-011: `color: var(--success)`/`var(--amber)`, nunca
  // hardcodeado) — el SVG solo hereda ese color vía `currentColor`, no fija
  // ninguno propio.
  private addMarker(map: maplibregl.Map, point: RouteMapPoint, kind: 'start' | 'end'): void {
    const el = document.createElement('div');
    el.className = `route-map-marker route-map-marker--pin route-map-marker--${kind}`;
    el.innerHTML = ROUTE_MARKER_PIN_SVG;
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
