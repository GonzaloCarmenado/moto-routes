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

function makeSearchInput(dialog: HTMLElement): HTMLInputElement {
  return dialog.shadowRoot!.querySelector('[data-cy="profile-input-buscar-marca"]') as HTMLInputElement;
}

function makeOptionsBox(dialog: HTMLElement): HTMLElement | null {
  return dialog.shadowRoot!.querySelector('[data-cy="profile-marca-options"]');
}

function makeOptionButtons(dialog: HTMLElement): HTMLButtonElement[] {
  return Array.from(dialog.shadowRoot!.querySelectorAll('[data-cy="profile-marca-option"]'));
}

/** Simula elegir una marca haciendo click en su opción del listbox (sustituye al `<select>` nativo). */
function clickMakeOption(dialog: HTMLElement, makeName: string): void {
  const btn = makeOptionButtons(dialog).find((b) => b.textContent === makeName);
  expect(btn, `option "${makeName}" not found`).not.toBeUndefined();
  btn!.click();
}

function modelSelect(dialog: HTMLElement): HTMLSelectElement {
  return dialog.shadowRoot!.querySelector('[data-cy="profile-select-modelo"]') as HTMLSelectElement;
}

function selectValue(select: HTMLSelectElement, value: string): void {
  select.value = value;
  select.dispatchEvent(new Event('change'));
}

