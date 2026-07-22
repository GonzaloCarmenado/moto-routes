import { BaseElement } from '../shared/base-element.js';
import { createCockpitService, createBrowserGpsProvider, type CockpitService, type StorageProvider } from './cockpit.service.js';
import { getCockpitDisplayValues, getStatusChipClass, getStatusChipLabel } from './cockpit.transform.js';
import type { CockpitState } from './cockpit.types.js';
import type { IRouteRepository } from '../shared/models/route.repository.js';
import type { IPhotoRepository } from '../shared/models/photo.repository.js';
import { createPhotoRepository } from '../shared/services/photo-storage.service.js';
import '../photos/photo-capture.element.js';
import type { PhotoCaptureElement } from '../photos/photo-capture.element.js';
import { PHOTO_CAPTURE_EVENT, type PhotoCaptureEventDetail } from '../photos/photo-capture.types.js';
import { captureFromCamera, pickFromGallery } from '../shared/services/photo-capture-adapter.service.js';
import { processPhotoCapture } from './cockpit-photo.service.js';
import { toErrorMessage } from '../shared/utils/errors.js';
import { showToast } from '../shared/utils/toast.js';
import { SqliteRouteRepository } from '../shared/repositories/sqlite-route.repository.js';
import { createSqliteDb } from '../shared/repositories/sqlite-route.factory.js';
import { MemoryRouteRepository } from '../shared/repositories/memory-route.repository.js';
import {
  buildHeader,
  buildSpeedDisplay,
  buildStatGrid,
  buildAvgSpeedBanner,
  buildProgressArc,
  buildControls,
  buildInvisibleToggle,
  buildGpsOverlay,
  updateLiveDisplay,
  type ProgressArc,
} from './cockpit.render.js';
import styles from './cockpit.element.css?inline';

class CockpitView extends BaseElement {
  private service: CockpitService | null = null;
  private longPressTimer: ReturnType<typeof setTimeout> | null = null;
  private arcCircle: SVGCircleElement | null = null;
  private readonly LONG_PRESS_MS = 1500;
  private readonly ARC_CIRC = 377;
  private photoRepo: IPhotoRepository | null = null;
  private photoCaptureEl: PhotoCaptureElement | null = null;
  private lastStatus: CockpitState['status'] | null = null;
  private lastInvisibleMode: boolean | null = null;

