import styles from './route-map.element.css?inline';
import maplibreStyles from 'maplibre-gl/dist/maplibre-gl.css?inline';
import * as maplibregl from 'maplibre-gl';
import { toGeoJSON, computeBounds, oklchStringToRgb } from './route-map.transform.js';
import type { RouteMapPoint } from './route-map.transform.js';

const DARK_STYLE_URL = 'https://tiles.openfreemap.org/styles/dark';
const ROUTE_SOURCE_ID = 'route-line';
const ROUTE_LAYER_ID = 'route-line-layer';
const AMBER_FALLBACK = '#d4880f';
// Aproximación en rgb de --ink-faint (oklch(55% 0.02 55)) — fallback solo
// para el caso extremo en que resolveToken() no pueda leer el token (sin
// shadowRoot todavía).
const ROAD_CONTRAST_FALLBACK = '#7b6f67';
// Aproximación en rgb de --ink-soft (oklch(70% 0.015 55)) — mismo fallback
// extremo que ROAD_CONTRAST_FALLBACK, para el texto de nombres de calles/
// ciudades (más claro que el trazado de vía, ver applyContrastOverrides).
const ROAD_LABEL_CONTRAST_FALLBACK = '#a69c96';
// Feedback real de usuario (2026-08-01): el color de contraste de las vías
// (Paso 3) se veía "demasiado blanco/grueso" en dispositivo real. Se reduce
// el ancho respecto al original del estilo, multiplicando el valor final de
// la expresión de interpolación por zoom ya existente (en vez de sustituirla
// por un número fijo, que rompería la progresión motorway>minor entre capas)
// — ver `thinRoadLine()`. Bajado de 0.7 a 0.5 tras una segunda ronda de
// feedback real (2026-08-01, sesión posterior) — seguía viéndose grueso.
const ROAD_WIDTH_SCALE = 0.5;
// Icono de pin para los marcadores de inicio/fin (AC-010): `fill="currentColor"`
// deja que el color lo decida el CSS del marcador (`--start`/`--end`), nunca
// un valor fijo en el propio SVG (AC-011).
const ROUTE_MARKER_PIN_SVG =
  '<svg viewBox="0 0 24 30" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
  '<path fill="currentColor" d="M12 0C5.373 0 0 5.373 0 12c0 9 12 18 12 18s12-9 12-18C24 5.373 18.627 0 12 0z' +
  'M12 16.5A4.5 4.5 0 1 1 12 7.5a4.5 4.5 0 0 1 0 9z" fill-rule="evenodd"/>' +
  '</svg>';

import { addPhotoMarkers, photoClusterRadiusForZoom, type MapPhoto } from './route-map-photos.js';
import { addStopMarkers, type MapStop } from './route-map-stops.js';
import { buildRoadContrastOverrides, buildRoadLabelContrastOverrides } from './route-map-contrast.js';
import { createFullscreenToggle, type FullscreenToggle } from './route-map-fullscreen.js';
import { BaseElement } from '../base-element.js';
import type { StopCategory } from '../stop-types/stop-types.types.js';

/**
 * Emitido al pulsar la miniatura del popup de un marcador de foto individual
 * (AC-015, AC-029). Sigue el mismo patrón de desacoplo que `photo-gallery:select`:
 * `<route-map>` reporta qué foto se pulsó y deja que el llamador decida abrir
 * `<photo-viewer>`, sin importarlo ni conocerlo (AC-016 — Notas de Implementación).
 */
export const ROUTE_MAP_PHOTO_SELECT_EVENT = 'route-map:photo-select';
/** Payload del evento de selección de un marcador de foto en el mapa. */
export interface RouteMapPhotoSelectDetail {
  photo: MapPhoto;
}

