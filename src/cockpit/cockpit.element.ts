import { BaseElement } from '../shared/base-element.js';
import { createCockpitService, type CockpitService, type GpsProvider, type StorageProvider } from './cockpit.service.js';
import { formatSpeed, formatDuration } from './cockpit.transform.js';
import type { CockpitState } from './cockpit.types.js';
import type { IRouteRepository } from '../shared/models/route.repository.js';
import type { IPhotoRepository } from '../shared/models/photo.repository.js';
import { MemoryPhotoRepository } from '../shared/repositories/memory-photo.repository.js';
import { PHOTO_CAPTURE_EVENT, type PhotoCaptureEventDetail } from '../photos/photo-capture.types.js';
import { captureFromCamera, pickFromGallery } from '../shared/services/photo-capture-adapter.service.js';
import { processPhotoCapture } from './cockpit-photo.service.js';
import { SqliteRouteRepository } from '../shared/repositories/sqlite-route.repository.js';
import { createSqliteDb } from '../shared/repositories/sqlite-route.factory.js';
import { MemoryRouteRepository } from '../shared/repositories/memory-route.repository.js';
import { simulateRecording } from '../shared/services/route-simulator.js';
import {
  buildHeader,
  buildSpeedDisplay,
  buildStatGrid,
  buildAvgSpeedBanner,
  buildProgressArc,
  buildControls,
  buildInvisibleToggle,
  buildGpsOverlay,
  buildSimulateButton,
  type ProgressArc,
} from './cockpit.render.js';
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
  private photoRepo: IPhotoRepository = new MemoryPhotoRepository();

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
    const arc = isActive ? this.buildArc() : null;

    const style = document.createElement('style');
    style.textContent = styles;
    const screen = document.createElement('div');
    screen.className = 'cockpit-screen';
    screen.appendChild(buildHeader(time, this.getChipClass(), this.getChipLabel()));
    screen.appendChild(buildSpeedDisplay(speed));
    screen.appendChild(buildStatGrid(dist, time, alt));
    screen.appendChild(buildAvgSpeedBanner(avgSpeed));
    screen.appendChild(buildControls({
      isActive,
      isPaused,
      masterHandlers: {
        onStart: () => { this.handleStartStop(); },
        onStopPress: () => { this.handleStopPress(); },
        onStopRelease: () => { this.handleStopRelease(); },
      },
      onPauseResume: () => { this.handlePauseResume(); },
      arc,
    }));
    screen.appendChild(buildInvisibleToggle(state?.invisibleMode ?? false, () => { this.handleInvisibleToggle(); }));

    // Photo capture button - only visible during recording or paused
    if (isActive) {
      const photoCapture = document.createElement('photo-capture') as HTMLElement;
      photoCapture.setAttribute('data-cy', 'cockpit-photo-capture');
      photoCapture.addEventListener(PHOTO_CAPTURE_EVENT, ((event: CustomEvent<PhotoCaptureEventDetail>) => {
        void this.handlePhotoCapture(event.detail.source);
      }) as EventListener);
      screen.appendChild(photoCapture);
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'app-wrapper';
    wrapper.appendChild(screen);

    root.innerHTML = '';
    root.appendChild(style);
    root.appendChild(wrapper);
    root.appendChild(buildGpsOverlay(() => { this.handleRequestGps(); }));
    root.appendChild(buildSimulateButton(() => { void this.handleSimulate(); }));
  }

  private async handlePhotoCapture(source: 'camera' | 'gallery'): Promise<void> {
    if (!this.service) return;
    const state = this.service.getCurrentState();
    if (state.status !== 'recording' && state.status !== 'paused') return;

    // 1. Capturar imagen según fuente seleccionada
    const file = source === 'camera'
      ? await captureFromCamera()
      : await pickFromGallery();

    // 2. Obtener el routeId actual (necesitamos acceder al repositorio)
    // En el cockpit, el routeId se asigna al guardar la ruta.
    // Para fotos durante grabación, usamos un ID temporal o
    // el ID que tendrá la ruta al guardarse.
    const routeId = this.repoInjected ? 'pending-route' : 'pending-route';

    // 3. Obtener el último punto GPS
    const lastPoint = state.points.length > 0
      ? state.points[state.points.length - 1]!
      : null;

    // 4. Procesar la foto
    await processPhotoCapture(
      file,
      routeId,
      this.photoRepo,
      lastPoint,
      state.points.map((p) => ({ lat: p.lat, lng: p.lng })),
      {
        onSuccess: () => {
          this.showPhotoToast();
        },
        onError: (error: string) => {
          console.error('Photo capture error:', error);
        },
        onCancel: () => {
          // User cancelled, nothing to do
        },
      },
    );
  }

  private showPhotoToast(): void {
    // Show a temporary toast notification
    const toast = document.createElement('div');
    toast.className = 'photo-toast';
    toast.setAttribute('data-cy', 'photo-toast');
    toast.textContent = '📷 Foto añadida';
    toast.style.cssText = `
      position: fixed;
      bottom: 100px;
      left: 50%;
      transform: translateX(-50%);
      background: var(--amber-soft, rgba(232, 168, 56, 0.15));
      color: var(--amber, #e8a838);
      padding: 8px 16px;
      border-radius: 8px;
      font-family: var(--font-ui, Barlow, sans-serif);
      font-size: 14px;
      z-index: 1000;
      animation: fadeInOut 3s ease forwards;
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }

  private buildArc(): ProgressArc {
    const arc = buildProgressArc();
    this.arcCircle = arc.circle;
    return arc;
  }
}

customElements.define('cockpit-view', CockpitView);
