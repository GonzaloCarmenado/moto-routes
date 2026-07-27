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

function currentThumb(list: HTMLElement): Element {
  return list.shadowRoot!.querySelector('.thumb')!;
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

describe('route-list - nombre de ruta (AC-005, AC-007)', () => {
  let repo: IRouteRepository;

  beforeEach(() => {
    repo = new MemoryRouteRepository();
  });

  it('shows the persisted name in the card .name when the route has one (AC-005)', async () => {
    await repo.save(
      { duration: 300, totalDistance: 10, avgSpeed: 60, status: 'completed', visibility: 'private', origin: 'local', name: 'Puerto de la Bonaigua' },
      [],
      [],
    );

    const list = await createList(repo);
    const root = list.shadowRoot!;
    expect(root.querySelector('.name')?.textContent).toBe('Puerto de la Bonaigua');
    document.body.removeChild(list);
  });

  it('falls back to the "Ruta {fecha}" text when name is null (AC-007)', async () => {
    await repo.save(
      { duration: 300, totalDistance: 10, avgSpeed: 60, status: 'completed', visibility: 'private', origin: 'local' },
      [],
      [],
    );

    const list = await createList(repo);
    const root = list.shadowRoot!;
    expect(root.querySelector('.name')?.textContent).toContain('Ruta ');
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

describe('route-list - trazado SVG y backfill perezoso (AC-021, AC-022, AC-023, AC-024, AC-031)', () => {
  let repo: IRouteRepository;

  beforeEach(() => {
    repo = new MemoryRouteRepository();
  });

  it('renders an svg with a path inside .thumb, without the media-placeholder class, when previewPolyline is already saved (AC-021)', async () => {
    const saved = await repo.save(
      { duration: 100, totalDistance: 5, avgSpeed: 20, status: 'completed', visibility: 'private', origin: 'local' },
      [],
      [],
    );
    await repo.updatePreviewPolyline(saved.id, [
      [10, 20],
      [11, 21],
      [12, 22],
    ]);

    const list = await createList(repo);
    const root = list.shadowRoot!;
    const card = root.querySelector('.route-card')!;
    const thumb = card.querySelector('.thumb')!;
    expect(thumb.classList.contains('media-placeholder')).toBe(false);
    expect(thumb.querySelector('svg path[data-cy="route-card-trace"]')).not.toBeNull();
    document.body.removeChild(list);
  });

  it('keeps showing the striped placeholder without throwing when the route has neither previewPolyline nor route_points (AC-022, AC-024)', async () => {
    await repo.save(
      { duration: 100, totalDistance: 5, avgSpeed: 20, status: 'completed', visibility: 'private', origin: 'local' },
      [],
      [],
    );

    const list = await createList(repo);
    await waitRender();
    const root = list.shadowRoot!;
    const thumb = root.querySelector('.thumb')!;
    expect(thumb.classList.contains('media-placeholder')).toBe(true);
    expect(thumb.querySelector('svg')).toBeNull();
    document.body.removeChild(list);
  });

  it('shows the placeholder on first render, then swaps to the svg once the background backfill resolves, without recomputing on a second load (AC-023, AC-031)', async () => {
    const routeId = crypto.randomUUID();
    await repo.save(
      { id: routeId, duration: 100, totalDistance: 5, avgSpeed: 20, status: 'completed', visibility: 'private', origin: 'local' },
      [
        { routeId, timestamp: 1, lat: 10, lng: 20, alt: 0, speed: 0 },
        { routeId, timestamp: 2, lat: 11, lng: 21, alt: 0, speed: 0 },
      ],
      [],
    );
    const persistedPoints = await repo.getPointsByRouteId(routeId);

    // Retrasa deliberadamente la respuesta de getPointsByRouteId para poder
    // observar el estado intermedio: placeholder pintado antes de que el
    // backfill en segundo plano resuelva.
    let resolvePoints!: (points: typeof persistedPoints) => void;
    const deferred = new Promise<typeof persistedPoints>((resolve) => {
      resolvePoints = resolve;
    });
    vi.spyOn(repo, 'getPointsByRouteId').mockReturnValueOnce(deferred);
    const updateSpy = vi.spyOn(repo, 'updatePreviewPolyline');

    // Monta primero y asigna el repositorio después: evita que `connectedCallback`
    // y el setter de `repository` disparen dos `fetchAndRender()` concurrentes
    // (lo que haría el `getPointsByRouteId` mockeado solo "una vez" impredecible).
    const list = document.createElement('route-list') as HTMLElement & { repository: IRouteRepository };
    document.body.appendChild(list);
    list.repository = repo;
    await waitRender();
    expect(currentThumb(list).classList.contains('media-placeholder')).toBe(true);
    expect(updateSpy).not.toHaveBeenCalled();

    // Ahora resuelve la respuesta pendiente: el backfill en segundo plano completa.
    resolvePoints(persistedPoints);
    await waitRender();
    expect(currentThumb(list).classList.contains('media-placeholder')).toBe(false);
    expect(currentThumb(list).querySelector('svg path[data-cy="route-card-trace"]')).not.toBeNull();
    expect(updateSpy).toHaveBeenCalledOnce();

    // Segunda carga del listado (ej. volver a abrir): no se recalcula de nuevo.
    window.dispatchEvent(new CustomEvent('nav-rutas'));
    await waitRender();
    expect(currentThumb(list).querySelector('svg path[data-cy="route-card-trace"]')).not.toBeNull();
    expect(updateSpy).toHaveBeenCalledOnce();

    document.body.removeChild(list);
  });
});