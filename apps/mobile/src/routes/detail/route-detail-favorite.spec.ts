import { describe, it, expect, vi } from 'vitest';
import { buildRouteDetailFavoriteIcon } from './route-detail-favorite.js';
import type { IRouteRepository } from '../../shared/models/route.repository.js';
import type { Route } from '../../shared/models/route.types.js';
import type { Session } from '../../shared/models/session.types.js';

function flushPromises(): Promise<void> {
  return new Promise((resolve) => { setTimeout(resolve, 0); });
}

function createRepository(): IRouteRepository {
  return { updateFavorite: vi.fn().mockResolvedValue(undefined) } as unknown as IRouteRepository;
}

describe('buildRouteDetailFavoriteIcon', () => {
  it('renders a non-interactive indicator when there is no active session', () => {
    const route = { id: 'r1', isFavorite: false } as Route;
    const el = buildRouteDetailFavoriteIcon({ repository: createRepository(), route, session: null, onToggled: vi.fn() });

    expect(el.tagName).toBe('SPAN');
    expect(el.getAttribute('data-cy')).toBe('route-detail-btn-favorito');
  });

  it('toggles the route via updateFavorite and calls onToggled when there is an active session', async () => {
    const repository = createRepository();
    const route = { id: 'r1', isFavorite: false } as Route;
    const onToggled = vi.fn();

    const el = buildRouteDetailFavoriteIcon({ repository, route, session: {} as Session, onToggled });
    expect(el.tagName).toBe('BUTTON');

    (el as HTMLButtonElement).click();
    await flushPromises();

    expect(repository.updateFavorite).toHaveBeenCalledWith('r1', true);
    expect(route.isFavorite).toBe(true);
    expect(onToggled).toHaveBeenCalledOnce();
  });

  it('toggles back to false on a second click', async () => {
    const repository = createRepository();
    const route = { id: 'r1', isFavorite: true } as Route;

    const el = buildRouteDetailFavoriteIcon({ repository, route, session: {} as Session, onToggled: vi.fn() });
    (el as HTMLButtonElement).click();
    await flushPromises();

    expect(repository.updateFavorite).toHaveBeenCalledWith('r1', false);
    expect(route.isFavorite).toBe(false);
  });
});
