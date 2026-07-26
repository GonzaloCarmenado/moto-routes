import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryRouteRepository } from '../shared/repositories/memory-route.repository.js';
import type { IRouteRepository } from '../shared/models/route.repository.js';
import './route-list.element.js';

async function waitRender(): Promise<void> {
  // 50ms: el borrado de ruta encadena confirmDialog + un import() dinámico
  // (getPhotoRepo) antes de refrescar — bajo carga (suite completa + cobertura
  // v8) un margen menor resultaba intermitente en otros specs similares.
  await new Promise((r) => setTimeout(r, 50));
}

async function createList(repo: IRouteRepository): Promise<HTMLElement> {
  const list = document.createElement('route-list') as HTMLElement & { repository: IRouteRepository };
  list.repository = repo;
  document.body.appendChild(list);
  await waitRender();
  return list;
}

describe('route-list - listado y tarjetas', () => {
  let repo: IRouteRepository;

  beforeEach(() => {
    repo = new MemoryRouteRepository();
  });

  it('shows a loading state synchronously while the initial fetch is in flight (AC-010)', () => {
    const list = document.createElement('route-list') as HTMLElement & { repository: IRouteRepository };
    list.repository = repo;
    document.body.appendChild(list);

    // fetchAndRender hace su primer render (loading) antes del primer await —
    // se puede observar sin esperar ningún microtask.
    expect(list.shadowRoot!.querySelector('[data-cy="route-list-loading"]')).not.toBeNull();
    document.body.removeChild(list);
  });

  it('replaces the loading state with the routes once the fetch resolves', async () => {
    const list = await createList(repo);
    const root = list.shadowRoot!;
    expect(root.querySelector('[data-cy="route-list-loading"]')).toBeNull();
    expect(root.querySelector('.route-list__empty')).not.toBeNull();
    document.body.removeChild(list);
  });

  it('should show empty message when no routes', async () => {
    const list = await createList(repo);
    const root = list.shadowRoot!;
    const empty = root.querySelector('.route-list__empty');
    expect(empty).not.toBeNull();
    expect(empty?.textContent).toContain('No hay rutas guardadas');
    document.body.removeChild(list);
  });

  it('should render 2 route cards when 2 routes exist', async () => {
    await repo.save(
      { duration: 300, totalDistance: 10, avgSpeed: 60, status: 'completed', visibility: 'private', origin: 'local' },
      [],
      [],
    );
    await repo.save(
      { duration: 600, totalDistance: 20, avgSpeed: 50, status: 'completed', visibility: 'private', origin: 'local' },
      [],
      [],
    );

    const list = await createList(repo);
    const root = list.shadowRoot!;
    const cards = root.querySelectorAll('.route-card');
    expect(cards.length).toBe(2);
    document.body.removeChild(list);
  });

  it('should show subtitle with count and total km', async () => {
    await repo.save(
      { duration: 100, totalDistance: 15.5, avgSpeed: 40, status: 'completed', visibility: 'private', origin: 'local' },
      [],
      [],
    );
    await repo.save(
      { duration: 200, totalDistance: 25.3, avgSpeed: 45, status: 'completed', visibility: 'private', origin: 'local' },
      [],
      [],
    );

    const list = await createList(repo);
    const root = list.shadowRoot!;
    const subtitle = root.querySelector('.route-list__subtitle');
    expect(subtitle).not.toBeNull();
    expect(subtitle?.textContent).toContain('2 rutas guardadas');
    expect(subtitle?.textContent).toContain('40.8 km recorridos');
    document.body.removeChild(list);
  });

});

describe('route-list - estructura de tarjeta', () => {
  let repo: IRouteRepository;

  beforeEach(() => {
    repo = new MemoryRouteRepository();
  });

  it('should render card structure with thumb, name, date, and badges', async () => {
    await repo.save(
      { duration: 420, totalDistance: 46.2, avgSpeed: 55, status: 'completed', visibility: 'private', origin: 'local' },
      [],
      [],
    );

    const list = await createList(repo);
    const root = list.shadowRoot!;
    const card = root.querySelector('.route-card');
    expect(card).not.toBeNull();
    expect(card?.querySelector('.thumb')).not.toBeNull();
    expect(card?.querySelector('.name')).not.toBeNull();
    expect(card?.querySelector('.date')).not.toBeNull();
    expect(card?.querySelector('.badge.distance')).not.toBeNull();
    expect(card?.querySelector('.badge.duration')).not.toBeNull();
    document.body.removeChild(list);
  });
});

