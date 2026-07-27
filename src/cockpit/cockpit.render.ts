/**
 * Constructores de DOM puros para <cockpit-view>. Sin estado propio: reciben
 * los datos ya formateados y callbacks de interacción, y devuelven elementos.
 * Extraído de cockpit.element.ts para mantener el archivo bajo el límite de
 * tamaño (specs/ui/frontend-conventions.md).
 */

import '../shared/photo-gallery/photo-gallery.element.js';
import { PHOTO_GALLERY_SELECT_EVENT, type PhotoGallerySelectDetail, type GalleryPhoto } from '../shared/photo-gallery/photo-gallery.element.js';

export type PhotoGalleryElement = HTMLElement & { photos: GalleryPhoto[] };

export function buildHeader(time: string, chipClass: string, chipLabel: string): HTMLElement {
  const header = document.createElement('div');
  header.className = 'app-header';
  header.innerHTML = `
    <span class="chip ${chipClass}">
      <span class="chip__dot"></span>
      ${chipLabel}
    </span>
    <span class="num app-header__time">${time}</span>`;
  return header;
}

export function buildSpeedDisplay(speed: string): HTMLElement {
  const display = document.createElement('div');
  display.className = 'speed-display';
  display.innerHTML = `
    <div class="num speed-value">${speed}</div>
    <div class="speed-unit">km/h</div>`;
  return display;
}

export function buildStatGrid(dist: string, time: string, alt: string): HTMLElement {
  const grid = document.createElement('div');
  grid.className = 'stat-grid';
  grid.innerHTML = `
    <div class="stat-tile">
      <span class="stat-label">Distancia</span>
      <span class="stat-value"><span data-live="dist">${dist}</span><span class="stat-unit"> km</span></span>
    </div>
    <div class="stat-tile">
      <span class="stat-label">Tiempo</span>
      <span class="stat-value" data-live="time-tile">${time}</span>
    </div>
    <div class="stat-tile">
      <span class="stat-label">Altitud</span>
      <span class="stat-value"><span data-live="alt">${alt}</span><span class="stat-unit"> m</span></span>
    </div>`;
  return grid;
}

export function buildAvgSpeedBanner(avgSpeed: string): HTMLElement {
  const banner = document.createElement('div');
  banner.className = 'avg-speed-banner';
  banner.innerHTML = `Vel. media de la ruta: <strong data-live="avg-speed">${avgSpeed} km/h</strong>`;
  return banner;
}

export interface LiveValues {
  speed: string;
  avgSpeed: string;
  dist: string;
  time: string;
  alt: string;
}

/**
 * Actualiza in-place los valores numéricos que cambian con cada tick del cronómetro
 * o cada punto GPS, sin reconstruir el árbol DOM. Antes, cockpit.element.ts llamaba a
 * render() (root.innerHTML = '') en cada uno de estos eventos — que ocurren cada
 * segundo durante la grabación — destruyendo y recreando <photo-capture> constantemente
 * y cerrando su menú "Cámara/Galería" casi al instante tras abrirlo.
 */
export function updateLiveDisplay(root: ShadowRoot, values: LiveValues): void {
  const timeEl = root.querySelector('.app-header__time');
  if (timeEl) timeEl.textContent = values.time;

  const speedEl = root.querySelector('.speed-value');
  if (speedEl) speedEl.textContent = values.speed;

  const distEl = root.querySelector('[data-live="dist"]');
  if (distEl) distEl.textContent = values.dist;

  const timeTileEl = root.querySelector('[data-live="time-tile"]');
  if (timeTileEl) timeTileEl.textContent = values.time;

  const altEl = root.querySelector('[data-live="alt"]');
  if (altEl) altEl.textContent = values.alt;

  const avgEl = root.querySelector('[data-live="avg-speed"]');
  if (avgEl) avgEl.textContent = `${values.avgSpeed} km/h`;
}

export interface ProgressArc {
  svg: SVGSVGElement;
  circle: SVGCircleElement;
}

