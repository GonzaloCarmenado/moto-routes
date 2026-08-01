/**
 * Constructores de DOM para los campos y estados del modal "Editar
 * vehículo" (selects de tipo/marca/modelo, estado de error con reintento,
 * acciones "Guardar"/"Cancelar"), extraídos de
 * `profile-vehicle-dialog.element.ts` para mantener ese archivo dentro del
 * límite de tamaño del proyecto (`eslint.config.js`, `max-lines`) — mismo
 * patrón de separación ya usado por `route-detail-notes.ts`/
 * `route-detail-timeline.ts`. Construidos exclusivamente con
 * `createElement`/`appendChild`, nunca `innerHTML`.
 */
import type { VehicleType } from '../shared/models/index.js';

/** Etiquetas visibles de cada tipo de vehículo (AC-017). */
const VEHICLE_TYPE_LABELS: Record<VehicleType, string> = {
  motorcycle: 'Moto',
  car: 'Coche',
};

/** Estado de carga/error de las peticiones a vPIC (marcas o modelos). */
export type VehicleDialogStatus = 'idle' | 'loading-makes' | 'loading-models' | 'error';

/** Selección en curso del flujo tipo→marca→modelo, usada para construir los tres selects. */
export interface VehicleSelectState {
  type: VehicleType | null;
  makes: string[];
  models: string[];
  selectedMake: string | null;
  selectedModel: string | null;
  status: VehicleDialogStatus;
}

/** Envuelve un control en su `<div class="field">` con `<label>` asociada por `id`. */
export function buildVehicleField(labelText: string, id: string, control: HTMLElement): HTMLElement {
  const field = document.createElement('div');
  field.className = 'field';

  const label = document.createElement('label');
  label.className = 'field-label';
  label.textContent = labelText;
  label.setAttribute('for', id);
  field.appendChild(label);

  control.id = id;
  field.appendChild(control);

  return field;
}

/** Select de tipo de vehículo, siempre visible y habilitado (AC-017). */
export function buildTypeSelect(state: VehicleSelectState, onChange: (value: string) => void): HTMLSelectElement {
  const select = document.createElement('select');
  select.className = 'select';
  select.setAttribute('data-cy', 'profile-select-tipo-vehiculo');
  select.setAttribute('aria-label', 'Tipo de vehículo');

  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = 'Selecciona un tipo';
  placeholder.disabled = true;
  select.appendChild(placeholder);

  for (const type of ['motorcycle', 'car'] as const) {
    const option = document.createElement('option');
    option.value = type;
    option.textContent = VEHICLE_TYPE_LABELS[type];
    select.appendChild(option);
  }

  select.value = state.type ?? '';
  select.addEventListener('change', () => { onChange(select.value); });
  return select;
}

/** Select de marca: deshabilitado hasta elegir tipo, en estado de carga mientras `fetchVehicleMakes` está en vuelo (AC-018, AC-020). */
export function buildMakeSelect(state: VehicleSelectState, onChange: (value: string) => void): HTMLSelectElement {
  const select = document.createElement('select');
  select.className = 'select';
  select.setAttribute('data-cy', 'profile-select-marca');
  select.setAttribute('aria-label', 'Marca del vehículo');

  const isLoading = state.status === 'loading-makes';
  select.disabled = !state.type || isLoading;

  if (isLoading) {
    select.classList.add('is-loading');
    select.setAttribute('aria-busy', 'true');
    const loadingOption = document.createElement('option');
    loadingOption.value = '';
    loadingOption.textContent = 'Cargando marcas…';
    select.appendChild(loadingOption);
  } else {
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'Selecciona una marca';
    select.appendChild(placeholder);
    for (const make of state.makes) {
      const option = document.createElement('option');
      option.value = make;
      option.textContent = make;
      select.appendChild(option);
    }
  }

  select.value = state.selectedMake ?? '';
  select.addEventListener('change', () => { onChange(select.value); });
  return select;
}

/** Select de modelo: deshabilitado hasta elegir marca, en estado de carga mientras `fetchVehicleModels` está en vuelo (AC-019, AC-020). */
export function buildModelSelect(state: VehicleSelectState, onChange: (value: string) => void): HTMLSelectElement {
  const select = document.createElement('select');
  select.className = 'select';
  select.setAttribute('data-cy', 'profile-select-modelo');
  select.setAttribute('aria-label', 'Modelo del vehículo');

  const isLoading = state.status === 'loading-models';
  select.disabled = !state.selectedMake || isLoading;

  if (isLoading) {
    select.classList.add('is-loading');
    select.setAttribute('aria-busy', 'true');
    const loadingOption = document.createElement('option');
    loadingOption.value = '';
    loadingOption.textContent = 'Cargando modelos…';
    select.appendChild(loadingOption);
  } else {
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'Selecciona un modelo';
    select.appendChild(placeholder);
    for (const model of state.models) {
      const option = document.createElement('option');
      option.value = model;
      option.textContent = model;
      select.appendChild(option);
    }
  }

  select.value = state.selectedModel ?? '';
  select.addEventListener('change', () => { onChange(select.value); });
  return select;
}

/** Estado de error con botón de reintento (AC-025) — `null` mientras el estado no sea `'error'` (nada que renderizar). */
export function buildVehicleStatus(
  status: VehicleDialogStatus,
  errorMessage: string | null,
  onRetry: () => void,
): HTMLElement | null {
  if (status !== 'error') return null;

  const container = document.createElement('div');
  container.className = 'vehicle-status vehicle-status--error';
  container.setAttribute('data-cy', 'profile-vehicle-status');
  container.setAttribute('role', 'alert');

  const message = document.createElement('p');
  message.className = 'vehicle-status-message';
  message.textContent = errorMessage ?? 'No se pudo cargar la información del vehículo.';
  container.appendChild(message);

  const retryBtn = document.createElement('button');
  retryBtn.type = 'button';
  retryBtn.className = 'action action--retry';
  retryBtn.setAttribute('data-cy', 'profile-btn-reintentar-vehiculo');
  retryBtn.textContent = 'Reintentar';
  retryBtn.addEventListener('click', onRetry);
  container.appendChild(retryBtn);

  return container;
}

/** Botones "Cancelar"/"Guardar" — "Guardar" deshabilitado hasta tener tipo+marca+modelo elegidos (AC-021). */
export function buildVehicleActions(canSave: boolean, onSave: () => void, onCancel: () => void): HTMLElement {
  const actions = document.createElement('div');
  actions.className = 'actions';

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'action action--danger';
  cancelBtn.setAttribute('data-cy', 'profile-btn-cancelar-vehiculo');
  cancelBtn.textContent = 'Cancelar';
  cancelBtn.addEventListener('click', onCancel);
  actions.appendChild(cancelBtn);

  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.className = 'action action--primary';
  saveBtn.setAttribute('data-cy', 'profile-btn-guardar-vehiculo');
  saveBtn.textContent = 'Guardar';
  saveBtn.disabled = !canSave;
  saveBtn.addEventListener('click', onSave);
  actions.appendChild(saveBtn);

  return actions;
}
