/**
 * Web Component `<profile-vehicle-dialog>`: modal "Editar vehículo" con
 * selector de tipo siempre visible (AC-017) y selects en cascada
 * tipo→marca→modelo consultando la API pública NHTSA vPIC
 * (`vpic.service.ts`, Paso 5), con estados de carga (AC-020) y error con
 * reintento (AC-025) sin que un fallo de red afecte nunca al vehículo ya
 * guardado (AC-026 — este componente no conoce `IProfileRepository`, solo
 * resuelve `{ action: 'save', ... }` cuando el usuario pulsa "Guardar"
 * explícitamente; la persistencia real vive en `profile.service.ts`, Paso 12).
 *
 * Reutiliza el mismo patrón overlay/`trapFocus`/`closable` que
 * `confirm-dialog.element.ts` y `profile-edit-dialog.element.ts` (Paso 10).
 * Los constructores de DOM de los selects/estado/acciones viven en
 * `profile-vehicle-dialog-fields.ts` (separación por tamaño, ver JSDoc de
 * ese archivo).
 *
 * **Condición de carrera (AC-023) — decisión de diseño documentada**: cada
 * petición en vuelo (marcas o modelos) se asocia a un `AbortController`
 * propio de esta clase, guardado en `requestController`. Al iniciar una
 * nueva petición (cambio de tipo/marca) o al cerrar el diálogo, se aborta
 * el controller anterior; la respuesta que llegue después de un abort se
 * ignora comprobando `controller.signal.aborted` antes de aplicar el
 * resultado. Esto **no** cancela la petición `fetch()` subyacente en sí
 * (`fetchJson`/`fetchVehicleMakes`/`fetchVehicleModels`, Pasos 4/5, no
 * aceptan hoy una `signal` externa) — se optó deliberadamente por no
 * ampliar esa firma pública, tal como el propio plan deja como alternativa
 * válida: las peticiones a vPIC son rápidas y su timeout interno (8s) ya
 * limita el daño de una petición zombie; lo que sí se garantiza aquí es que
 * su resultado nunca se aplica al estado del diálogo si ya quedó obsoleto.
 */
import { BaseElement } from '../shared/base-element.js';
import { fetchVehicleMakes, fetchVehicleModels } from './vpic.service.js';
import { describeVehicleFetchError } from './profile-vehicle-dialog.transform.js';
import type { Profile, VehicleType } from '../shared/models/index.js';
import {
  buildMakeCombobox,
  buildMakeOptionsListbox,
  buildModelSelect,
  buildTypeSelect,
  buildVehicleActions,
  buildVehicleField,
  buildVehicleStatus,
  type VehicleDialogStatus,
  type VehicleSelectState,
} from './profile-vehicle-dialog-fields.js';
import styles from './profile-vehicle-dialog.element.css?inline';

/** Vehículo actualmente guardado en el perfil, o `null` si todavía no hay ninguno configurado. */
export type CurrentVehicle = Pick<Profile, 'vehicleType' | 'vehicleMake' | 'vehicleModel'>;

/** Opciones para abrir el modal "Editar vehículo". */
export interface ProfileVehicleDialogOptions {
  /** Vehículo guardado actualmente, o `null` la primera vez que se configura. */
  current: CurrentVehicle | null;
}

/** Resultado de `openVehicleEditDialog`: guardado explícito con los 3 valores elegidos, o cancelación. */
export type ProfileVehicleDialogResult =
  | { action: 'save'; vehicleType: VehicleType; vehicleMake: string; vehicleModel: string }
  | { action: 'cancel' };

class ProfileVehicleDialogElement extends BaseElement {
  private options: ProfileVehicleDialogOptions | null = null;
  private onResolve: ((value: ProfileVehicleDialogResult) => void) | null = null;
  private previouslyFocused: HTMLElement | null = null;