  private async getPhotoRepo(): Promise<IPhotoRepository> {
    this.photoRepo ??= await createPhotoRepository();
    return this.photoRepo;
  }

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
    this.syncRenderSignature();
    void this.service?.checkGpsPermission();
  }

  /** Recuerda los campos "estructurales" del último render completo, para que el
   * listener de estado sepa si un cambio necesita reconstruir el DOM o solo
   * actualizar los números en sitio (ver updateLiveValues). */
  private syncRenderSignature(): void {
    const state = this.service?.getCurrentState();
    this.lastStatus = state?.status ?? null;
    this.lastInvisibleMode = state?.invisibleMode ?? null;
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
    const gps = createBrowserGpsProvider();
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
    this.service.subscribe((state) => {
      // El tick del cronómetro y cada punto GPS notifican una vez por segundo aprox.
      // Reconstruir todo el DOM en cada uno de esos eventos destruía <photo-capture>
      // con su menú Cámara/Galería recién abierto. Solo hace falta un render completo
      // cuando cambia algo "estructural" (status/invisibleMode); el resto son solo
      // números que se actualizan in-place.
      const structuralChange = state.status !== this.lastStatus || state.invisibleMode !== this.lastInvisibleMode;
      this.lastStatus = state.status;
      this.lastInvisibleMode = state.invisibleMode;
      if (structuralChange) {
        this.render();
      } else {
        this.updateLiveValues(state);
      }
    });
  }

  private updateLiveValues(state: CockpitState): void {
    const root = this.shadowRoot;
    if (!root) return;
    updateLiveDisplay(root, getCockpitDisplayValues(state));
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

  private buildPhotoCaptureButton(): PhotoCaptureElement {
    const photoCapture = document.createElement('photo-capture') as PhotoCaptureElement;
    photoCapture.setAttribute('data-cy', 'cockpit-photo-capture');
    photoCapture.addEventListener(PHOTO_CAPTURE_EVENT, ((event: CustomEvent<PhotoCaptureEventDetail>) => {
      void this.handlePhotoCapture(event.detail.source);
    }) as EventListener);
    return photoCapture;
  }

  private buildScreen(
    state: CockpitState | undefined,
    isActive: boolean,
    isPaused: boolean,
    arc: ProgressArc | null,
  ): HTMLElement {
    const { speed, avgSpeed, dist, time, alt } = getCockpitDisplayValues(state);
    const screen = document.createElement('div');
    screen.className = 'cockpit-screen';
    screen.appendChild(buildHeader(time, getStatusChipClass(state?.status), getStatusChipLabel(state?.status)));
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

    this.photoCaptureEl = isActive ? this.buildPhotoCaptureButton() : null;
    if (this.photoCaptureEl) screen.appendChild(this.photoCaptureEl);

    return screen;
  }

  protected render(): void {
    const root = this.shadowRoot;
    if (!root) return;
    const state = this.service?.getCurrentState();
    const isActive = state?.status === 'recording' || state?.status === 'paused';
    const isPaused = state?.status === 'paused';
    const arc = isActive ? this.buildArc() : null;

    const style = document.createElement('style');
    style.textContent = styles;
    const screen = this.buildScreen(state, isActive, isPaused, arc);

    const wrapper = document.createElement('div');
    wrapper.className = 'app-wrapper';
    wrapper.appendChild(screen);

    root.innerHTML = '';
    root.appendChild(style);
    root.appendChild(wrapper);
    root.appendChild(buildGpsOverlay(() => { this.handleRequestGps(); }));
  }

  private async handlePhotoCapture(source: 'camera' | 'gallery'): Promise<void> {
    if (!this.service) return;
    const state = this.service.getCurrentState();
    if (state.status !== 'recording' && state.status !== 'paused') return;

    // 1. Capturar imagen según fuente seleccionada
    const file = source === 'camera'
      ? await captureFromCamera()
      : await pickFromGallery();

    // 2. routeId pre-generado al iniciar la grabación (ver CockpitState.routeId):
    // es el mismo id con el que la ruta se persistirá al llamar a stopRecording(),
    // así las fotos capturadas en pleno directo quedan correctamente asociadas.
    const routeId = state.routeId;

    // 3. Obtener el último punto GPS
    const lastPoint = state.points.length > 0
      ? state.points[state.points.length - 1]!
      : null;

    // 4. Procesar la foto (con feedback de carga: guardar en appDataDir puede tardar
    // un momento y sin indicador parece que la subida no ha hecho nada)
    if (file && this.photoCaptureEl) this.photoCaptureEl.loading = true;
    try {
      const photoRepo = await this.getPhotoRepo();
      await processPhotoCapture({
        file,
        routeId,
        photoRepo,
        lastPoint,
        routePoints: state.points.map((p) => ({ lat: p.lat, lng: p.lng })),
        callbacks: {
          onSuccess: () => {
            showToast('📷 Foto añadida', 'success');
          },
          onError: (error: string) => {
            showToast(`⚠️ No se pudo guardar la foto: ${error}`, 'error');
          },
          onCancel: () => {
            // User cancelled, nothing to do
          },
        },
      });
    } catch (err) {
      // Red de seguridad: cualquier fallo no cubierto por los callbacks de arriba
      // (p.ej. un error al abrir la cámara/galería) también debe ser visible,
      // nunca desaparecer como un unhandled promise rejection silencioso.
      const message = toErrorMessage(err, 'Error inesperado al añadir la foto');
      showToast(`⚠️ ${message}`, 'error');
    } finally {
      if (this.photoCaptureEl) this.photoCaptureEl.loading = false;
    }
  }

  private buildArc(): ProgressArc {
    const arc = buildProgressArc();
    this.arcCircle = arc.circle;
    return arc;
  }
}

customElements.define('cockpit-view', CockpitView);
