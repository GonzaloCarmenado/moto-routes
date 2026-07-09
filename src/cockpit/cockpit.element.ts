import { BaseElement } from '../shared/base-element.js';
import { createCockpitService, type CockpitService, type GpsProvider, type StorageProvider } from './cockpit.service.js';
import { formatSpeed, formatDuration } from './cockpit.transform.js';
import styles from './cockpit.element.css?inline';

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
    this.initService();
    this.render();
    void this.service?.checkGpsPermission();
  }

  disconnectedCallback(): void {
    this.cleanupLongPress();
  }

  private initService(): void {
    const gps = this.createGpsProvider();
    const storage: StorageProvider = {
      save: (_path: string, _data: string): Promise<void> => {
        return Promise.resolve();
      },
    };
    this.service = createCockpitService(gps, storage);
    this.service.subscribe(() => {
      this.render();
    });
  }

  private createGpsProvider(): GpsProvider {
    return {
      getCurrentPosition: () =>
        new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject);
        }),
      watchPosition: (callback) => {
        const id = navigator.geolocation.watchPosition(callback, () => {});
        return () => navigator.geolocation.clearWatch(id);
      },
      checkPermissions: (): Promise<boolean> => {
        return Promise.resolve(navigator.geolocation !== null);
      },
      requestPermissions: (): Promise<boolean> => {
        if (!navigator.geolocation) return Promise.resolve(false);
        return new Promise((resolve) => {
          navigator.geolocation.getCurrentPosition(
            () => resolve(true),
            () => resolve(false),
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

  private getStatusDotClass(): string {
    if (!this.service) return 'status-dot--stopped';
    const status = this.service.getCurrentState().status;
    if (status === 'recording') return '';
    if (status === 'paused') return 'status-dot--paused';
    return 'status-dot--stopped';
  }

  private getStatusText(): string {
    if (!this.service) return 'STOP';
    const status = this.service.getCurrentState().status;
    if (status === 'recording') return 'REC';
    if (status === 'paused') return 'PAUSE';
    return 'STOP';
  }

  private buildStatusBar(): HTMLElement {
    const bar = document.createElement('div');
    bar.className = 'status-bar';
    bar.innerHTML = `
      <span>Moto Routes</span>
      <div class="status-bar__recording">
        <span class="status-dot ${this.getStatusDotClass()}"></span>
        <span>${this.getStatusText()}</span>
      </div>`;
    return bar;
  }

  private buildDial(speed: string): HTMLElement {
    const dial = document.createElement('div');
    dial.className = 'cockpit-dial';
    dial.innerHTML = `
      <div class="cockpit-dial__value">${speed}</div>
      <div class="cockpit-dial__unit">km/h</div>`;
    return dial;
  }

  private buildMasterButton(isActive: boolean): HTMLElement {
    const btn = document.createElement('button');
    btn.id = 'cockpit-master-btn';
    btn.setAttribute('data-cy', 'cockpit-master-btn');
    btn.className = `btn-master-rec ${isActive ? 'btn-master-rec--active' : ''}`;
    btn.textContent = isActive ? 'STOP' : '● START';
    if (!isActive) {
      btn.addEventListener('click', () => { this.handleStartStop(); });
    } else {
      btn.addEventListener('pointerdown', () => { this.handleStopPress(); });
      btn.addEventListener('pointerup', () => { this.handleStopRelease(); });
      btn.addEventListener('pointerleave', () => { this.handleStopRelease(); });
    }
    const arcSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    arcSvg.setAttribute('class', 'btn-master-rec__arc');
    arcSvg.setAttribute('viewBox', '0 0 120 120');
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', '60');
    circle.setAttribute('cy', '60');
    circle.setAttribute('r', '56');
    this.arcCircle = circle;
    arcSvg.appendChild(circle);
    btn.appendChild(arcSvg);
    return btn;
  }

  private buildActionsRow(
    isActive: boolean, isPaused: boolean, invisibleMode: boolean,
  ): HTMLElement {
    const row = document.createElement('div');
    row.className = 'actions-row';

    const pauseBtn = document.createElement('button');
    pauseBtn.id = 'cockpit-pause-btn';
    pauseBtn.setAttribute('data-cy', 'cockpit-pause-btn');
    pauseBtn.className = 'action-btn';
    pauseBtn.innerHTML = `
      <svg viewBox="0 0 24 24">${isPaused
        ? '<polygon points="6 4 20 12 6 20 6 4" fill="currentColor"/>'
        : '<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>'}</svg>
      <span>${isPaused ? 'Reanudar' : 'Pausa'}</span>`;
    if (isActive) {
      pauseBtn.addEventListener('click', () => { this.handlePauseResume(); });
    } else {
      pauseBtn.style.opacity = '0.3';
      pauseBtn.style.pointerEvents = 'none';
    }

    const invisBtn = document.createElement('button');
    invisBtn.id = 'cockpit-invisible-btn';
    invisBtn.setAttribute('data-cy', 'cockpit-invisible-btn');
    invisBtn.className = `action-btn ${invisibleMode ? 'action-btn--active' : ''}`;
    const eyePath = invisibleMode
      ? 'M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24M1 1l22 22'
      : 'M12 5c-7 0-11 8-11 8s4 8 11 8 11-8 11-8-4-8-11-8zm0 13a5 5 0 1 1 0-10 5 5 0 0 1 0 10zm0-8a3 3 0 1 0 0 6 3 3 0 0 0 0-6z';
    invisBtn.innerHTML = `
      <svg viewBox="0 0 24 24"><path d="${eyePath}"/></svg>
      <span>Invisible</span>`;
    invisBtn.addEventListener('click', () => { this.handleInvisibleToggle(); });

    row.appendChild(pauseBtn);
    row.appendChild(invisBtn);
    return row;
  }

  private buildTelemetryGrid(
    isRecording: boolean, avgSpeed: string, dist: string, time: string, alt: string,
  ): HTMLElement {
    const grid = document.createElement('div');
    grid.className = 'telemetry-grid';
    grid.innerHTML = `
      <div class="telemetry-block ${isRecording ? 'telemetry-block--highlight' : ''}">
        <div class="telemetry-block__label">Vel. Media</div>
        <div class="telemetry-block__value">${avgSpeed}<span>km/h</span></div>
      </div>
      <div class="telemetry-block">
        <div class="telemetry-block__label">Distancia</div>
        <div class="telemetry-block__value">${dist}<span>km</span></div>
      </div>
      <div class="telemetry-block">
        <div class="telemetry-block__label">Tiempo</div>
        <div class="telemetry-block__value">${time}<span></span></div>
      </div>
      <div class="telemetry-block">
        <div class="telemetry-block__label">Altitud</div>
        <div class="telemetry-block__value">${alt}<span>m</span></div>
      </div>`;
    return grid;
  }

  private buildGpsOverlay(): HTMLElement {
    const overlay = document.createElement('div');
    overlay.id = 'gps-overlay';
    overlay.className = 'gps-overlay';
    overlay.style.display = 'none';
    overlay.innerHTML = `
      <p class="gps-overlay__message">Se necesita permiso de GPS para grabar rutas</p>
      <button id="gps-request-btn" class="gps-overlay__btn" data-cy="gps-request-btn">Abrir ajustes</button>`;
    const gpsBtn = overlay.querySelector('#gps-request-btn');
    gpsBtn?.addEventListener('click', () => { this.handleRequestGps(); });
    return overlay;
  }

  protected render(): void {
    const root = this.shadowRoot;
    if (!root) return;
    const state = this.service?.getCurrentState();
    const isRecording = state?.status === 'recording';
    const isPaused = state?.status === 'paused';
    const isActive = isRecording || isPaused;

    const speed = state ? formatSpeed(state.currentSpeed) : '0';
    const avgSpeed = state ? String(state.avgSpeed.toFixed(0)) : '--';
    const dist = state ? String(state.totalDistance.toFixed(1)) : '--';
    const time = state ? formatDuration(state.elapsedTime) : '--:--';
    const alt = state ? String(state.altitude.toFixed(0)) : '--';

    const style = document.createElement('style');
    style.textContent = styles;
    const wrapper = document.createElement('div');
    wrapper.className = 'app-wrapper';
    wrapper.appendChild(this.buildStatusBar());
    wrapper.appendChild(this.buildDial(speed));
    wrapper.appendChild(this.buildMasterButton(isActive));
    wrapper.appendChild(this.buildActionsRow(isActive, isPaused, state?.invisibleMode ?? false));
    wrapper.appendChild(this.buildTelemetryGrid(isRecording, avgSpeed, dist, time, alt));

    root.innerHTML = '';
    root.appendChild(style);
    root.appendChild(wrapper);
    root.appendChild(this.buildGpsOverlay());
  }
}

customElements.define('cockpit-view', CockpitView);