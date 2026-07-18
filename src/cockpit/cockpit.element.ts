import { BaseElement } from '../shared/base-element.js';
import { createCockpitService, type CockpitService, type GpsProvider, type StorageProvider } from './cockpit.service.js';
import { formatSpeed, formatDuration } from './cockpit.transform.js';
import type { CockpitState } from './cockpit.types.js';
import type { IRouteRepository } from '../shared/models/route.repository.js';
import { SqliteRouteRepository } from '../shared/repositories/sqlite-route.repository.js';
import { createSqliteDb } from '../shared/repositories/sqlite-route.factory.js';
import { MemoryRouteRepository } from '../shared/repositories/memory-route.repository.js';
import { simulateRecording } from '../shared/services/route-simulator.js';
import styles from './cockpit.element.css?inline';

interface CockpitDisplayValues {
  speed: string;
  avgSpeed: string;
  dist: string;
  time: string;
  alt: string;
}

class CockpitView extends BaseElement {
  private service: CockpitService | null = null;
  private longPressTimer: ReturnType<typeof setTimeout> | null = null;
  private arcCircle: SVGCircleElement | null = null;
  private readonly LONG_PRESS_MS = 1500;
  private readonly ARC_CIRC = 377;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback(): void {
    void this.initAndRender();
  }

  private async initAndRender(): Promise<void> {
    await this.initService();
    this.render();
    void this.service?.checkGpsPermission();
  }

  disconnectedCallback(): void {
    this.cleanupLongPress();
  }

  private repo: IRouteRepository = new MemoryRouteRepository();
  private repoInjected = false;

  // Permite que app-root inyecte el repositorio compartido
  set repository(repo: IRouteRepository) {
    this.repo = repo;
    this.repoInjected = true;
  }

  private async initService(): Promise<void> {
    const gps = this.createGpsProvider();
    const storage: StorageProvider = {
      save: (_path: string, _data: string): Promise<void> => {
        return Promise.resolve();
      },
    };
    // Si no nos inyectaron repositorio, intentamos crear SQLite propio
    if (!this.repoInjected) {
      try {
        const sqliteDb = await createSqliteDb();
        this.repo = new SqliteRouteRepository(sqliteDb);
      } catch {
        this.repo = new MemoryRouteRepository();
      }
    }
    this.service = createCockpitService(gps, storage, this.repo);
    this.service.subscribe(() => {
      this.render();
    });
  }

  // TODO: Botón temporal de simulación — ELIMINAR cuando se valide la persistencia
  private async handleSimulate(): Promise<void> {
    const btn = this.shadowRoot?.getElementById('simulate-btn');
    if (btn) btn.textContent = 'Guardando...';
    try {
      const result = await simulateRecording(this.repo);
      const all = await this.repo.getAll();
      if (btn) btn.textContent = `✅ ${String(result.pointCount)} pts — ${String(all.length)} rutas`;
      setTimeout(() => {
        if (btn) btn.textContent = '🎲 Simular grabación';
      }, 3000);
    } catch {
      if (btn) btn.textContent = '❌ Error al guardar';
    }
  }

