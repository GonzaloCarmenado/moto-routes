import { BaseElement } from '../shared/base-element.js';
import { createCockpitService, createBrowserGpsProvider, type CockpitService, type StorageProvider } from './cockpit.service.js';
import { createTauriForegroundServiceProvider } from './gps/cockpit-foreground.service.js';
import { createNativeGpsProvider, isAndroidTauri, selectGpsProvider } from './gps/cockpit-native-gps.service.js';
import { getCockpitDisplayValues, getStatusChipClass, getStatusChipLabel, buildPhotoCaptureContext } from './cockpit.transform.js';
import type { CockpitState } from './cockpit.types.js';
import type { IRouteRepository } from '../shared/models/route.repository.js';
import type { IPhotoRepository } from '../shared/models/photo.repository.js';
import { createPhotoRepository } from '../shared/services/photo-storage.service.js';
import '../shared/photo-capture/photo-capture.element.js';
import type { PhotoCaptureElement } from '../shared/photo-capture/photo-capture.element.js';
import { PHOTO_CAPTURE_EVENT, type PhotoCaptureEventDetail } from '../shared/photo-capture/photo-capture.types.js';
import { applyPhotoCaptureLimit } from '../shared/photo-capture/photo-capture.limit.js';
import { openPhotoViewer } from '../shared/photo-viewer/photo-viewer.element.js';
import { captureFromCamera, pickFromGallery } from '../shared/services/photo-capture-adapter.service.js';
import { processMultiplePhotos, fetchGalleryPhotos, deleteCockpitPhoto } from './photo/cockpit-photo.service.js';
import { toErrorMessage } from '../shared/utils/errors.js';
import { showToast } from '../shared/feedback/toast.js';
import { resolveStopDecision } from './stop/cockpit-stop.service.js';
import { createLongPressController, type LongPressController } from './long-press/cockpit-long-press.js';
import { SqliteRouteRepository } from '../shared/repositories/sqlite-route.repository.js';
import { createSqliteDb } from '../shared/repositories/sqlite-route.factory.js';
import { MemoryRouteRepository } from '../shared/repositories/memory-route.repository.js';
import { MemoryStopTypesCacheRepository } from '../shared/repositories/memory-stop-types-cache.repository.js';
import { createStopTypesCacheRepository } from '../shared/repositories/sqlite-stop-types-cache.factory.js';
import type { IStopTypesCacheRepository } from '../shared/models/stop-types-cache.repository.js';
import { markStopFlow } from './mark-stop/cockpit-mark-stop.service.js';
import {
  buildHeader,
  buildSpeedDisplay,
  buildStatGrid,
  buildAvgSpeedBanner,
  buildProgressArc,
  buildControls,
  buildGpsOverlay,
  buildPhotoGalleryElement,
  updateLiveDisplay,
  type ProgressArc,
  type PhotoGalleryElement,
} from './cockpit.render.js';
import styles from './cockpit.element.css?inline';

class CockpitView extends BaseElement {
  private service: CockpitService | null = null;
  private arcCircle: SVGCircleElement | null = null;
  private readonly LONG_PRESS_MS = 1500;
  private readonly ARC_CIRC = 377;
  private readonly longPress: LongPressController;
  private photoRepo: IPhotoRepository | null = null;
  private photoCaptureEl: PhotoCaptureElement | null = null;
  private galleryEl: PhotoGalleryElement | null = null;
  private lastStatus: CockpitState['status'] | null = null;

  private async getPhotoRepo(): Promise<IPhotoRepository> {
    this.photoRepo ??= await createPhotoRepository();
    return this.photoRepo;
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.longPress = createLongPressController(
      this.LONG_PRESS_MS, this.ARC_CIRC,
      () => this.arcCircle,
      () => { void this.confirmStopRecording(); },
    );
  }

  connectedCallback(): void {
    void this.initAndRender();
  }

