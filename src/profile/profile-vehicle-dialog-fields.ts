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
import { buildMakeOptionsList } from './profile-vehicle-dialog.transform.js';
import type { VehicleMake } from './vpic.service.js';

/**
 * Etiquetas visibles de cada tipo de vehículo (AC-017). Exportada para que
 * `profile.element.ts` (Paso 13) reutilice exactamente el mismo texto al
 * mostrar el vehículo ya guardado en la sección "Mi vehículo", sin duplicar
 * el mapeo.
 */
export const VEHICLE_TYPE_LABELS: Record<VehicleType, string> = {
  motorcycle: 'Moto',
  car: 'Coche',
};

/** Estado de carga/error de las peticiones a vPIC (marcas o modelos). */
export type VehicleDialogStatus = 'idle' | 'loading-makes' | 'loading-models' | 'error';

/** Selección en curso del flujo tipo→marca→modelo, usada para construir los tres selects. */
export interface VehicleSelectState {
  type: VehicleType | null;
  makes: VehicleMake[];
  models: string[];
  selectedMake: string | null;
  selectedModel: string | null;
  status: VehicleDialogStatus;
  /** Texto escrito en el buscador de marca — vPIC no soporta filtro server-side, se filtra en cliente. */
  makeQuery: string;
}

/**
 * Envuelve un control en su `<div class="field">` con `<label>` asociada por
 * `id`. `control` puede ser el propio elemento de formulario (selects) o un
 * wrapper con un `input`/`select` dentro (combobox de marca) — en ambos
 * casos, el `id` se asigna al elemento de formulario real para que la
 * asociación `<label for>` funcione.
 */
export function buildVehicleField(labelText: string, id: string, control: HTMLElement): HTMLElement {
  const field = document.createElement('div');
  field.className = 'field';

  const label = document.createElement('label');
  label.className = 'field-label';
  label.textContent = labelText;
  label.setAttribute('for', id);
  field.appendChild(label);

  const formTarget = control.matches('input, select') ? control : control.querySelector('input, select');
  if (formTarget) formTarget.id = id;
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

/**
 * Buscador de marca: deshabilitado hasta elegir tipo, en estado de carga
 * mientras `fetchVehicleMakes` está en vuelo (AC-018, AC-020). vPIC no
 * soporta ningún filtro server-side (siempre devuelve la lista completa,
 * incluyendo fabricantes muy minoritarios) — el filtro de texto y la
 * priorización de marcas conocidas ocurren en cliente vía
 * `buildMakeOptionsList` (`profile-vehicle-dialog.transform.ts`). Sustituye
 * al `<select>` nativo (usado en `buildModelSelect`/`buildTypeSelect`)
 * porque una lista de cientos de marcas es inutilizable sin buscador,
 * especialmente en un `<select>` táctil de móvil.
 */
export function buildMakeCombobox(
  state: VehicleSelectState,
  onQueryChange: (value: string) => void,
  onSelect: (make: VehicleMake) => void,
): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'make-combobox';

  const isLoading = state.status === 'loading-makes';
  const disabled = !state.type || isLoading;

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'select make-search-input';
  input.setAttribute('data-cy', 'profile-input-buscar-marca');
  input.setAttribute('aria-label', 'Buscar marca');
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-expanded', 'true');
  input.setAttribute('autocomplete', 'off');
  input.placeholder = isLoading ? 'Cargando marcas…' : 'Buscar marca…';
  input.disabled = disabled;
  input.value = state.makeQuery;
  if (isLoading) {
    input.classList.add('is-loading');
    input.setAttribute('aria-busy', 'true');
  }
  input.addEventListener('input', () => { onQueryChange(input.value); });
  wrapper.appendChild(input);

  if (!isLoading && state.type) {
    wrapper.appendChild(buildMakeOptionsListbox(state, onSelect));
  }

  return wrapper;
}

/**
 * Listado desplegable de marcas filtradas/priorizadas, usado por
 * `buildMakeCombobox` y también reconstruido de forma aislada (sin recrear
 * el `<input>` de búsqueda ni pasar por el `render()` completo del diálogo)
 * cada vez que el usuario teclea — ver `handleMakeQueryChange` en
 * `profile-vehicle-dialog.element.ts`: un `render()` completo en cada pulsación
 * destruye y recrea el propio `<input>`, perdiendo el foco/cursor mientras
 * se escribe (bug real, no solo un problema de test).
 */
export function buildMakeOptionsListbox(state: VehicleSelectState, onSelect: (make: VehicleMake) => void): HTMLElement {
  const listbox = document.createElement('div');
  listbox.className = 'make-options';
  listbox.setAttribute('role', 'listbox');
  listbox.setAttribute('data-cy', 'profile-marca-options');
  listbox.setAttribute('aria-label', 'Marcas disponibles');

  const options = buildMakeOptionsList(state.makes, state.makeQuery);
  if (options.length === 0) {
    listbox.appendChild(buildMakeOptionsEmpty());
    return listbox;
  }

  for (const make of options) {
    listbox.appendChild(buildMakeOption(make, make.name === state.selectedMake, onSelect));
  }

  return listbox;
}

function buildMakeOptionsEmpty(): HTMLElement {
  const empty = document.createElement('p');
  empty.className = 'make-options-empty';
  empty.setAttribute('data-cy', 'profile-marca-empty');
  empty.textContent = 'No se encontraron marcas con ese nombre';
  return empty;
}

function buildMakeOption(make: VehicleMake, isSelected: boolean, onSelect: (make: VehicleMake) => void): HTMLButtonElement {
  const option = document.createElement('button');
  option.type = 'button';
  option.className = 'make-option';
  option.setAttribute('role', 'option');
  option.setAttribute('data-cy', 'profile-marca-option');
  option.setAttribute('aria-selected', isSelected ? 'true' : 'false');
  if (isSelected) option.classList.add('is-selected');
  option.textContent = make.name;
  option.addEventListener('click', () => { onSelect(make); });
  return option;
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
