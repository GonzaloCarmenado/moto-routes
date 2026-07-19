/**
 * Constructores de DOM puros para <cockpit-view>. Sin estado propio: reciben
 * los datos ya formateados y callbacks de interacción, y devuelven elementos.
 * Extraído de cockpit.element.ts para mantener el archivo bajo el límite de
 * tamaño (specs/ui/frontend-conventions.md).
 */

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
      <span class="stat-value">${dist}<span class="stat-unit"> km</span></span>
    </div>
    <div class="stat-tile">
      <span class="stat-label">Tiempo</span>
      <span class="stat-value">${time}</span>
    </div>
    <div class="stat-tile">
      <span class="stat-label">Altitud</span>
      <span class="stat-value">${alt}<span class="stat-unit"> m</span></span>
    </div>`;
  return grid;
}

export function buildAvgSpeedBanner(avgSpeed: string): HTMLElement {
  const banner = document.createElement('div');
  banner.className = 'avg-speed-banner';
  banner.innerHTML = `Vel. media de la ruta: <strong>${avgSpeed} km/h</strong>`;
  return banner;
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
    : '<span style="display:flex; gap:6px;"><span class="icon-pause-bar"></span><span class="icon-pause-bar"></span></span>';
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

export function buildInvisibleToggle(invisibleMode: boolean, onToggle: () => void): HTMLElement {
  const btn = document.createElement('button');
  btn.id = 'cockpit-invisible-btn';
  btn.setAttribute('data-cy', 'cockpit-invisible-btn');
  btn.className = `invisible-toggle ${invisibleMode ? 'invisible-toggle--active' : ''}`;
  const eyePath = invisibleMode
    ? 'M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24M1 1l22 22'
    : 'M12 5c-7 0-11 8-11 8s4 8 11 8 11-8 11-8-4-8-11-8zm0 13a5 5 0 1 1 0-10 5 5 0 0 1 0 10zm0-8a3 3 0 1 0 0 6 3 3 0 0 0 0-6z';
  btn.innerHTML = `<svg viewBox="0 0 24 24"><path d="${eyePath}"/></svg><span>Modo invisible</span>`;
  btn.addEventListener('click', onToggle);
  return btn;
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

export function buildSimulateButton(onSimulate: () => void): HTMLButtonElement {
  const sb = document.createElement('button');
  sb.id = 'simulate-btn';
  sb.setAttribute('data-cy', 'simulate-btn');
  sb.textContent = '\u{1F3B2} Simular grabación';
  sb.style.cssText = 'display:block;width:100%;margin-top:16px;padding:10px;border:1px solid var(--amber);border-radius:var(--r-md,8px);background:var(--panel,oklch(24% 0.02 50));color:var(--ink,oklch(92% 0.01 60));font-family:var(--font-ui,sans-serif);font-size:14px;cursor:pointer;';
  sb.addEventListener('click', onSimulate);
  return sb;
}
