import { describe, it, expect, vi, afterEach } from 'vitest';
import { resolveStopDecision } from './cockpit-stop.service.js';
import type { RouteMetadata } from '../cockpit.types.js';
import { MemoryRouteRepository } from '../../shared/repositories/memory-route.repository.js';
import type { IPhotoRepository } from '../../shared/models/photo.repository.js';

function getDialog(): HTMLElement {
  const el = document.body.querySelector('cockpit-save-route-dialog');
  expect(el).not.toBeNull();
  return el as HTMLElement;
}

function typeName(dialog: HTMLElement, name: string): void {
  const input = dialog.shadowRoot!.querySelector('[data-cy="save-route-dialog-input-name"]') as HTMLInputElement;
  input.value = name;
  input.dispatchEvent(new Event('input'));
}

function clickSave(dialog: HTMLElement): void {
  dialog.shadowRoot!.querySelector<HTMLButtonElement>('[data-cy="save-route-dialog-action-save"]')!.click();
}

function clickDiscard(dialog: HTMLElement): void {
  dialog.shadowRoot!.querySelector<HTMLButtonElement>('[data-cy="save-route-dialog-action-discard"]')!.click();
}

function createMockPhotoRepo(): IPhotoRepository {
  return {
    add: vi.fn(),
    getByRouteId: vi.fn().mockResolvedValue([]),
    getById: vi.fn().mockResolvedValue(null),
    delete: vi.fn().mockResolvedValue(undefined),
    countByRouteId: vi.fn().mockResolvedValue(0),
  };
}

const metadata: RouteMetadata = { date: '2026-07-22T00:00:00.000Z', duration: 120, totalDistance: 5.2, avgSpeed: 30, stops: [] };

afterEach(() => {
  document.body.innerHTML = '';
});