  private async initAndRender(): Promise<void> {
    await this.initService();
    this.render();
    this.syncRenderSignature();
    // Sin esperar: probeGeolocationPermission() (cockpit-browser-gps.service.ts)
    // pide una localización real y puede tardar varios segundos — bloquear el
    // primer render con eso dejaría el cockpit en blanco al abrir la app. Se
    // dispara en segundo plano solo para tener `hasGpsPermission` ya resuelto
    // como camino rápido si el usuario tarda en pulsar "Iniciar"; si no le da
    // tiempo a resolver, handleStartStop() repite la comprobación fresca en
    // el momento de pulsar en vez de fiarse de este valor todavía sin fijar.
    void this.service?.checkGpsPermission();
  }

  /** Recuerda los campos "estructurales" del último render completo, para que el
   * listener de estado sepa si un cambio necesita reconstruir el DOM o solo
   * actualizar los números en sitio (ver updateLiveValues). */
  private syncRenderSignature(): void {
    const state = this.service?.getCurrentState();
    this.lastStatus = state?.status ?? null;
  }

  disconnectedCallback(): void {
    this.longPress.cleanup();
  }

  private repo: IRouteRepository = new MemoryRouteRepository();
  private repoInjected = false;
  private stopTypesCache: IStopTypesCacheRepository = new MemoryStopTypesCacheRepository();
  private stopTypesCacheInjected = false;

  // Permite que app-root inyecte el repositorio y la caché compartidos
  set repository(repo: IRouteRepository) { this.repo = repo; this.repoInjected = true; }
  set stopTypesCacheRepository(repo: IStopTypesCacheRepository) { this.stopTypesCache = repo; this.stopTypesCacheInjected = true; }