export function buildProgressArc(): ProgressArc {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'control-btn__arc');
  svg.setAttribute('viewBox', '0 0 120 120');
  const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  circle.setAttribute('cx', '60');
  circle.setAttribute('cy', '60');
  circle.setAttribute('r', '56');
  svg.appendChild(circle);
  return { svg, circle };
}

export interface MasterButtonHandlers {
  onStart: () => void;
  onStopPress: () => void;
  onStopRelease: () => void;
}

export function buildMasterButton(isActive: boolean, handlers: MasterButtonHandlers, arc: ProgressArc | null): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.id = 'cockpit-master-btn';
  btn.setAttribute('data-cy', 'cockpit-master-btn');
  if (!isActive) {
    btn.className = 'control-btn start';
    btn.setAttribute('aria-label', 'Iniciar grabación');
    btn.innerHTML = '<span class="icon-record-dot"></span>';
    btn.addEventListener('click', handlers.onStart);
    return btn;
  }
  btn.className = 'control-btn stop';
  btn.setAttribute('aria-label', 'Mantén pulsado para finalizar la ruta');
  btn.innerHTML = '<span class="icon-stop"></span>';
  btn.addEventListener('pointerdown', handlers.onStopPress);
  btn.addEventListener('pointerup', handlers.onStopRelease);
  btn.addEventListener('pointerleave', handlers.onStopRelease);
  if (arc) btn.appendChild(arc.svg);
  return btn;
}

export function buildPauseButton(isActive: boolean, isPaused: boolean, onPauseResume: () => void): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.id = 'cockpit-pause-btn';
  btn.setAttribute('data-cy', 'cockpit-pause-btn');
  btn.className = 'control-btn pause';
  btn.setAttribute('aria-label', isPaused ? 'Reanudar ruta' : 'Pausar ruta');
  btn.innerHTML = isPaused
    ? '<span class="icon-play"></span>'
    : '<span class="icon-pause"><span class="icon-pause-bar"></span><span class="icon-pause-bar"></span></span>';
  if (isActive) {
    btn.addEventListener('click', onPauseResume);
  } else {
    btn.disabled = true;
  }
  return btn;
}

export interface ControlsOptions {
  isActive: boolean;
  isPaused: boolean;
  masterHandlers: MasterButtonHandlers;
  onPauseResume: () => void;
  arc: ProgressArc | null;
}

export function buildControls(options: ControlsOptions): HTMLElement {
  const { isActive, isPaused, masterHandlers, onPauseResume, arc } = options;
  const wrapper = document.createElement('div');
  const controls = document.createElement('div');
  controls.className = 'record-controls';
  controls.appendChild(buildPauseButton(isActive, isPaused, onPauseResume));
  controls.appendChild(buildMasterButton(isActive, masterHandlers, arc));
  wrapper.appendChild(controls);

  const labels = document.createElement('div');
  labels.className = 'control-labels';
  labels.innerHTML = `<span>${isPaused ? 'Reanudar' : 'Pausar'}</span><span class="wide">${isActive ? 'Finalizar' : 'Grabar'}</span>`;
  wrapper.appendChild(labels);
  return wrapper;
}

export function buildPhotoGalleryElement(onSelect: (index: number) => void): PhotoGalleryElement {
  const gallery = document.createElement('photo-gallery') as PhotoGalleryElement;
  gallery.setAttribute('data-cy', 'cockpit-photo-gallery');
  gallery.addEventListener(PHOTO_GALLERY_SELECT_EVENT, ((event: CustomEvent<PhotoGallerySelectDetail>) => {
    onSelect(event.detail.index);
  }) as EventListener);
  return gallery;
}

export function buildGpsOverlay(onRequestGps: () => void): HTMLElement {
  const overlay = document.createElement('div');
  overlay.id = 'gps-overlay';
  overlay.className = 'gps-overlay';
  overlay.style.display = 'none';
  overlay.innerHTML = `
    <p class="gps-overlay__message">Se necesita permiso de GPS para grabar rutas</p>
    <button id="gps-request-btn" class="btn btn-primary" data-cy="gps-request-btn">Abrir ajustes</button>`;
  const gpsBtn = overlay.querySelector('#gps-request-btn');
  gpsBtn?.addEventListener('click', onRequestGps);
  return overlay;
}