describe('route-list - eventos e interacción', () => {
  let repo: IRouteRepository;

  beforeEach(() => {
    repo = new MemoryRouteRepository();
  });

  it('should emit view-route event when card is clicked', async () => {
    await repo.save(
      { duration: 100, totalDistance: 10, avgSpeed: 50, status: 'completed', visibility: 'private', origin: 'local' },
      [],
      [],
    );

    const list = await createList(repo);
    const root = list.shadowRoot!;
    const card = root.querySelector('.route-card') as HTMLElement;

    const handler = vi.fn();
    window.addEventListener('view-route', handler);
    card?.click();

    expect(handler).toHaveBeenCalledOnce();
    expect((handler.mock.calls[0]![0] as CustomEvent<{ routeId: string }>).detail.routeId).toBeTypeOf('string');
    window.removeEventListener('view-route', handler);
    document.body.removeChild(list);
  });

  it('shows a confirm dialog when the delete button is clicked, without also navigating to the route (AC-008)', async () => {
    await repo.save(
      { duration: 100, totalDistance: 10, avgSpeed: 50, status: 'completed', visibility: 'private', origin: 'local' },
      [], [],
    );
    const list = await createList(repo);
    const root = list.shadowRoot!;
    const deleteBtn = root.querySelector('[data-cy="route-card-btn-eliminar"]') as HTMLButtonElement;
    expect(deleteBtn).not.toBeNull();

    const viewHandler = vi.fn();
    window.addEventListener('view-route', viewHandler);
    deleteBtn.click();
    await waitRender();

    expect(document.body.querySelector('confirm-dialog')).not.toBeNull();
    expect(viewHandler).not.toHaveBeenCalled();

    window.removeEventListener('view-route', viewHandler);
    document.body.querySelector('confirm-dialog')?.remove();
    document.body.removeChild(list);
  });

  it('deletes the route and shows a toast when the deletion is confirmed, without reloading the screen (AC-008)', async () => {
    const saved = await repo.save(
      { duration: 100, totalDistance: 10, avgSpeed: 50, status: 'completed', visibility: 'private', origin: 'local' },
      [], [],
    );
    const list = await createList(repo);
    const root = list.shadowRoot!;
    (root.querySelector('[data-cy="route-card-btn-eliminar"]') as HTMLButtonElement).click();
    await waitRender();

    const dialog = document.body.querySelector('confirm-dialog')!;
    const confirmBtn = dialog.shadowRoot!.querySelector('[data-cy="confirm-dialog-action-confirm"]') as HTMLButtonElement;
    confirmBtn.click();
    await waitRender();

    expect(await repo.getById(saved.id)).toBeNull();
    expect(list.shadowRoot!.querySelectorAll('.route-card')).toHaveLength(0);
    expect(document.body.querySelector('[data-cy="photo-toast"]')?.textContent).toBe('Ruta eliminada');
    document.body.removeChild(list);
  });

  it('does not delete the route when the deletion is cancelled', async () => {
    const saved = await repo.save(
      { duration: 100, totalDistance: 10, avgSpeed: 50, status: 'completed', visibility: 'private', origin: 'local' },
      [], [],
    );
    const list = await createList(repo);
    const root = list.shadowRoot!;
    (root.querySelector('[data-cy="route-card-btn-eliminar"]') as HTMLButtonElement).click();
    await waitRender();

    const dialog = document.body.querySelector('confirm-dialog')!;
    const cancelBtn = dialog.shadowRoot!.querySelector('[data-cy="confirm-dialog-action-cancel"]') as HTMLButtonElement;
    cancelBtn.click();
    await waitRender();

    expect(await repo.getById(saved.id)).not.toBeNull();
    expect(list.shadowRoot!.querySelectorAll('.route-card')).toHaveLength(1);
    document.body.removeChild(list);
  });

  it('should refetch and render newly saved routes when the "nav-rutas" event fires', async () => {
    const list = await createList(repo);
    let root = list.shadowRoot!;
    expect(root.querySelector('.route-list__empty')).not.toBeNull();

    await repo.save(
      { duration: 300, totalDistance: 10, avgSpeed: 60, status: 'completed', visibility: 'private', origin: 'local' },
      [],
      [],
    );

    window.dispatchEvent(new CustomEvent('nav-rutas'));
    await waitRender();

    root = list.shadowRoot!;
    expect(root.querySelectorAll('.route-card').length).toBe(1);
    expect(root.querySelector('.route-list__empty')).toBeNull();
    document.body.removeChild(list);
  });
});