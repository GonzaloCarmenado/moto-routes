import { describe, it, expect, vi, afterEach } from 'vitest';
import { resolveStopDecision } from './cockpit-stop.service.js';
import type { RouteMetadata } from './cockpit.types.js';
import { MemoryRouteRepository } from '../shared/repositories/memory-route.repository.js';
import type { IPhotoRepository } from '../shared/models/photo.repository.js';

function getDialog(): HTMLElement {
  const el = document.body.querySelector('confirm-dialog');
  expect(el).not.toBeNull();
  return el as HTMLElement;
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
    getDialog().shadowRoot!.querySelector<HTMLButtonElement>('[data-cy="confirm-dialog-action-save"]')!.click();
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
    getDialog().shadowRoot!.querySelector<HTMLButtonElement>('[data-cy="confirm-dialog-action-discard"]')!.click();
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
    getDialog().shadowRoot!.querySelector<HTMLButtonElement>('[data-cy="confirm-dialog-action-discard"]')!.click();
    await promise;

    expect(service.discardStop).toHaveBeenCalledOnce();
    expect(document.body.querySelector('[data-cy="photo-toast-error"]')?.textContent)
      .toBe('⚠️ no se pudo abrir el repositorio de fotos');
    // Al fallar, no se afirma "Ruta descartada" — sería contradictorio con el error mostrado
    expect(document.body.querySelector('[data-cy="photo-toast"]')).toBeNull();
  });
});
