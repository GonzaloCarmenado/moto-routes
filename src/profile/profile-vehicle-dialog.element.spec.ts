import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { openVehicleEditDialog } from './profile-vehicle-dialog.element.js';
import { fetchVehicleMakes, fetchVehicleModels } from './vpic.service.js';
import { ExternalApiError } from '../shared/http/external-api.service.js';

vi.mock('./vpic.service.js', () => ({
  fetchVehicleMakes: vi.fn(),
  fetchVehicleModels: vi.fn(),
}));

// `?inline` (usado por el propio componente en producción) no sirve para
// inspeccionar el CSS fuente bajo Vitest — se lee el fichero directamente,
// mismo patrón que `profile-edit-dialog.element.spec.ts`.
const cssPath = resolve(process.cwd(), 'src/profile/profile-vehicle-dialog.element.css');
const dialogStyles = readFileSync(cssPath, 'utf8');

function getDialog(): HTMLElement {
  const el = document.body.querySelector('profile-vehicle-dialog');
  expect(el).not.toBeNull();
  return el as HTMLElement;
}

function typeSelect(dialog: HTMLElement): HTMLSelectElement {
  return dialog.shadowRoot!.querySelector('[data-cy="profile-select-tipo-vehiculo"]') as HTMLSelectElement;
}

function makeSelect(dialog: HTMLElement): HTMLSelectElement {
  return dialog.shadowRoot!.querySelector('[data-cy="profile-select-marca"]') as HTMLSelectElement;
}

function modelSelect(dialog: HTMLElement): HTMLSelectElement {
  return dialog.shadowRoot!.querySelector('[data-cy="profile-select-modelo"]') as HTMLSelectElement;
}

function selectValue(select: HTMLSelectElement, value: string): void {
  select.value = value;
  select.dispatchEvent(new Event('change'));
}

async function flush(): Promise<void> {
  await new Promise((r) => setTimeout(r, 0));
}