describe('resolveStopDecision', () => {
  it('persists the route and shows a success toast, without touching photoRepo, when the user saves', async () => {
    const routeRepo = new MemoryRouteRepository();
    const route = await routeRepo.save(
      { duration: 0, totalDistance: 0, avgSpeed: 0, status: 'active', visibility: 'private', origin: 'local' },
      [], [],
    );
    const getPhotoRepo = vi.fn();
    const service = { confirmSaveRecording: vi.fn(), discardStop: vi.fn() };

    const promise = resolveStopDecision({ metadata, routeId: route.id, service, routeRepo, getPhotoRepo });
    clickSave(getDialog());
    await promise;

    expect(service.confirmSaveRecording).toHaveBeenCalledOnce();
    expect(service.discardStop).not.toHaveBeenCalled();
    expect(getPhotoRepo).not.toHaveBeenCalled();
    expect(document.body.querySelector('[data-cy="photo-toast"]')?.textContent).toBe('Ruta guardada');
  });

  it('shows a progress toast while discarding, dismissed by the time the success toast appears', async () => {
    const routeRepo = new MemoryRouteRepository();
    const route = await routeRepo.save(
      { duration: 0, totalDistance: 0, avgSpeed: 0, status: 'active', visibility: 'private', origin: 'local' },
      [], [],
    );
    const photoRepo = createMockPhotoRepo();
    const service = { confirmSaveRecording: vi.fn(), discardStop: vi.fn() };

    const promise = resolveStopDecision({
      metadata, routeId: route.id, service, routeRepo,
      getPhotoRepo: () => Promise.resolve(photoRepo),
    });
    clickDiscard(getDialog());
    await promise;

    expect(service.discardStop).toHaveBeenCalledOnce();
    expect(await routeRepo.getById(route.id)).toBeNull();
    // Solo queda el toast final — el de progreso ya se descartó
    expect(document.body.querySelectorAll('.photo-toast')).toHaveLength(1);
    expect(document.body.querySelector('[data-cy="photo-toast"]')?.textContent).toBe('Ruta descartada');
  });

  it('shows an error toast and still resets the cockpit (discardStop) when deletion fails', async () => {
    const routeRepo = new MemoryRouteRepository();
    const route = await routeRepo.save(
      { duration: 0, totalDistance: 0, avgSpeed: 0, status: 'active', visibility: 'private', origin: 'local' },
      [], [],
    );
    const service = { confirmSaveRecording: vi.fn(), discardStop: vi.fn() };

    const promise = resolveStopDecision({
      metadata, routeId: route.id, service, routeRepo,
      getPhotoRepo: () => Promise.reject(new Error('no se pudo abrir el repositorio de fotos')),
    });
    clickDiscard(getDialog());
    await promise;

    expect(service.discardStop).toHaveBeenCalledOnce();
    expect(document.body.querySelector('[data-cy="photo-toast-error"]')?.textContent)
      .toBe('⚠️ no se pudo abrir el repositorio de fotos');
    // Al fallar, no se afirma "Ruta descartada" — sería contradictorio con el error mostrado
    expect(document.body.querySelector('[data-cy="photo-toast"]')).toBeNull();
  });

  it('trims and passes the typed name to confirmSaveRecording when the user types one and saves (AC-001, AC-003)', async () => {
    const routeRepo = new MemoryRouteRepository();
    const route = await routeRepo.save(
      { duration: 0, totalDistance: 0, avgSpeed: 0, status: 'active', visibility: 'private', origin: 'local' },
      [], [],
    );
    const getPhotoRepo = vi.fn();
    const service = { confirmSaveRecording: vi.fn(), discardStop: vi.fn() };

    const promise = resolveStopDecision({ metadata, routeId: route.id, service, routeRepo, getPhotoRepo });
    const dialog = getDialog();
    typeName(dialog, '  Puerto de la Bonaigua  ');
    clickSave(dialog);
    await promise;

    expect(service.confirmSaveRecording).toHaveBeenCalledWith('Puerto de la Bonaigua');
  });

  it('falls back to a date/time-based default name when the user saves without typing one (AC-002)', async () => {
    const routeRepo = new MemoryRouteRepository();
    const route = await routeRepo.save(
      { duration: 0, totalDistance: 0, avgSpeed: 0, status: 'active', visibility: 'private', origin: 'local' },
      [], [],
    );
    const getPhotoRepo = vi.fn();
    const service = { confirmSaveRecording: vi.fn(), discardStop: vi.fn() };

    const promise = resolveStopDecision({ metadata, routeId: route.id, service, routeRepo, getPhotoRepo });
    clickSave(getDialog());
    await promise;

    expect(service.confirmSaveRecording).toHaveBeenCalledOnce();
    const nameArg = service.confirmSaveRecording.mock.calls[0]![0] as string;
    expect(nameArg.startsWith('Ruta ')).toBe(true);
    expect(nameArg).toContain('2026');
  });

  it('does not persist the route nor call confirmSaveRecording when a name was typed but the user discards (AC-008)', async () => {
    const routeRepo = new MemoryRouteRepository();
    const route = await routeRepo.save(
      { duration: 0, totalDistance: 0, avgSpeed: 0, status: 'active', visibility: 'private', origin: 'local' },
      [], [],
    );
    const photoRepo = createMockPhotoRepo();
    const service = { confirmSaveRecording: vi.fn(), discardStop: vi.fn() };

    const promise = resolveStopDecision({
      metadata, routeId: route.id, service, routeRepo,
      getPhotoRepo: () => Promise.resolve(photoRepo),
    });
    const dialog = getDialog();
    typeName(dialog, 'Ruta de prueba');
    clickDiscard(dialog);
    await promise;

    expect(service.confirmSaveRecording).not.toHaveBeenCalled();
    expect(await routeRepo.getById(route.id)).toBeNull();
  });

  it('truncates a name longer than 100 characters before persisting (AC-009)', async () => {
    const routeRepo = new MemoryRouteRepository();
    const route = await routeRepo.save(
      { duration: 0, totalDistance: 0, avgSpeed: 0, status: 'active', visibility: 'private', origin: 'local' },
      [], [],
    );
    const getPhotoRepo = vi.fn();
    const service = { confirmSaveRecording: vi.fn(), discardStop: vi.fn() };

    const promise = resolveStopDecision({ metadata, routeId: route.id, service, routeRepo, getPhotoRepo });
    const dialog = getDialog();
    typeName(dialog, 'a'.repeat(150));
    clickSave(dialog);
    await promise;

    const nameArg = service.confirmSaveRecording.mock.calls[0]![0] as string;
    expect(nameArg).toHaveLength(100);
  });
});