function typeQuery(input: HTMLInputElement, value: string): void {
  input.value = value;
  input.dispatchEvent(new Event('input'));
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

describe('openVehicleEditDialog (AC-016 a AC-023, AC-025, AC-026, AC-037 a AC-041)', () => {
  it('shows the type select visible from the start with make/model disabled and empty when there is no vehicle yet (AC-017, AC-018)', () => {
    void openVehicleEditDialog({ current: null });
    const dialog = getDialog();

    expect(typeSelect(dialog)).not.toBeNull();
    expect(typeSelect(dialog).value).toBe('');
    expect(makeSearchInput(dialog).disabled).toBe(true);
    expect(makeOptionsBox(dialog)).toBeNull();
    expect(modelSelect(dialog).disabled).toBe(true);
    expect(fetchVehicleMakes).not.toHaveBeenCalled();
  });

  it('preloads makes and models automatically when editing an already-saved vehicle, without the user touching the type select (AC-039)', async () => {
    vi.mocked(fetchVehicleMakes).mockResolvedValue(['HONDA', 'YAMAHA']);
    vi.mocked(fetchVehicleModels).mockResolvedValue(['CB500X', 'CBR600RR']);

    void openVehicleEditDialog({
      current: { vehicleType: 'motorcycle', vehicleMake: 'HONDA', vehicleModel: 'CB500X' },
    });
    const dialog = getDialog();
    expect(typeSelect(dialog).value).toBe('motorcycle');
    await flush();

    expect(fetchVehicleMakes).toHaveBeenCalledWith('motorcycle');
    expect(fetchVehicleModels).toHaveBeenCalledWith('HONDA', 'motorcycle');
    const refreshed = getDialog();
    expect(makeSearchInput(refreshed).value).toBe('HONDA');
    expect(modelSelect(refreshed).disabled).toBe(false);
    expect(modelSelect(refreshed).value).toBe('CB500X');
  });

  it('does not attempt to preload models when preloading makes for an existing vehicle fails', async () => {
    vi.mocked(fetchVehicleMakes).mockRejectedValue(new ExternalApiError('network', 'boom'));

    void openVehicleEditDialog({
      current: { vehicleType: 'motorcycle', vehicleMake: 'HONDA', vehicleModel: 'CB500X' },
    });
    await flush();

    expect(fetchVehicleModels).not.toHaveBeenCalled();
  });

  it('choosing "Moto" calls fetchVehicleMakes and shows a loading state on the make search input while pending (AC-018, AC-020)', async () => {
    const { promise } = deferred<string[]>();
    vi.mocked(fetchVehicleMakes).mockReturnValue(promise);

    void openVehicleEditDialog({ current: null });
    const dialog = getDialog();
    selectValue(typeSelect(dialog), 'motorcycle');
    await flush();

    expect(fetchVehicleMakes).toHaveBeenCalledWith('motorcycle');
    const make = makeSearchInput(getDialog());
    expect(make.classList.contains('is-loading')).toBe(true);
    expect(make.getAttribute('aria-busy')).toBe('true');
  });

  it('populates the make options and keeps the model select disabled/empty once fetchVehicleMakes resolves (AC-018)', async () => {
    const { promise, resolve } = deferred<string[]>();
    vi.mocked(fetchVehicleMakes).mockReturnValue(promise);

    void openVehicleEditDialog({ current: null });
    const dialog = getDialog();
    selectValue(typeSelect(dialog), 'motorcycle');
    await flush();

    resolve(['HONDA', 'YAMAHA']);
    await flush();

    const refreshed = getDialog();
    const make = makeSearchInput(refreshed);
    expect(make.disabled).toBe(false);
    expect(make.classList.contains('is-loading')).toBe(false);
    expect(makeOptionButtons(refreshed).map((b) => b.textContent)).toEqual(expect.arrayContaining(['HONDA', 'YAMAHA']));
    expect(modelSelect(refreshed).disabled).toBe(true);
  });

  it('shows known makes first (alphabetical) then the rest (alphabetical) when the search is empty (AC-041)', async () => {
    vi.mocked(fetchVehicleMakes).mockResolvedValue(['ZERO MOTORCYCLES', 'YAMAHA', 'BAY CITY CHOPPERS', 'HONDA']);

    void openVehicleEditDialog({ current: null });
    const dialog = getDialog();
    selectValue(typeSelect(dialog), 'motorcycle');
    await flush();

    const refreshed = getDialog();
    expect(makeOptionButtons(refreshed).map((b) => b.textContent)).toEqual([
      'HONDA', 'YAMAHA', 'BAY CITY CHOPPERS', 'ZERO MOTORCYCLES',
    ]);
  });

  it('filters the rendered make options as the user types, without re-querying vPIC (AC-040)', async () => {
    vi.mocked(fetchVehicleMakes).mockResolvedValue(['HONDA', 'YAMAHA', 'BAY CITY CHOPPERS']);

    void openVehicleEditDialog({ current: null });
    let dialog = getDialog();
    selectValue(typeSelect(dialog), 'motorcycle');
    await flush();

    dialog = getDialog();
    typeQuery(makeSearchInput(dialog), 'bay');
    const refreshed = getDialog();

    expect(makeOptionButtons(refreshed).map((b) => b.textContent)).toEqual(['BAY CITY CHOPPERS']);
    expect(fetchVehicleMakes).toHaveBeenCalledTimes(1);
  });

  it('discards the chosen make (and disables "Guardar") if the search text is edited away from it without picking a new option', async () => {
    vi.mocked(fetchVehicleMakes).mockResolvedValue(['HONDA', 'YAMAHA']);
    vi.mocked(fetchVehicleModels).mockResolvedValue(['CB500X']);

    void openVehicleEditDialog({ current: null });
    let dialog = getDialog();
    selectValue(typeSelect(dialog), 'motorcycle');
    await flush();
    dialog = getDialog();
    clickMakeOption(dialog, 'HONDA');
    await flush();
    dialog = getDialog();
    selectValue(modelSelect(dialog), 'CB500X');
    expect(dialog.shadowRoot!.querySelector<HTMLButtonElement>('[data-cy="profile-btn-guardar-vehiculo"]')?.disabled).toBe(false);

    // El usuario edita el texto sin llegar a elegir una opción nueva: la marca
    // ya elegida se descarta para que "Guardar" nunca persista algo distinto
    // de lo que el buscador muestra en pantalla.
    typeQuery(makeSearchInput(dialog), 'YAM');

    const refreshed = getDialog();
    expect(makeSearchInput(refreshed).value).toBe('YAM');
    expect(modelSelect(refreshed).disabled).toBe(true);
    expect(refreshed.shadowRoot!.querySelector<HTMLButtonElement>('[data-cy="profile-btn-guardar-vehiculo"]')?.disabled).toBe(true);
  });

  it('shows a labelled empty state when the search matches no make', async () => {
    vi.mocked(fetchVehicleMakes).mockResolvedValue(['HONDA', 'YAMAHA']);

    void openVehicleEditDialog({ current: null });
    let dialog = getDialog();
    selectValue(typeSelect(dialog), 'motorcycle');
    await flush();

    dialog = getDialog();
    typeQuery(makeSearchInput(dialog), 'zzz');

    const refreshed = getDialog();
    expect(makeOptionButtons(refreshed)).toHaveLength(0);
    const empty = refreshed.shadowRoot!.querySelector('[data-cy="profile-marca-empty"]');
    expect(empty).not.toBeNull();
    expect(empty?.textContent).toContain('No se encontraron marcas');
  });

  it('choosing a make calls fetchVehicleModels, fills the search input with the chosen make and shows a loading state on the model select while pending (AC-019, AC-020)', async () => {
    vi.mocked(fetchVehicleMakes).mockResolvedValue(['HONDA', 'YAMAHA']);
    const { promise } = deferred<string[]>();
    vi.mocked(fetchVehicleModels).mockReturnValue(promise);

    void openVehicleEditDialog({ current: null });
    let dialog = getDialog();
    selectValue(typeSelect(dialog), 'motorcycle');
    await flush();

    dialog = getDialog();
    clickMakeOption(dialog, 'HONDA');
    await flush();

    expect(fetchVehicleModels).toHaveBeenCalledWith('HONDA', 'motorcycle');
    const refreshed = getDialog();
    expect(makeSearchInput(refreshed).value).toBe('HONDA');
    const model = modelSelect(refreshed);
    expect(model.classList.contains('is-loading')).toBe(true);
    expect(model.getAttribute('aria-busy')).toBe('true');
  });

  it('populates the model select once fetchVehicleModels resolves (AC-019)', async () => {
    vi.mocked(fetchVehicleMakes).mockResolvedValue(['HONDA']);
    vi.mocked(fetchVehicleModels).mockResolvedValue(['CB500X', 'CBR600RR']);

    void openVehicleEditDialog({ current: null });
    let dialog = getDialog();
    selectValue(typeSelect(dialog), 'motorcycle');
    await flush();

    dialog = getDialog();
    clickMakeOption(dialog, 'HONDA');
    await flush();

    const model = modelSelect(getDialog());
    expect(model.disabled).toBe(false);
    expect(Array.from(model.options).map((o) => o.value)).toEqual(expect.arrayContaining(['CB500X', 'CBR600RR']));
  });

  it('changing type mid-edit discards the chosen make/model, re-fetches makes for the new type and resets the model select (AC-022)', async () => {
    vi.mocked(fetchVehicleMakes).mockResolvedValueOnce(['HONDA']).mockResolvedValueOnce(['SEAT']);
    vi.mocked(fetchVehicleModels).mockResolvedValue(['CB500X']);

    void openVehicleEditDialog({ current: null });
    let dialog = getDialog();
    selectValue(typeSelect(dialog), 'motorcycle');
    await flush();
    dialog = getDialog();
    clickMakeOption(dialog, 'HONDA');
    await flush();

    dialog = getDialog();
    expect(makeSearchInput(dialog).value).toBe('HONDA');

    selectValue(typeSelect(dialog), 'car');
    await flush();

    expect(fetchVehicleMakes).toHaveBeenLastCalledWith('car');
    const refreshed = getDialog();
    expect(makeSearchInput(refreshed).value).toBe('');
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
      .mockResolvedValueOnce(['HONDA']);

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
    expect(makeSearchInput(recovered).disabled).toBe(false);
  });

  it('clicking "Reintentar" after a models failure calls fetchVehicleModels again with the same make/type (AC-025)', async () => {
    vi.mocked(fetchVehicleMakes).mockResolvedValue(['HONDA']);
    vi.mocked(fetchVehicleModels)
      .mockRejectedValueOnce(new ExternalApiError('network', 'boom'))
      .mockResolvedValueOnce(['CB500X']);

    void openVehicleEditDialog({ current: null });
    let dialog = getDialog();
    selectValue(typeSelect(dialog), 'motorcycle');
    await flush();
    dialog = getDialog();
    clickMakeOption(dialog, 'HONDA');
    await flush();

    const withError = getDialog();
    withError.shadowRoot!.querySelector<HTMLButtonElement>('[data-cy="profile-btn-reintentar-vehiculo"]')?.click();
    await flush();

    expect(fetchVehicleModels).toHaveBeenCalledTimes(2);
    expect(fetchVehicleModels).toHaveBeenNthCalledWith(2, 'HONDA', 'motorcycle');
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
    vi.mocked(fetchVehicleMakes).mockResolvedValue(['HONDA']);
    vi.mocked(fetchVehicleModels).mockResolvedValue(['CB500X']);

    const openPromise = openVehicleEditDialog({ current: null });
    let dialog = getDialog();
    selectValue(typeSelect(dialog), 'motorcycle');
    await flush();
    dialog = getDialog();
    clickMakeOption(dialog, 'HONDA');
    await flush();
    dialog = getDialog();
    selectValue(modelSelect(dialog), 'CB500X');
    await flush();

    dialog = getDialog();
    dialog.shadowRoot!.querySelector<HTMLButtonElement>('[data-cy="profile-btn-guardar-vehiculo"]')?.click();

    await expect(openPromise).resolves.toEqual({
      action: 'save',
      vehicleType: 'motorcycle',
      vehicleMake: 'HONDA',
      vehicleModel: 'CB500X',
    });
  });

  it('disables the "Guardar" button while make or model is still missing', async () => {
    vi.mocked(fetchVehicleMakes).mockResolvedValue(['HONDA']);
    vi.mocked(fetchVehicleModels).mockResolvedValue(['CB500X']);

    void openVehicleEditDialog({ current: null });
    let dialog = getDialog();
    expect(dialog.shadowRoot!.querySelector<HTMLButtonElement>('[data-cy="profile-btn-guardar-vehiculo"]')?.disabled).toBe(true);

    selectValue(typeSelect(dialog), 'motorcycle');
    await flush();

    dialog = getDialog();
    expect(dialog.shadowRoot!.querySelector<HTMLButtonElement>('[data-cy="profile-btn-guardar-vehiculo"]')?.disabled).toBe(true);

    clickMakeOption(dialog, 'HONDA');
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
    resolve(['HONDA']);
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
    first.resolve(['HONDA']);
    await flush();
    let refreshed = getDialog();
    expect(makeOptionButtons(refreshed).map((b) => b.textContent)).not.toContain('HONDA');

    second.resolve(['SEAT']);
    await flush();
    refreshed = getDialog();
    expect(makeOptionButtons(refreshed).map((b) => b.textContent)).toContain('SEAT');
  });

  it('gives every new interactive control a unique data-cy, with make options sharing one data-cy by design (same pattern as route-card) (AC-037)', async () => {
    vi.mocked(fetchVehicleMakes).mockResolvedValue(['HONDA', 'YAMAHA']);

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
      'profile-input-buscar-marca',
      'profile-marca-options',
      'profile-select-modelo',
      'profile-btn-guardar-vehiculo',
      'profile-btn-cancelar-vehiculo',
    ];
    for (const value of expected) {
      expect(cyValues.filter((v) => v === value)).toHaveLength(1);
    }
    expect(makeOptionButtons(dialog).length).toBeGreaterThan(1);
    const nonRepeating = cyValues.filter((v) => v !== 'profile-marca-option');
    expect(new Set(nonRepeating).size).toBe(nonRepeating.length);
  });

  it('applies the min-width/min-height hitbox token to the type/model selects, the make search input and action buttons (AC-038)', () => {
    void openVehicleEditDialog({ current: null });
    const dialog = getDialog();

    expect(typeSelect(dialog).classList.contains('select')).toBe(true);
    expect(makeSearchInput(dialog).classList.contains('select')).toBe(true);
    expect(modelSelect(dialog).classList.contains('select')).toBe(true);
    expect(dialog.shadowRoot!.querySelector('[data-cy="profile-btn-guardar-vehiculo"]')?.classList.contains('action')).toBe(true);
    expect(dialog.shadowRoot!.querySelector('[data-cy="profile-btn-cancelar-vehiculo"]')?.classList.contains('action')).toBe(true);

    expect(dialogStyles).toMatch(/\.select\s*\{[^}]*min-height:\s*var\(--hitbox-min\)[^}]*\}/);
    expect(dialogStyles).toMatch(/\.action\s*\{[^}]*min-width:\s*var\(--hitbox-min\)[^}]*\}/);
    expect(dialogStyles).toMatch(/\.action\s*\{[^}]*min-height:\s*var\(--hitbox-min\)[^}]*\}/);
    expect(dialogStyles).toMatch(/\.make-option\s*\{[^}]*min-height:\s*var\(--hitbox-min\)[^}]*\}/);
  });
});
