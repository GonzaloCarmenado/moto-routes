import { describe, it, expect, vi } from 'vitest';
import {
  buildVehicleField,
  buildTypeSelect,
  buildMakeCombobox,
  buildMakeOptionsListbox,
  buildModelSelect,
  buildVehicleStatus,
  buildVehicleActions,
  type VehicleSelectState,
} from './profile-vehicle-dialog-fields.js';
import type { VehicleMake } from './vpic.service.js';

function baseState(overrides: Partial<VehicleSelectState> = {}): VehicleSelectState {
  return {
    type: null,
    makes: [],
    models: [],
    selectedMake: null,
    selectedModel: null,
    status: 'idle',
    makeQuery: '',
    ...overrides,
  };
}

describe('buildVehicleField', () => {
  it('wraps the control in a labelled field, associating <label for> with the form element', () => {
    const select = document.createElement('select');
    const field = buildVehicleField('Tipo', 'tipo-id', select);

    const label = field.querySelector('label')!;
    expect(label.textContent).toBe('Tipo');
    expect(label.getAttribute('for')).toBe('tipo-id');
    expect(select.id).toBe('tipo-id');
  });

  it('assigns the id to the inner input when the control is a wrapper (combobox)', () => {
    const wrapper = document.createElement('div');
    const input = document.createElement('input');
    wrapper.appendChild(input);

    buildVehicleField('Marca', 'marca-id', wrapper);

    expect(input.id).toBe('marca-id');
  });
});

describe('buildTypeSelect', () => {
  it('is pre-selected to the current type and includes both vehicle types', () => {
    const select = buildTypeSelect(baseState({ type: 'car' }), vi.fn());
    expect(select.value).toBe('car');
    expect(Array.from(select.options).map((o) => o.value)).toEqual(['', 'motorcycle', 'car']);
  });

  it('calls onChange with the new value when the user picks a type', () => {
    const onChange = vi.fn();
    const select = buildTypeSelect(baseState(), onChange);

    select.value = 'motorcycle';
    select.dispatchEvent(new Event('change'));

    expect(onChange).toHaveBeenCalledWith('motorcycle');
  });
});

describe('buildMakeCombobox', () => {
  it('is disabled until a type is chosen', () => {
    const wrapper = buildMakeCombobox(baseState({ type: null }), vi.fn(), vi.fn());
    const input = wrapper.querySelector('input')!;
    expect(input.disabled).toBe(true);
  });

  it('is disabled and shows a loading placeholder while makes are being fetched', () => {
    const wrapper = buildMakeCombobox(baseState({ type: 'motorcycle', status: 'loading-makes' }), vi.fn(), vi.fn());
    const input = wrapper.querySelector('input')!;
    expect(input.disabled).toBe(true);
    expect(input.placeholder).toBe('Cargando marcas…');
    expect(input.getAttribute('aria-busy')).toBe('true');
  });

  it('is enabled with the options list once a type is chosen and makes are loaded', () => {
    const makes: VehicleMake[] = [{ id: 1, name: 'Honda' }];
    const wrapper = buildMakeCombobox(baseState({ type: 'motorcycle', makes, status: 'idle' }), vi.fn(), vi.fn());
    const input = wrapper.querySelector('input')!;
    expect(input.disabled).toBe(false);
    expect(wrapper.querySelector('[role="listbox"]')).not.toBeNull();
  });

  it('calls onQueryChange as the user types', () => {
    const onQueryChange = vi.fn();
    const wrapper = buildMakeCombobox(baseState({ type: 'motorcycle' }), onQueryChange, vi.fn());
    const input = wrapper.querySelector('input')!;

    input.value = 'hon';
    input.dispatchEvent(new Event('input'));

    expect(onQueryChange).toHaveBeenCalledWith('hon');
  });
});