class RouteMap extends BaseElement {
  private _points: RouteMapPoint[] = [];
  private _photos: MapPhoto[] = [];
  private _stops: MapStop[] = [];
  private _categoriesById = new Map<number, StopCategory>();
  private mapInstance: maplibregl.Map | null = null;
  private photoMarkers: maplibregl.Marker[] = [];
  private stopMarkers: maplibregl.Marker[] = [];
  private skeletonElement: HTMLElement | null = null;
  private fullscreenToggle: FullscreenToggle | null = null;

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

  set stops(value: MapStop[]) {
    this._stops = value;
    if (this.mapInstance) this.renderStopMarkers();
  }

  get stops(): MapStop[] {
    return this._stops;
  }

  set stopCategoriesById(value: Map<number, StopCategory>) {
    this._categoriesById = value;
    if (this.mapInstance) this.renderStopMarkers();
  }

  get stopCategoriesById(): Map<number, StopCategory> {
    return this._categoriesById;
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
    this.stopMarkers = [];
    this.skeletonElement = null;
    // El listener de `fullscreenchange` del botón vive en `document`, no en el
    // contenedor del mapa — hay que quitarlo explícitamente aquí (llamado
    // también desde `disconnectedCallback`) para no acumular listeners
    // huérfanos entre montajes/desmontajes de `<route-map>` (p. ej. al
    // navegar entre rutas en `<route-detail>`).
    this.fullscreenToggle?.destroy();
    this.fullscreenToggle = null;
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
      this.initMap(mapRoot, container, this._points);
    });
  }

  private initMap(mapRoot: HTMLElement, outerContainer: HTMLElement, points: RouteMapPoint[]): void {
    const first = points[0]!;
    const map = new maplibregl.Map({
      container: mapRoot,
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

    // AC-016 a AC-021: el botón de pantalla completa se añade sobre el
    // contenedor EXTERIOR (`outerContainer`, no `mapRoot`) porque debe ser ese
    // elemento el que entre en pantalla completa vía la Fullscreen API — así
    // el mapa (incluida la atribución que MapLibre monta dentro de `mapRoot`)
    // y este botón, ambos descendientes suyos, se ven con normalidad una vez
    // en pantalla completa. Degrada a `null` sin error si la Fullscreen API no
    // está soportada (AC-020).
    //
    // Nota (2026-08-01): los controles de zoom (`NavigationControl`, Paso 5)
    // se retiraron tras verificación en dispositivo real — el usuario los
    // encontró innecesarios (el gesto de pellizco cubre el mismo caso) y
    // preferible dejar la esquina 'top-left' libre. Ver AC-013/AC-014/AC-015
    // marcados como retirados en la spec.
    this.fullscreenToggle = createFullscreenToggle(outerContainer, map);
    if (this.fullscreenToggle) {
      outerContainer.appendChild(this.fullscreenToggle.element);
    }

    map.on('load', () => {
      // Quita el skeleton ANTES de dibujar la ruta/marcadores (AC-006): así
      // no queda un frame con el skeleton y el mapa ya pintado superpuestos.
      this.skeletonElement?.remove();
      this.skeletonElement = null;
      this.applyContrastOverrides(map);
      this.collapseAttribution(mapRoot);
      this.drawRoute(map, points);
      this.renderPhotoMarkers();
      this.renderStopMarkers();
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

  /** Marcadores de parada (AC-7.1 a AC-7.3) — sin clustering, a diferencia de las fotos: las paradas son mucho menos numerosas. */
  private renderStopMarkers(): void {
    const map = this.mapInstance;
    if (!map) return;
    for (const marker of this.stopMarkers) marker.remove();
    this.stopMarkers = addStopMarkers(map, this._stops, this._categoriesById);
  }

  // AC-001/AC-004: aumenta el contraste de las capas de carretera del estilo
  // `dark` (casi indistinguibles del fondo por defecto) con un tono
  // cálido/neutro de la paleta "Asfalto Nocturno" (--ink-faint — más oscuro
  // que --ink-soft usado originalmente, ver comentario de ROAD_CONTRAST_FALLBACK:
  // feedback real de usuario, "demasiado blanco"), sin sustituir el estilo
  // base ni tocar el color del trazado (--amber). También afina el ancho de
  // línea (thinRoadLine) y sube el contraste de las etiquetas de nombres de
  // calles/ciudades (--ink-soft — más claro que el color de vía, para que se
  // distingan entre sí), casi ilegibles por defecto en este estilo.
  // AC-003: cada override va en su propio try/catch — si el estilo de
  // terceros renombra/quita una capa, ese fallo aislado no debe abortar el
  // resto de overrides ni el resto del ciclo de vida del mapa (trazado,
  // marcadores, fitBounds siguen dibujándose con normalidad).
  private applyContrastOverrides(map: maplibregl.Map): void {
    const roadColor = this.resolveToken('--ink-faint', ROAD_CONTRAST_FALLBACK);
    for (const { layerId, property, value } of buildRoadContrastOverrides(roadColor)) {
      try {
        map.setPaintProperty(layerId, property, value);
        this.thinRoadLine(map, layerId);
      } catch {
        // Capa no existente en el estilo cargado — ver comentario de arriba.
      }
    }

    const labelColor = this.resolveToken('--ink-soft', ROAD_LABEL_CONTRAST_FALLBACK);
    for (const { layerId, property, value } of buildRoadLabelContrastOverrides(labelColor)) {
      try {
        map.setPaintProperty(layerId, property, value);
      } catch {
        // Capa de etiqueta no existente en el estilo cargado — ver comentario de arriba.
      }
    }
  }

  // Reduce el ancho de línea de una capa de carretera ya overrideada en color
  // (ROAD_WIDTH_SCALE). Multiplica el valor final de la expresión de
  // interpolación por zoom que ya trae el estilo (`['*', current, scale]`) en
  // vez de sustituirla por un número fijo, preservando la progresión de grosor
  // entre clases de vía (motorway > major > minor) en todos los niveles de
  // zoom. `getPaintProperty` devuelve `undefined` si la capa no existe en el
  // estilo cargado — en ese caso no hace nada (el `try/catch` del llamador ya
  // cubre el resto de fallos, p. ej. si `setPaintProperty` mismo lanza).
  private thinRoadLine(map: maplibregl.Map, layerId: string): void {
    const current = map.getPaintProperty(layerId, 'line-width');
    if (current === undefined) return;
    map.setPaintProperty(layerId, 'line-width', ['*', current, ROAD_WIDTH_SCALE]);
  }

  // Feedback real de usuario (2026-08-01, tercera ronda, AC-038): el control
  // de atribución compacto de MapLibre (`attributionControl: {compact:true}`)
  // arranca EXPANDIDO por diseño — `AttributionControl._updateCompact()`
  // añade la clase `maplibregl-compact-show` y el atributo `open` nada más
  // crearse (antes incluso de que cargue el estilo) y solo lo colapsa cuando
  // el usuario arrastra el mapa (`_updateCompactMinimize()`, enganchado al
  // evento `drag`). En un mapa embebido de 200px que casi nadie arrastra,
  // queda expandido indefinidamente. Se colapsa aquí a mano, replicando
  // exactamente lo mismo que hace `_updateCompactMinimize()` al arrastrar —
  // si una versión futura de MapLibre cambia este detalle interno, esto
  // simplemente deja de tener efecto (la atribución seguiría visible y
  // pulsable, solo que expandida por defecto).
  private collapseAttribution(mapRoot: HTMLElement): void {
    const attrib = mapRoot.querySelector('.maplibregl-ctrl-attrib');
    attrib?.classList.remove('maplibregl-compact-show');
    attrib?.removeAttribute('open');
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
    // AC-034: ancla la punta inferior del pin (no su centro) a la coordenada
    // GPS real — comportamiento estándar de un pin de mapa, pedido por
    // feedback real de usuario ("el icono flotaba sobre el punto en vez de
    // tocarlo con la punta").
    new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat([point.lng, point.lat]).addTo(map);
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