/** Promesa controlable manualmente, para simular una petición vPIC en vuelo. */
function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void; reject: (err: unknown) => void } {
  let resolveFn!: (value: T) => void;
  let rejectFn!: (err: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolveFn = res;
    rejectFn = rej;
  });
  return { promise, resolve: resolveFn, reject: rejectFn };
}

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('openVehicleEditDialog (AC-016 a AC-023, AC-025, AC-026, AC-037, AC-038)', () => {
  it('shows the type select visible from the start with make/model disabled and empty when there is no vehicle yet (AC-017, AC-018)', () => {
    void openVehicleEditDialog({ current: null });
    const dialog = getDialog();

    expect(typeSelect(dialog)).not.toBeNull();
    expect(typeSelect(dialog).value).toBe('');
    expect(makeSelect(dialog).disabled).toBe(true);
    expect(makeSelect(dialog).options.length).toBeLessThanOrEqual(1);
    expect(modelSelect(dialog).disabled).toBe(true);
    expect(fetchVehicleMakes).not.toHaveBeenCalled();
  });

  it('shows the type select visible and preloaded to "Moto" when editing an already-saved vehicle (AC-017)', () => {
    void openVehicleEditDialog({
      current: { vehicleType: 'motorcycle', vehicleMake: 'Honda', vehicleModel: 'CB500X' },
    });
    const dialog = getDialog();

    expect(typeSelect(dialog).value).toBe('motorcycle');
  });

  it('choosing "Moto" calls fetchVehicleMakes and shows a loading state on the make select while pending (AC-018, AC-020)', async () => {
    const { promise } = deferred<string[]>();
    vi.mocked(fetchVehicleMakes).mockReturnValue(promise);

    void openVehicleEditDialog({ current: null });
    const dialog = getDialog();
    selectValue(typeSelect(dialog), 'motorcycle');
    await flush();

    expect(fetchVehicleMakes).toHaveBeenCalledWith('motorcycle');
    const make = makeSelect(getDialog());
    expect(make.classList.contains('is-loading')).toBe(true);
    expect(make.getAttribute('aria-busy')).toBe('true');
  });

  it('populates the make select and keeps the model select disabled/empty once fetchVehicleMakes resolves (AC-018)', async () => {
    const { promise, resolve } = deferred<string[]>();
    vi.mocked(fetchVehicleMakes).mockReturnValue(promise);

    void openVehicleEditDialog({ current: null });
    const dialog = getDialog();
    selectValue(typeSelect(dialog), 'motorcycle');
    await flush();

    resolve(['Honda', 'Yamaha']);
    await flush();

    const refreshed = getDialog();
    const make = makeSelect(refreshed);
    expect(make.disabled).toBe(false);
    expect(make.classList.contains('is-loading')).toBe(false);
    expect(Array.from(make.options).map((o) => o.value)).toEqual(expect.arrayContaining(['Honda', 'Yamaha']));
    expect(modelSelect(refreshed).disabled).toBe(true);
  });

  it('choosing a make calls fetchVehicleModels and shows a loading state on the model select while pending (AC-019, AC-020)', async () => {
    vi.mocked(fetchVehicleMakes).mockResolvedValue(['Honda', 'Yamaha']);
    const { promise } = deferred<string[]>();
    vi.mocked(fetchVehicleModels).mockReturnValue(promise);

    void openVehicleEditDialog({ current: null });
    let dialog = getDialog();
    selectValue(typeSelect(dialog), 'motorcycle');
    await flush();

    dialog = getDialog();
    selectValue(makeSelect(dialog), 'Honda');
    await flush();

    expect(fetchVehicleModels).toHaveBeenCalledWith('Honda', 'motorcycle');
    const model = modelSelect(getDialog());
    expect(model.classList.contains('is-loading')).toBe(true);
    expect(model.getAttribute('aria-busy')).toBe('true');
  });

  it('populates the model select once fetchVehicleModels resolves (AC-019)', async () => {
    vi.mocked(fetchVehicleMakes).mockResolvedValue(['Honda']);
    vi.mocked(fetchVehicleModels).mockResolvedValue(['CB500X', 'CBR600RR']);

    void openVehicleEditDialog({ current: null });
    let dialog = getDialog();
    selectValue(typeSelect(dialog), 'motorcycle');
    await flush();

    dialog = getDialog();
    selectValue(makeSelect(dialog), 'Honda');
    await flush();

    const model = modelSelect(getDialog());
    expect(model.disabled).toBe(false);
    expect(Array.from(model.options).map((o) => o.value)).toEqual(expect.arrayContaining(['CB500X', 'CBR600RR']));
  });

  it('changing type mid-edit discards the chosen make/model, re-fetches makes for the new type and resets the model select (AC-022)', async () => {
    vi.mocked(fetchVehicleMakes).mockResolvedValueOnce(['Honda']).mockResolvedValueOnce(['Seat']);
    vi.mocked(fetchVehicleModels).mockResolvedValue(['CB500X']);

    void openVehicleEditDialog({ current: null });
    let dialog = getDialog();
    selectValue(typeSelect(dialog), 'motorcycle');
    await flush();
    dialog = getDialog();
    selectValue(makeSelect(dialog), 'Honda');
    await flush();

    dialog = getDialog();
    expect(makeSelect(dialog).value).toBe('Honda');

    selectValue(typeSelect(dialog), 'car');
    await flush();

    expect(fetchVehicleMakes).toHaveBeenLastCalledWith('car');
    const refreshed = getDialog();
    expect(makeSelect(refreshed).value).toBe('');
    expect(modelSelect(refreshed).disabled).toBe(true);
    expect(modelSelect(refreshed).value).toBe('');
  });

  it('shows profile-vehicle-status with an error message and a retry button when fetchVehicleMakes rejects with ExternalApiError (AC-025)', async () => {
    vi.mocked(fetchVehicleMakes).mockRejectedValue(new ExternalApiError('network', 'boom'));

    void openVehicleEditDialog({ current: null });
    const dialog = getDialog();
    selectValue(typeSelect(dialog), 'motorcycle');
    await flush();

    const refreshed = getDialog();
    const status = refreshed.shadowRoot!.querySelector('[data-cy="profile-vehicle-status"]');
    expect(status).not.toBeNull();
    expect(status?.textContent).toBeTruthy();
    expect(refreshed.shadowRoot!.querySelector('[data-cy="profile-btn-reintentar-vehiculo"]')).not.toBeNull();
  });

  it('clicking "Reintentar" after a makes failure calls fetchVehicleMakes again with the same type (AC-025)', async () => {
    vi.mocked(fetchVehicleMakes)
      .mockRejectedValueOnce(new ExternalApiError('timeout', 'boom'))
      .mockResolvedValueOnce(['Honda']);

    void openVehicleEditDialog({ current: null });
    const dialog = getDialog();
    selectValue(typeSelect(dialog), 'motorcycle');
    await flush();

    const withError = getDialog();
    withError.shadowRoot!.querySelector<HTMLButtonElement>('[data-cy="profile-btn-reintentar-vehiculo"]')?.click();
    await flush();

    expect(fetchVehicleMakes).toHaveBeenCalledTimes(2);
    expect(fetchVehicleMakes).toHaveBeenNthCalledWith(2, 'motorcycle');
    const recovered = getDialog();
    expect(recovered.shadowRoot!.querySelector('[data-cy="profile-vehicle-status"]')).toBeNull();
    expect(makeSelect(recovered).disabled).toBe(false);
  });

  it('clicking "Reintentar" after a models failure calls fetchVehicleModels again with the same make/type (AC-025)', async () => {
    vi.mocked(fetchVehicleMakes).mockResolvedValue(['Honda']);
    vi.mocked(fetchVehicleModels)
      .mockRejectedValueOnce(new ExternalApiError('network', 'boom'))
      .mockResolvedValueOnce(['CB500X']);

    void openVehicleEditDialog({ current: null });
    let dialog = getDialog();
    selectValue(typeSelect(dialog), 'motorcycle');
    await flush();
    dialog = getDialog();
    selectValue(makeSelect(dialog), 'Honda');
    await flush();

    const withError = getDialog();
    withError.shadowRoot!.querySelector<HTMLButtonElement>('[data-cy="profile-btn-reintentar-vehiculo"]')?.click();
    await flush();

    expect(fetchVehicleModels).toHaveBeenCalledTimes(2);
    expect(fetchVehicleModels).toHaveBeenNthCalledWith(2, 'Honda', 'motorcycle');
    const recovered = getDialog();
    expect(modelSelect(recovered).disabled).toBe(false);
  });

  it('never resolves the dialog with a save action just because a fetch failed (AC-026)', async () => {
    vi.mocked(fetchVehicleMakes).mockRejectedValue(new ExternalApiError('network', 'boom'));

    const openPromise = openVehicleEditDialog({ current: null });
    const dialog = getDialog();
    selectValue(typeSelect(dialog), 'motorcycle');
    await flush();

    let settled = false;
    void openPromise.then(() => { settled = true; });
    await flush();

    expect(settled).toBe(false);
  });

  it('clicking "Guardar" with type+make+model chosen resolves { action: "save", ... } (AC-021)', async () => {
    vi.mocked(fetchVehicleMakes).mockResolvedValue(['Honda']);
    vi.mocked(fetchVehicleModels).mockResolvedValue(['CB500X']);

    const openPromise = openVehicleEditDialog({ current: null });
    let dialog = getDialog();
    selectValue(typeSelect(dialog), 'motorcycle');
    await flush();
    dialog = getDialog();
    selectValue(makeSelect(dialog), 'Honda');
    await flush();
    dialog = getDialog();
    selectValue(modelSelect(dialog), 'CB500X');
    await flush();

    dialog = getDialog();
    dialog.shadowRoot!.querySelector<HTMLButtonElement>('[data-cy="profile-btn-guardar-vehiculo"]')?.click();

    await expect(openPromise).resolves.toEqual({
      action: 'save',
      vehicleType: 'motorcycle',
      vehicleMake: 'Honda',
      vehicleModel: 'CB500X',
    });
  });

  it('disables the "Guardar" button while make or model is still missing', async () => {
    vi.mocked(fetchVehicleMakes).mockResolvedValue(['Honda']);
    vi.mocked(fetchVehicleModels).mockResolvedValue(['CB500X']);

    void openVehicleEditDialog({ current: null });
    let dialog = getDialog();
    expect(dialog.shadowRoot!.querySelector<HTMLButtonElement>('[data-cy="profile-btn-guardar-vehiculo"]')?.disabled).toBe(true);

    selectValue(typeSelect(dialog), 'motorcycle');
    await flush();

    dialog = getDialog();
    expect(dialog.shadowRoot!.querySelector<HTMLButtonElement>('[data-cy="profile-btn-guardar-vehiculo"]')?.disabled).toBe(true);

    selectValue(makeSelect(dialog), 'Honda');
    await flush();

    dialog = getDialog();
    expect(dialog.shadowRoot!.querySelector<HTMLButtonElement>('[data-cy="profile-btn-guardar-vehiculo"]')?.disabled).toBe(true);
  });

  it('clicking "Cancelar" resolves { action: "cancel" } without ever resolving with a save action, and aborts any pending request (AC-023)', async () => {
    const { promise, resolve } = deferred<string[]>();
    vi.mocked(fetchVehicleMakes).mockReturnValue(promise);

    const openPromise = openVehicleEditDialog({ current: null });
    const dialog = getDialog();
    selectValue(typeSelect(dialog), 'motorcycle');
    await flush();

    dialog.shadowRoot!.querySelector<HTMLButtonElement>('[data-cy="profile-btn-cancelar-vehiculo"]')?.click();
    await expect(openPromise).resolves.toEqual({ action: 'cancel' });

    // La petición se resuelve tarde, ya con el diálogo cerrado: su resultado debe ignorarse
    // (no debe reaparecer el diálogo en el documento ni lanzar ningún error).
    resolve(['Honda']);
    await flush();
    expect(document.body.querySelector('profile-vehicle-dialog')).toBeNull();
  });

  it('closing with Escape resolves { action: "cancel" }, same as Cancelar', async () => {
    const openPromise = openVehicleEditDialog({ current: null });
    getDialog();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    await expect(openPromise).resolves.toEqual({ action: 'cancel' });
  });

  it('closing with an overlay click resolves { action: "cancel" }, same as Cancelar', async () => {
    const openPromise = openVehicleEditDialog({ current: null });
    const dialog = getDialog();

    (dialog.shadowRoot!.querySelector('.overlay') as HTMLElement).click();

    await expect(openPromise).resolves.toEqual({ action: 'cancel' });
  });

  it('ignores a stale response when the type is changed twice before the first fetchVehicleMakes resolves (race condition, AC-023)', async () => {
    const first = deferred<string[]>();
    const second = deferred<string[]>();
    vi.mocked(fetchVehicleMakes)
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);

    void openVehicleEditDialog({ current: null });
    let dialog = getDialog();
    selectValue(typeSelect(dialog), 'motorcycle');
    await flush();

    dialog = getDialog();
    selectValue(typeSelect(dialog), 'car');
    await flush();

    // La primera petición (moto) llega tarde: su resultado debe descartarse.
    first.resolve(['Honda']);
    await flush();
    let refreshed = getDialog();
    expect(Array.from(makeSelect(refreshed).options).map((o) => o.value)).not.toContain('Honda');

    second.resolve(['Seat']);
    await flush();
    refreshed = getDialog();
    expect(Array.from(makeSelect(refreshed).options).map((o) => o.value)).toContain('Seat');
  });

  it('gives every new interactive control a unique data-cy (AC-037)', async () => {
    vi.mocked(fetchVehicleMakes).mockRejectedValue(new ExternalApiError('network', 'boom'));

    void openVehicleEditDialog({ current: null });
    let dialog = getDialog();
    selectValue(typeSelect(dialog), 'motorcycle');
    await flush();
    dialog = getDialog();

    const cyValues = Array.from(dialog.shadowRoot!.querySelectorAll('[data-cy]')).map((el) =>
      el.getAttribute('data-cy'),
    );
    const expected = [
      'profile-select-tipo-vehiculo',
      'profile-select-marca',
      'profile-select-modelo',
      'profile-vehicle-status',
      'profile-btn-reintentar-vehiculo',
      'profile-btn-guardar-vehiculo',
      'profile-btn-cancelar-vehiculo',
    ];
    for (const value of expected) {
      expect(cyValues.filter((v) => v === value)).toHaveLength(1);
    }
    expect(new Set(cyValues).size).toBe(cyValues.length);
  });

  it('applies the min-width/min-height hitbox token to selects and action buttons (AC-038)', () => {
    void openVehicleEditDialog({ current: null });
    const dialog = getDialog();

    expect(typeSelect(dialog).classList.contains('select')).toBe(true);
    expect(makeSelect(dialog).classList.contains('select')).toBe(true);
    expect(modelSelect(dialog).classList.contains('select')).toBe(true);
    expect(dialog.shadowRoot!.querySelector('[data-cy="profile-btn-guardar-vehiculo"]')?.classList.contains('action')).toBe(true);
    expect(dialog.shadowRoot!.querySelector('[data-cy="profile-btn-cancelar-vehiculo"]')?.classList.contains('action')).toBe(true);

    expect(dialogStyles).toMatch(/\.select\s*\{[^}]*min-height:\s*var\(--hitbox-min\)[^}]*\}/);
    expect(dialogStyles).toMatch(/\.action\s*\{[^}]*min-width:\s*var\(--hitbox-min\)[^}]*\}/);
    expect(dialogStyles).toMatch(/\.action\s*\{[^}]*min-height:\s*var\(--hitbox-min\)[^}]*\}/);
  });
});