  private type: VehicleType | null = null;
  private makes: string[] = [];
  private models: string[] = [];
  private selectedMake: string | null = null;
  private selectedModel: string | null = null;
  /** Texto del buscador de marca (AC-039/AC-040) — vPIC no filtra server-side, se filtra en cliente. */
  private makeQuery = '';
  private status: VehicleDialogStatus = 'idle';
  private errorMessage: string | null = null;
  /** Reintenta exactamente la última petición que falló (marcas o modelos), sin duplicar "qué llamar" (AC-025). */
  private lastFailedFetch: (() => Promise<void>) | null = null;
  /** Controller de la petición en curso, usado como token para ignorar una respuesta obsoleta (ver JSDoc de cabecera). */
  private requestController: AbortController | null = null;

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Tab') {
      this.trapFocus(event);
      return;
    }
    if (event.key !== 'Escape') return;
    this.close({ action: 'cancel' });
  };

  /** Ciclo de foco dentro del diálogo, ignorando controles deshabilitados. */
  private trapFocus(event: KeyboardEvent): void {
    const root = this.shadowRoot;
    if (!root) return;
    const focusables = Array.from(
      root.querySelectorAll<HTMLButtonElement | HTMLSelectElement | HTMLInputElement>(
        '[data-cy="profile-select-tipo-vehiculo"], [data-cy="profile-input-buscar-marca"], [data-cy="profile-select-modelo"], [data-cy="profile-btn-reintentar-vehiculo"], .action',
      ),
    ).filter((el) => !el.disabled);
    if (focusables.length === 0) return;
    const first = focusables[0]!;
    const last = focusables[focusables.length - 1]!;
    const active = root.activeElement;

    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback(): void {
    document.addEventListener('keydown', this.onKeyDown);
  }

  disconnectedCallback(): void {
    document.removeEventListener('keydown', this.onKeyDown);
  }

  /** Abre el diálogo con las opciones dadas y devuelve una promesa con el resultado elegido. */
  open(options: ProfileVehicleDialogOptions): Promise<ProfileVehicleDialogResult> {
    this.options = options;
    this.type = options.current?.vehicleType ?? null;
    this.selectedMake = options.current?.vehicleMake ?? null;
    this.selectedModel = options.current?.vehicleModel ?? null;
    this.makeQuery = this.selectedMake ?? '';
    this.previouslyFocused = document.activeElement as HTMLElement | null;
    this.render();
    this.shadowRoot?.querySelector<HTMLElement>('[data-cy="profile-select-tipo-vehiculo"]')?.focus();
    // Precarga marcas (y modelos, si ya había una marca guardada) para un vehículo
    // ya existente, sin esperar a que el usuario "toque" el selector de tipo — antes
    // de este fix, editar un vehículo sin cambiar el tipo dejaba "Marca" sin cargar
    // nunca (bug real, reportado en dispositivo). No viola AC-024: abrir "Editar
    // vehículo" ya es entrar en el flujo de edición, la única condición de esa AC.
    if (this.type) {
      void this.preloadCurrentVehicle(this.type, this.selectedMake);
    }
    return new Promise((resolve) => { this.onResolve = resolve; });
  }

  /** Ver nota en `open()`: precarga marcas/modelos del vehículo ya guardado, sin descartar la marca/modelo ya elegidos (a diferencia de `handleTypeChange`/`handleMakeChange`, pensados para una elección nueva del usuario). */
  private async preloadCurrentVehicle(type: VehicleType, make: string | null): Promise<void> {
    await this.loadMakes(type);
    if (make && this.status !== 'error') {
      await this.loadModels(make, type);
    }
  }

  private close(result: ProfileVehicleDialogResult): void {
    // Aborta cualquier petición en vuelo (AC-023) — ver decisión de diseño en el JSDoc de cabecera.
    this.requestController?.abort();
    this.requestController = null;
    this.onResolve?.(result);
    this.onResolve = null;
    this.previouslyFocused?.focus();
    this.remove();
  }

  /** Marca como obsoleta cualquier petición en vuelo y abre un nuevo "slot" para la siguiente. */
  private beginRequest(): AbortController {
    this.requestController?.abort();
    const controller = new AbortController();
    this.requestController = controller;
    return controller;
  }

  private async loadMakes(type: VehicleType): Promise<void> {
    const controller = this.beginRequest();
    this.status = 'loading-makes';
    this.errorMessage = null;
    this.lastFailedFetch = (): Promise<void> => this.loadMakes(type);
    this.render();
    try {
      const makes = await fetchVehicleMakes(type);
      if (controller.signal.aborted) return;
      this.makes = makes;
      this.status = 'idle';
      this.render();
    } catch (err) {
      if (controller.signal.aborted) return;
      this.status = 'error';
      this.errorMessage = describeVehicleFetchError(err);
      this.render();
    }
  }

  private async loadModels(make: string, type: VehicleType): Promise<void> {
    const controller = this.beginRequest();
    this.status = 'loading-models';
    this.errorMessage = null;
    this.lastFailedFetch = (): Promise<void> => this.loadModels(make, type);
    this.render();
    try {
      const models = await fetchVehicleModels(make, type);
      if (controller.signal.aborted) return;
      this.models = models;
      this.status = 'idle';
      this.render();
    } catch (err) {
      if (controller.signal.aborted) return;
      this.status = 'error';
      this.errorMessage = describeVehicleFetchError(err);
      this.render();
    }
  }

  /** Cambiar de tipo descarta marca/modelo ya elegidos y vuelve a consultar marcas (AC-022). */
  private handleTypeChange(value: string): void {
    const type = value === 'motorcycle' || value === 'car' ? value : null;
    this.type = type;
    this.makes = [];
    this.models = [];
    this.selectedMake = null;
    this.selectedModel = null;
    this.makeQuery = '';
    this.status = 'idle';
    this.errorMessage = null;
    this.lastFailedFetch = null;
    if (type) {
      void this.loadMakes(type);
    } else {
      this.requestController?.abort();
      this.requestController = null;
      this.render();
    }
  }

  /**
   * Filtra la lista de marcas mostradas sin volver a consultar vPIC (AC-040)
   * — puro cliente. Reconstruye solo el listbox (`buildMakeOptionsListbox`),
   * no todo el diálogo vía `render()`: un `render()` completo en cada
   * pulsación destruiría y recrearía el propio `<input>` de búsqueda,
   * perdiendo el foco/cursor mientras el usuario escribe (bug real, no solo
   * de test — ver JSDoc de `buildMakeOptionsListbox`).
   */
  private handleMakeQueryChange(value: string): void {
    this.makeQuery = value;

    // Si el texto ya no coincide con la marca elegida, esa elección deja de ser
    // válida: sin este descarte, "Guardar" seguiría persistiendo la marca antigua
    // aunque el buscador mostrara un texto distinto (nunca elegido de verdad) —
    // el texto visible del buscador debe reflejar siempre lo que se guardaría.
    // Solo ocurre una vez por divergencia (deja de repetirse en cuanto
    // `selectedMake` ya es `null`), así que el `render()` completo aquí no
    // penaliza cada pulsación — a diferencia del filtro normal, que solo
    // reconstruye el listbox para no perder el foco del `<input>` mientras se
    // escribe (ver JSDoc de `buildMakeOptionsListbox`).
    if (this.selectedMake !== null && this.selectedMake !== value) {
      this.selectedMake = null;
      this.models = [];
      this.selectedModel = null;
      this.status = 'idle';
      this.errorMessage = null;
      this.lastFailedFetch = null;
      this.requestController?.abort();
      this.requestController = null;
      this.render();
      return;
    }

    const container = this.shadowRoot?.querySelector<HTMLElement>('[data-cy="profile-marca-options"]');
    if (!container) return;
    container.replaceWith(
      buildMakeOptionsListbox(this.currentSelectState(), (v) => { this.handleMakeSelect(v); }),
    );
  }

  /** Elegir marca descarta el modelo ya elegido y consulta los modelos de esa marca (AC-019). */
  private handleMakeSelect(value: string): void {
    this.selectedMake = value || null;
    this.makeQuery = value;
    this.models = [];
    this.selectedModel = null;
    this.status = 'idle';
    this.errorMessage = null;
    this.lastFailedFetch = null;
    if (this.selectedMake && this.type) {
      void this.loadModels(this.selectedMake, this.type);
    } else {
      this.requestController?.abort();
      this.requestController = null;
      this.render();
    }
  }

  private handleModelChange(value: string): void {
    this.selectedModel = value || null;
    this.render();
  }

  private handleRetry(): void {
    void this.lastFailedFetch?.();
  }

  /** Guarda: solo posible con tipo+marca+modelo elegidos, nunca un vehículo a medias (AC-021). */
  private handleSave(): void {
    if (!this.type || !this.selectedMake || !this.selectedModel) return;
    this.close({
      action: 'save',
      vehicleType: this.type,
      vehicleMake: this.selectedMake,
      vehicleModel: this.selectedModel,
    });
  }

  private buildOverlay(): HTMLElement {
    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    overlay.setAttribute('data-cy', 'profile-vehicle-dialog-overlay');
    overlay.addEventListener('click', () => { this.close({ action: 'cancel' }); });
    return overlay;
  }

  private currentSelectState(): VehicleSelectState {
    return {
      type: this.type,
      makes: this.makes,
      models: this.models,
      selectedMake: this.selectedMake,
      selectedModel: this.selectedModel,
      status: this.status,
      makeQuery: this.makeQuery,
    };
  }

  private buildFields(): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'fields';
    const state = this.currentSelectState();
    wrapper.appendChild(
      buildVehicleField(
        'Tipo de vehículo',
        'profile-vehicle-type-select',
        buildTypeSelect(state, (value) => { this.handleTypeChange(value); }),
      ),
    );
    wrapper.appendChild(
      buildVehicleField(
        'Marca',
        'profile-vehicle-make-select',
        buildMakeCombobox(
          state,
          (value) => { this.handleMakeQueryChange(value); },
          (value) => { this.handleMakeSelect(value); },
        ),
      ),
    );
    wrapper.appendChild(
      buildVehicleField(
        'Modelo',
        'profile-vehicle-model-select',
        buildModelSelect(state, (value) => { this.handleModelChange(value); }),
      ),
    );
    return wrapper;
  }

  private buildDialog(): HTMLElement {
    const dialog = document.createElement('div');
    dialog.className = 'dialog';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');

    const titleEl = document.createElement('h2');
    titleEl.className = 'title';
    titleEl.textContent = 'Editar vehículo';
    dialog.appendChild(titleEl);

    dialog.appendChild(this.buildFields());

    const status = buildVehicleStatus(this.status, this.errorMessage, () => { this.handleRetry(); });
    if (status) dialog.appendChild(status);

    const canSave = Boolean(this.type && this.selectedMake && this.selectedModel);
    dialog.appendChild(
      buildVehicleActions(canSave, () => { this.handleSave(); }, () => { this.close({ action: 'cancel' }); }),
    );

    return dialog;
  }

  protected render(): void {
    if (!this.options) return;
    this.renderShadow(styles, this.buildOverlay(), this.buildDialog());
  }
}

customElements.define('profile-vehicle-dialog', ProfileVehicleDialogElement);

/**
 * Abre un `<profile-vehicle-dialog>` montado en `document.body` y devuelve
 * una promesa con el resultado elegido (`{ action: 'save', ... }` o
 * `{ action: 'cancel' }`). El elemento se autodestruye al resolver.
 */
export function openVehicleEditDialog(
  options: ProfileVehicleDialogOptions,
): Promise<ProfileVehicleDialogResult> {
  const el = document.createElement('profile-vehicle-dialog') as ProfileVehicleDialogElement;
  document.body.appendChild(el);
  return el.open(options);
}
