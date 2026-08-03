import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { MemoryProfileRepository } from '../shared/repositories/memory-profile.repository.js';
import { MemoryRouteRepository } from '../shared/repositories/memory-route.repository.js';
import type { IProfileRepository } from '../shared/models/profile.repository.js';
import type { IRouteRepository } from '../shared/models/route.repository.js';
import type { Route } from '../shared/models/route.types.js';
import { fetchVehicleMakes, fetchVehicleModels } from './vpic.service.js';
import './profile.element.js';

// AC-024: la carga normal de la vista de Perfil nunca debe consultar la API
// externa — mockeada para poder confirmar `not.toHaveBeenCalled()`.
vi.mock('./vpic.service.js', () => ({
  fetchVehicleMakes: vi.fn(),
  fetchVehicleModels: vi.fn(),
}));

// `?inline` no sirve para inspeccionar el CSS fuente bajo Vitest — se lee el
// fichero directamente, mismo patrón que `profile-edit-dialog.element.spec.ts`.
const cssPath = resolve(process.cwd(), 'src/profile/profile.element.css');
const viewStyles = readFileSync(cssPath, 'utf8');

type ProfileViewEl = HTMLElement & {
  repository: IRouteRepository | null;
  profileRepository: IProfileRepository | null;
};

async function waitRender(): Promise<void> {
  await new Promise((r) => setTimeout(r, 20));
}

function selectValue(select: HTMLSelectElement, value: string): void {
  select.value = value;
  select.dispatchEvent(new Event('change'));
}

function buildRoute(overrides: Partial<Route>): Route {
  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    duration: 0,
    totalDistance: 0,
    avgSpeed: 0,
    status: 'completed',
    visibility: 'private',
    origin: 'local',
    previewPolyline: null,
    name: null,
    notes: null,
    ...overrides,
  };
}