  private createGpsProvider(): GpsProvider {
    return {
      getCurrentPosition: () =>
        new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject);
        }),
      watchPosition: (callback) => {
        const id = navigator.geolocation.watchPosition(callback, () => { /* GPS error silently ignored */ });
        return (): void => { navigator.geolocation.clearWatch(id); };
      },
      checkPermissions: (): Promise<boolean> => {
        return Promise.resolve(navigator.geolocation !== null);
      },
      requestPermissions: (): Promise<boolean> => {
        if (!navigator.geolocation) return Promise.resolve(false);
        return new Promise((resolve) => {
          navigator.geolocation.getCurrentPosition(
            () => { resolve(true); },
            () => { resolve(false); },
          );
        });
      },
    };
  }

  private handleStartStop(): void {
    if (!this.service) return;
    const state = this.service.getCurrentState();
    if (state.status === 'idle') {
      if (!state.hasGpsPermission) {
        this.showGpsOverlay();
        return;
      }
      this.service.startRecording();
    }
  }

  private handleStopPress(): void {
    if (!this.service) return;
    this.longPressTimer = setTimeout(() => {
      this.service?.stopRecording();
      this.cleanupLongPress();
    }, this.LONG_PRESS_MS);
    this.animateArcProgress();
  }

  private handleStopRelease(): void {
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
    this.resetArcProgress();
  }

  private animateArcProgress(): void {
    const startTime = Date.now();
    const animate = (): void => {
      if (!this.arcCircle) return;
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / this.LONG_PRESS_MS, 1);
      const dashLength = String(this.ARC_CIRC * progress);
      const dashRemain = String(this.ARC_CIRC);
      this.arcCircle.style.strokeDasharray = `${dashLength} ${dashRemain}`;
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    requestAnimationFrame(animate);
  }

  private resetArcProgress(): void {
    if (this.arcCircle) {
      this.arcCircle.style.strokeDasharray = '0 377';
    }
  }

  private cleanupLongPress(): void {
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
    this.resetArcProgress();
  }

  private handlePauseResume(): void {
    if (!this.service) return;
    const state = this.service.getCurrentState();
    if (state.status === 'recording') {
      this.service.pauseRecording();
    } else if (state.status === 'paused') {
      this.service.resumeRecording();
    }
  }

  private handleInvisibleToggle(): void {
    if (!this.service) return;
    const state = this.service.getCurrentState();
    this.service.setInvisibleMode(!state.invisibleMode);
  }

  private showGpsOverlay(): void {
    const overlay = this.shadowRoot?.getElementById('gps-overlay');
    if (overlay) overlay.style.display = 'flex';
  }

  private handleRequestGps(): void {
    if (!this.service) return;
    void this.service.requestGpsPermission().then((ok) => {
      if (ok) {
        const overlay = this.shadowRoot?.getElementById('gps-overlay');
        if (overlay) overlay.style.display = 'none';
        this.service?.startRecording();
      }
    });
  }

  private getChipClass(): string {
    if (!this.service) return 'chip-neutral';
    const status = this.service.getCurrentState().status;
    if (status === 'recording') return 'chip-recording';
    if (status === 'paused') return 'chip-paused';
    return 'chip-neutral';
  }

  private getChipLabel(): string {
    if (!this.service) return 'Listo';
    const status = this.service.getCurrentState().status;
    if (status === 'recording') return 'En ruta';
    if (status === 'paused') return 'Pausada';
    return 'Listo';
  }

  private buildHeader(time: string): HTMLElement {
    const header = document.createElement('div');
    header.className = 'app-header';
    header.innerHTML = `
      <span class="chip ${this.getChipClass()}">
        <span class="chip__dot"></span>
        ${this.getChipLabel()}
      </span>
      <span class="num app-header__time">${time}</span>`;
    return header;
  }

  private buildSpeedDisplay(speed: string): HTMLElement {
    const display = document.createElement('div');
    display.className = 'speed-display';
    display.innerHTML = `
      <div class="num speed-value">${speed}</div>
      <div class="speed-unit">km/h</div>`;
    return display;
  }

  private buildStatGrid(dist: string, time: string, alt: string): HTMLElement {
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

  private buildAvgSpeedBanner(avgSpeed: string): HTMLElement {
    const banner = document.createElement('div');
    banner.className = 'avg-speed-banner';
    banner.innerHTML = `Vel. media de la ruta: <strong>${avgSpeed} km/h</strong>`;
    return banner;
  }

  private buildProgressArc(): SVGSVGElement {
    const arcSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    arcSvg.setAttribute('class', 'control-btn__arc');
    arcSvg.setAttribute('viewBox', '0 0 120 120');
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', '60');
    circle.setAttribute('cy', '60');
    circle.setAttribute('r', '56');
    this.arcCircle = circle;
    arcSvg.appendChild(circle);
    return arcSvg;
  }

  private buildMasterButton(isActive: boolean): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.id = 'cockpit-master-btn';
    btn.setAttribute('data-cy', 'cockpit-master-btn');
    if (!isActive) {
      btn.className = 'control-btn start';
      btn.setAttribute('aria-label', 'Iniciar grabación');
      btn.innerHTML = '<span class="icon-record-dot"></span>';
      btn.addEventListener('click', () => { this.handleStartStop(); });
      return btn;
    }
    btn.className = 'control-btn stop';
    btn.setAttribute('aria-label', 'Mantén pulsado para finalizar la ruta');
    btn.innerHTML = '<span class="icon-stop"></span>';
    btn.addEventListener('pointerdown', () => { this.handleStopPress(); });
    btn.addEventListener('pointerup', () => { this.handleStopRelease(); });
    btn.addEventListener('pointerleave', () => { this.handleStopRelease(); });
    btn.appendChild(this.buildProgressArc());
    return btn;
  }

  private buildPauseButton(isActive: boolean, isPaused: boolean): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.id = 'cockpit-pause-btn';
    btn.setAttribute('data-cy', 'cockpit-pause-btn');
    btn.className = 'control-btn pause';
    btn.setAttribute('aria-label', isPaused ? 'Reanudar ruta' : 'Pausar ruta');
    btn.innerHTML = isPaused
      ? '<span class="icon-play"></span>'
      : '<span style="display:flex; gap:6px;"><span class="icon-pause-bar"></span><span class="icon-pause-bar"></span></span>';
    if (isActive) {
      btn.addEventListener('click', () => { this.handlePauseResume(); });
    } else {
      btn.disabled = true;
    }
    return btn;
  }

  private buildControls(isActive: boolean, isPaused: boolean): HTMLElement {
    const wrapper = document.createElement('div');
    const controls = document.createElement('div');
    controls.className = 'record-controls';
    controls.appendChild(this.buildPauseButton(isActive, isPaused));
    controls.appendChild(this.buildMasterButton(isActive));
    wrapper.appendChild(controls);

    const labels = document.createElement('div');
    labels.className = 'control-labels';
    labels.innerHTML = `<span>${isPaused ? 'Reanudar' : 'Pausar'}</span><span class="wide">${isActive ? 'Finalizar' : 'Grabar'}</span>`;
    wrapper.appendChild(labels);
    return wrapper;
  }

  private buildInvisibleToggle(invisibleMode: boolean): HTMLElement {
    const btn = document.createElement('button');
    btn.id = 'cockpit-invisible-btn';
    btn.setAttribute('data-cy', 'cockpit-invisible-btn');
    btn.className = `invisible-toggle ${invisibleMode ? 'invisible-toggle--active' : ''}`;
    const eyePath = invisibleMode
      ? 'M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24M1 1l22 22'
      : 'M12 5c-7 0-11 8-11 8s4 8 11 8 11-8 11-8-4-8-11-8zm0 13a5 5 0 1 1 0-10 5 5 0 0 1 0 10zm0-8a3 3 0 1 0 0 6 3 3 0 0 0 0-6z';
    btn.innerHTML = `<svg viewBox="0 0 24 24"><path d="${eyePath}"/></svg><span>Modo invisible</span>`;
    btn.addEventListener('click', () => { this.handleInvisibleToggle(); });
    return btn;
  }

  private buildGpsOverlay(): HTMLElement {
    const overlay = document.createElement('div');
    overlay.id = 'gps-overlay';
    overlay.className = 'gps-overlay';
    overlay.style.display = 'none';
    overlay.innerHTML = `
      <p class="gps-overlay__message">Se necesita permiso de GPS para grabar rutas</p>
      <button id="gps-request-btn" class="btn btn-primary" data-cy="gps-request-btn">Abrir ajustes</button>`;
    const gpsBtn = overlay.querySelector('#gps-request-btn');
    gpsBtn?.addEventListener('click', () => { this.handleRequestGps(); });
    return overlay;
  }

  private getDisplayValues(state: CockpitState | undefined): CockpitDisplayValues {
    if (!state) return { speed: '0', avgSpeed: '--', dist: '--', time: '--:--', alt: '--' };
    return {
      speed: formatSpeed(state.currentSpeed),
      avgSpeed: state.avgSpeed.toFixed(0),
      dist: state.totalDistance.toFixed(1),
      time: formatDuration(state.elapsedTime),
      alt: state.altitude.toFixed(0),
    };
  }

  protected render(): void {
    const root = this.shadowRoot;
    if (!root) return;
    const state = this.service?.getCurrentState();
    const isActive = state?.status === 'recording' || state?.status === 'paused';
    const isPaused = state?.status === 'paused';
    const { speed, avgSpeed, dist, time, alt } = this.getDisplayValues(state);

    const style = document.createElement('style');
    style.textContent = styles;
    const screen = document.createElement('div');
    screen.className = 'cockpit-screen';
    screen.appendChild(this.buildHeader(time));
    screen.appendChild(this.buildSpeedDisplay(speed));
    screen.appendChild(this.buildStatGrid(dist, time, alt));
    screen.appendChild(this.buildAvgSpeedBanner(avgSpeed));
    screen.appendChild(this.buildControls(isActive, isPaused));
    screen.appendChild(this.buildInvisibleToggle(state?.invisibleMode ?? false));

    const wrapper = document.createElement('div');
    wrapper.className = 'app-wrapper';
    wrapper.appendChild(screen);

    root.innerHTML = '';
    root.appendChild(style);
    root.appendChild(wrapper);
    root.appendChild(this.buildGpsOverlay());
    // TODO: TEMPORAL — Eliminar tras validar persistencia
    const sb = document.createElement('button');
    sb.id = 'simulate-btn';
    sb.setAttribute('data-cy', 'simulate-btn');
    sb.textContent = '\u{1F3B2} Simular grabaci\u00F3n';
    sb.style.cssText = 'display:block;width:100%;margin-top:16px;padding:10px;border:1px solid var(--amber);border-radius:var(--r-md,8px);background:var(--panel,oklch(24% 0.02 50));color:var(--ink,oklch(92% 0.01 60));font-family:var(--font-ui,sans-serif);font-size:14px;cursor:pointer;';
    sb.addEventListener('click', () => { void this.handleSimulate(); });
    root.appendChild(sb);
  }
}

customElements.define('cockpit-view', CockpitView);