describe('buildMakeOptionsListbox', () => {
  it('shows an empty-state message when no make matches the query', () => {
    const listbox = buildMakeOptionsListbox(baseState({ makes: [{ id: 1, name: 'Honda' }], makeQuery: 'zzz' }), vi.fn());
    expect(listbox.querySelector('.make-options-empty')?.textContent).toBe('No se encontraron marcas con ese nombre');
  });

  it('lists matching makes and calls onSelect with the chosen one', () => {
    const honda: VehicleMake = { id: 1, name: 'Honda' };
    const onSelect = vi.fn();
    const listbox = buildMakeOptionsListbox(baseState({ makes: [honda] }), onSelect);

    const option = listbox.querySelector('.make-option') as HTMLButtonElement;
    expect(option.textContent).toBe('Honda');
    option.click();

    expect(onSelect).toHaveBeenCalledWith(honda);
  });

  it('marks the currently selected make as aria-selected', () => {
    const honda: VehicleMake = { id: 1, name: 'Honda' };
    const listbox = buildMakeOptionsListbox(baseState({ makes: [honda], selectedMake: 'Honda' }), vi.fn());
    const option = listbox.querySelector('.make-option')!;
    expect(option.getAttribute('aria-selected')).toBe('true');
    expect(option.classList.contains('is-selected')).toBe(true);
  });
});

describe('buildModelSelect', () => {
  it('is disabled until a make is chosen', () => {
    const select = buildModelSelect(baseState({ selectedMake: null }), vi.fn());
    expect(select.disabled).toBe(true);
  });

  it('shows a loading placeholder while models are being fetched', () => {
    const select = buildModelSelect(baseState({ selectedMake: 'Honda', status: 'loading-models' }), vi.fn());
    expect(select.disabled).toBe(true);
    expect(select.options[0]!.textContent).toBe('Cargando modelos…');
  });

  it('lists the models and calls onChange when one is picked', () => {
    const onChange = vi.fn();
    const select = buildModelSelect(baseState({ selectedMake: 'Honda', models: ['CB500F', 'CBR650R'] }), onChange);
    expect(select.disabled).toBe(false);

    select.value = 'CBR650R';
    select.dispatchEvent(new Event('change'));

    expect(onChange).toHaveBeenCalledWith('CBR650R');
  });
});

describe('buildVehicleStatus', () => {
  it('renders nothing when the status is not "error"', () => {
    expect(buildVehicleStatus('idle', null, vi.fn())).toBeNull();
    expect(buildVehicleStatus('loading-makes', null, vi.fn())).toBeNull();
  });

  it('renders the error message with a retry button that calls onRetry', () => {
    const onRetry = vi.fn();
    const el = buildVehicleStatus('error', 'Sin conexión con vPIC', onRetry);

    expect(el?.textContent).toContain('Sin conexión con vPIC');
    (el?.querySelector('[data-cy="profile-btn-reintentar-vehiculo"]') as HTMLButtonElement).click();
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('falls back to a generic message when none is given', () => {
    const el = buildVehicleStatus('error', null, vi.fn());
    expect(el?.textContent).toContain('No se pudo cargar la información del vehículo.');
  });
});

describe('buildVehicleActions', () => {
  it('disables "Guardar" until canSave is true', () => {
    const disabled = buildVehicleActions(false, vi.fn(), vi.fn());
    const enabled = buildVehicleActions(true, vi.fn(), vi.fn());
    expect((disabled.querySelector('[data-cy="profile-btn-guardar-vehiculo"]') as HTMLButtonElement).disabled).toBe(true);
    expect((enabled.querySelector('[data-cy="profile-btn-guardar-vehiculo"]') as HTMLButtonElement).disabled).toBe(false);
  });

  it('calls onSave/onCancel from the corresponding buttons', () => {
    const onSave = vi.fn();
    const onCancel = vi.fn();
    const actions = buildVehicleActions(true, onSave, onCancel);

    (actions.querySelector('[data-cy="profile-btn-guardar-vehiculo"]') as HTMLButtonElement).click();
    (actions.querySelector('[data-cy="profile-btn-cancelar-vehiculo"]') as HTMLButtonElement).click();

    expect(onSave).toHaveBeenCalledOnce();
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