  private async initService(): Promise<void> {
    // El foreground service Android (RecordingService.kt) es la única fuente de
    // puntos GPS mientras la grabación está activa (AC-020): navigator.geolocation
    // .watchPosition() se pausa/limita en segundo plano, algo que la captura nativa
    // reenviada vía evento Tauri no sufre. Fuera de un WebView Android real (web,
    // desktop) se mantiene el provider de navegador sin cambios.
    const browserGps = createBrowserGpsProvider();
    const gps = selectGpsProvider(isAndroidTauri(), createNativeGpsProvider(browserGps), browserGps);
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
    if (!this.stopTypesCacheInjected) {
      this.stopTypesCache = await createStopTypesCacheRepository();
    }
    this.service = createCockpitService(gps, storage, this.repo, createTauriForegroundServiceProvider());
    this.service.subscribe((state) => {
      // El tick del cronómetro y cada punto GPS notifican una vez por segundo aprox.
      // Reconstruir todo el DOM en cada uno de esos eventos destruía <photo-capture>
      // con su menú Cámara/Galería recién abierto. Solo hace falta un render completo
      // cuando cambia algo "estructural" (status); el resto son solo números que se
      // actualizan in-place.
      const structuralChange = state.status !== this.lastStatus;
      this.lastStatus = state.status;
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
    void this.startIfPermitted();
  }

  /**
   * `hasGpsPermission` en caché (poblado en segundo plano por
   * `checkGpsPermission()` desde `initAndRender()`) es solo el camino rápido:
   * si el usuario pulsa "Iniciar" antes de que esa comprobación de fondo
   * resuelva, no se fía de un `false` que solo significa "todavía no lo sé"
   * — repite el sondeo real aquí mismo antes de decidir. Evita tanto el falso
   * positivo (overlay con el permiso ya concedido de verdad) como arrancar
   * `startRecording()` sin saber de verdad si hay permiso (crash nativo real,
   * ver cockpit-browser-gps.service.ts::probeGeolocationPermission).
   */
  private async startIfPermitted(): Promise<void> {
    if (!this.service) return;
    const state = this.service.getCurrentState();
    if (state.status !== 'idle') return;
    const granted = state.hasGpsPermission || (await this.service.checkGpsPermission());
    if (!granted) {
      this.showGpsOverlay();
      return;
    }
    this.service.startRecording();
  }

  private handleStopPress(): void {
    if (!this.service) return;
    this.longPress.press();
  }

  /**
   * Al completar el long-press de parada: congela la grabación (sin persistir
   * ni resetear) y pregunta si guardar o descartar. El diálogo no es cerrable
   * (ni ESC ni click fuera): parar una ruta obliga a decidir.
   */
  private async confirmStopRecording(): Promise<void> {
    if (!this.service) return;
    const metadata = this.service.prepareStop();
    if (!metadata) return;
    const routeId = this.service.getCurrentState().routeId;
    await resolveStopDecision({
      metadata, routeId, service: this.service, routeRepo: this.repo,
      getPhotoRepo: () => this.getPhotoRepo(),
    });
  }

  private handleStopRelease(): void {
    this.longPress.release();
  }

  /**
   * Pausar la grabación es también el gesto de marcar una parada manual
   * (petición real de usuario tras probar en dispositivo: un botón dedicado
   * aparte de Pausar generaba confusión — "el botón de parada" se esperaba
   * que fuera este). La pausa ocurre siempre; el modal de tipo es opcional
   * (cancelarlo no revierte la pausa, ver `markStopFlow`). Reanudar nunca
   * abre el modal — solo pausar.
   */
  private handlePauseResume(): void {
    if (!this.service) return;
    const state = this.service.getCurrentState();
    if (state.status === 'recording') {
      this.service.pauseRecording();
      void markStopFlow(this.service, this.stopTypesCache);
    } else if (state.status === 'paused') {
      this.service.resumeRecording();
    }
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

  private buildGalleryElement(): PhotoGalleryElement {
    const gallery = buildPhotoGalleryElement((index) => {
      openPhotoViewer({ photos: gallery.photos, startIndex: index, onDelete: (photo) => this.handleDeletePhoto(photo.id) });
    });
    this.galleryEl = gallery;
    return gallery;
  }

  private async refreshGallery(routeId: string): Promise<void> {
    const photoRepo = await this.getPhotoRepo();
    const photos = await fetchGalleryPhotos(photoRepo, routeId);
    if (this.galleryEl) this.galleryEl.photos = photos;
    applyPhotoCaptureLimit(this.photoCaptureEl, photos.length);
  }

  /** Devuelve si se borró de verdad, para que `<photo-viewer>` sepa si debe quitarla de su vista. */
  private async handleDeletePhoto(photoId: string): Promise<boolean> {
    try {
      if (!(await deleteCockpitPhoto(photoId, await this.getPhotoRepo()))) return false;
    } catch (err) {
      showToast(`⚠️ ${toErrorMessage(err, 'Error al eliminar la foto')}`, 'error');
      return false;
    }

    if (this.galleryEl) this.galleryEl.photos = this.galleryEl.photos.filter((p) => p.id !== photoId);
    applyPhotoCaptureLimit(this.photoCaptureEl, this.galleryEl?.photos.length ?? 0);
    showToast('Foto eliminada', 'success');
    return true;
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

    this.photoCaptureEl = isActive ? this.buildPhotoCaptureButton() : null;
    if (this.photoCaptureEl) screen.appendChild(this.photoCaptureEl);

    if (isActive && state) {
      screen.appendChild(this.buildGalleryElement());
      void this.refreshGallery(state.routeId);
    } else {
      this.galleryEl = null;
    }

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

    // 1. Capturar imagen(es) según fuente seleccionada. La galería permite
    // seleccionar varias — hay que persistirlas todas, no solo la primera.
    const files = source === 'camera'
      ? await captureFromCamera().then((file) => (file ? [file] : []))
      : await pickFromGallery();
    if (files.length === 0) return;

    // 2-3. routeId pre-generado al iniciar la grabación + último punto GPS conocido,
    // para que la foto capturada en pleno directo quede correctamente asociada.
    const { routeId, lastPoint, routePoints } = buildPhotoCaptureContext(state);

    // 4. Procesar cada foto (con feedback de carga: guardar en appDataDir puede tardar
    // un momento y sin indicador parece que la subida no ha hecho nada)
    if (this.photoCaptureEl) this.photoCaptureEl.loading = true;
    try {
      const photoRepo = await this.getPhotoRepo();
      const addedCount = await processMultiplePhotos({
        files, routeId, photoRepo, lastPoint, routePoints,
        onError: (error) => { showToast(`⚠️ No se pudo guardar la foto: ${error}`, 'error'); },
      });
      if (addedCount > 0) {
        showToast(addedCount === 1 ? '📷 Foto añadida' : `📷 ${String(addedCount)} fotos añadidas`, 'success');
        void this.refreshGallery(routeId);
      }
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