async function createView(profileRepo: IProfileRepository, routeRepo: IRouteRepository): Promise<ProfileViewEl> {
  const el = document.createElement('profile-view') as ProfileViewEl;
  el.profileRepository = profileRepo;
  el.repository = routeRepo;
  document.body.appendChild(el);
  await waitRender();
  return el;
}

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('profile-view — vista principal', () => {
  it('shows a loading state synchronously while the initial fetch is in flight', () => {
    const el = document.createElement('profile-view') as ProfileViewEl;
    el.profileRepository = new MemoryProfileRepository();
    el.repository = new MemoryRouteRepository();
    document.body.appendChild(el);

    expect(el.shadowRoot!.querySelector('[data-cy="profile-view-loading"]')).not.toBeNull();
  });

  it('con un perfil vacío, renderiza los placeholders de avatar/nombre/vehículo/estadísticas sin llamar a vPIC (AC-001, AC-002, AC-003, AC-015, AC-024, AC-031)', async () => {
    const view = await createView(new MemoryProfileRepository(), new MemoryRouteRepository());
    const root = view.shadowRoot!;

    expect(root.querySelector('[data-cy="profile-avatar-placeholder"]')).not.toBeNull();
    expect(root.querySelector('.profile-name')?.textContent).toBe('Motorista sin nombre');
    expect(root.querySelector('[data-cy="profile-vehicle-empty"]')).not.toBeNull();
    expect(root.querySelector('[data-cy="profile-stats-empty"]')).not.toBeNull();
    expect(fetchVehicleMakes).not.toHaveBeenCalled();
    expect(fetchVehicleModels).not.toHaveBeenCalled();
  });

  it('con un perfil guardado y rutas completadas, renderiza avatar/nombre reales, vehículo y un .stat-grid con 5 valores (AC-001, AC-014, AC-028, AC-029)', async () => {
    const profileRepo = new MemoryProfileRepository();
    await profileRepo.save({
      avatarPath: '/app-data/photos/avatar.jpg',
      name: 'Marc',
      vehicleType: 'motorcycle',
      vehicleMake: 'Honda',
      vehicleModel: 'CB500X',
    });
    const routeRepo = new MemoryRouteRepository();
    routeRepo.seed([
      buildRoute({ status: 'completed', totalDistance: 20, duration: 1800, avgSpeed: 40 }),
      buildRoute({ status: 'completed', totalDistance: 45, duration: 3600, avgSpeed: 60 }),
      buildRoute({ status: 'completed', totalDistance: 120, duration: 7200, avgSpeed: 80 }),
      buildRoute({ status: 'active', totalDistance: 999, avgSpeed: 999 }),
    ]);

    const view = await createView(profileRepo, routeRepo);
    const root = view.shadowRoot!;

    expect(root.querySelector('img.avatar-image')).not.toBeNull();
    expect(root.querySelector('.profile-name')?.textContent).toBe('Marc');
    expect(root.querySelector('.vehicle-details')?.textContent).toContain('Honda');
    expect(root.querySelector('.vehicle-details')?.textContent).toContain('CB500X');
    expect(root.querySelectorAll('.stat-tile').length).toBe(5);
  });

  it('clicking [data-cy="profile-btn-editar-perfil"] opens profile-edit-dialog (AC-004)', async () => {
    const view = await createView(new MemoryProfileRepository(), new MemoryRouteRepository());

    view.shadowRoot!.querySelector<HTMLButtonElement>('[data-cy="profile-btn-editar-perfil"]')?.click();
    await waitRender();

    expect(document.body.querySelector('profile-edit-dialog')).not.toBeNull();
  });

  it('after saving profile-edit-dialog, the view re-renders with the new data without reloading the page (AC-004, AC-009)', async () => {
    const profileRepo = new MemoryProfileRepository();
    const view = await createView(profileRepo, new MemoryRouteRepository());

    view.shadowRoot!.querySelector<HTMLButtonElement>('[data-cy="profile-btn-editar-perfil"]')?.click();
    await waitRender();
    const dialog = document.body.querySelector('profile-edit-dialog')!;
    const input = dialog.shadowRoot!.querySelector<HTMLInputElement>('[data-cy="profile-input-nombre"]')!;
    input.value = 'Marc Nuevo';
    input.dispatchEvent(new Event('input'));
    dialog.shadowRoot!.querySelector<HTMLButtonElement>('[data-cy="profile-btn-guardar-perfil"]')?.click();
    await waitRender();

    expect(view.shadowRoot!.querySelector('.profile-name')?.textContent).toBe('Marc Nuevo');
    const saved = await profileRepo.get();
    expect(saved?.name).toBe('Marc Nuevo');
  });

  it('clicking [data-cy="profile-btn-editar-vehiculo"] opens profile-vehicle-dialog (AC-016)', async () => {
    const view = await createView(new MemoryProfileRepository(), new MemoryRouteRepository());

    view.shadowRoot!.querySelector<HTMLButtonElement>('[data-cy="profile-btn-editar-vehiculo"]')?.click();
    await waitRender();

    expect(document.body.querySelector('profile-vehicle-dialog')).not.toBeNull();
  });

  it('after saving profile-vehicle-dialog, "Mi vehículo" updates without any additional vPIC call (AC-016, AC-021, AC-024)', async () => {
    vi.mocked(fetchVehicleMakes).mockResolvedValue([{ id: 474, name: 'Honda' }]);
    vi.mocked(fetchVehicleModels).mockResolvedValue(['CB500X']);
    const profileRepo = new MemoryProfileRepository();
    const view = await createView(profileRepo, new MemoryRouteRepository());

    view.shadowRoot!.querySelector<HTMLButtonElement>('[data-cy="profile-btn-editar-vehiculo"]')?.click();
    await waitRender();
    const dialog = document.body.querySelector('profile-vehicle-dialog')!;

    selectValue(dialog.shadowRoot!.querySelector('[data-cy="profile-select-tipo-vehiculo"]')!, 'motorcycle');
    await waitRender();

    const makeOption = Array.from(dialog.shadowRoot!.querySelectorAll<HTMLButtonElement>('[data-cy="profile-marca-option"]'))
      .find((btn) => btn.textContent === 'Honda');
    makeOption?.click();
    await waitRender();

    selectValue(dialog.shadowRoot!.querySelector('[data-cy="profile-select-modelo"]')!, 'CB500X');
    dialog.shadowRoot!.querySelector<HTMLButtonElement>('[data-cy="profile-btn-guardar-vehiculo"]')?.click();
    await waitRender();

    expect(fetchVehicleMakes).toHaveBeenCalledTimes(1);
    expect(fetchVehicleModels).toHaveBeenCalledTimes(1);
    expect(view.shadowRoot!.querySelector('.vehicle-details')?.textContent).toContain('Honda');
    expect(view.shadowRoot!.querySelector('.vehicle-details')?.textContent).toContain('CB500X');

    const saved = await profileRepo.get();
    expect(saved?.vehicleMake).toBe('Honda');
  });

  it('gives every new interactive control a unique data-cy and applies the min-width/min-height hitbox token to .edit-btn (AC-037, AC-038)', async () => {
    const profileRepo = new MemoryProfileRepository();
    await profileRepo.save({ vehicleType: 'motorcycle', vehicleMake: 'Honda', vehicleModel: 'CB500X' });
    const view = await createView(profileRepo, new MemoryRouteRepository());
    const root = view.shadowRoot!;

    const cyValues = Array.from(root.querySelectorAll('[data-cy]')).map((el) => el.getAttribute('data-cy'));
    expect(new Set(cyValues).size).toBe(cyValues.length);
    expect(cyValues).toContain('profile-avatar-editar');
    expect(cyValues).toContain('profile-btn-editar-perfil');
    expect(cyValues).toContain('profile-btn-editar-vehiculo');

    expect(root.querySelector('[data-cy="profile-btn-editar-perfil"]')?.classList.contains('edit-btn')).toBe(true);
    expect(root.querySelector('[data-cy="profile-btn-editar-vehiculo"]')?.classList.contains('edit-btn')).toBe(true);
    expect(viewStyles).toMatch(/\.edit-btn\s*\{[^}]*min-width:\s*var\(--hitbox-min\)[^}]*\}/);
    expect(viewStyles).toMatch(/\.edit-btn\s*\{[^}]*min-height:\s*var\(--hitbox-min\)[^}]*\}/);
  });
});
