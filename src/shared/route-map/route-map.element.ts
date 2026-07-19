import styles from './route-map.element.css?inline';
import maplibreStyles from 'maplibre-gl/dist/maplibre-gl.css?inline';
import * as maplibregl from 'maplibre-gl';
import { toGeoJSON, computeBounds, oklchStringToRgb } from './route-map.transform.js';
import type { RouteMapPoint } from './route-map.transform.js';

const DARK_STYLE_URL = 'https://tiles.openfreemap.org/styles/dark';
const ROUTE_SOURCE_ID = 'route-line';
const ROUTE_LAYER_ID = 'route-line-layer';
const AMBER_FALLBACK = '#d4880f';

class RouteMap extends HTMLElement {
  private _points: RouteMapPoint[] = [];
  private mapInstance: maplibregl.Map | null = null;

  set points(value: RouteMapPoint[]) {
    this._points = value;
    if (this.isConnected) this.render();
  }

  get points(): RouteMapPoint[] {
    return this._points;
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
    if (this.mapInstance) {
      this.mapInstance.remove();
      this.mapInstance = null;
    }
  }

  private render(): void {
    this.destroyMap();

    const root = this.shadowRoot;
    if (!root) return;
    root.innerHTML = '';

    const style = document.createElement('style');
    style.textContent = `${maplibreStyles}\n${styles}`;
    root.appendChild(style);

    const container = document.createElement('div');
    container.className = 'route-map-container';
    container.setAttribute('data-cy', 'route-map-container');
    root.appendChild(container);

    if (this._points.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'map-empty';
      empty.textContent = 'Sin datos de GPS';
      container.appendChild(empty);
      return;
    }

    const mapRoot = document.createElement('div');
    mapRoot.className = 'maplibre-root';
    container.appendChild(mapRoot);

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
    });
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
