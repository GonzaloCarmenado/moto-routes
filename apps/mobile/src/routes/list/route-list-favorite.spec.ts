import { describe, it, expect, vi } from 'vitest';
import { buildRouteCardFavoriteIcon, buildFavoritesFilterToggle } from './route-list-favorite.js';
import { autoResyncIfNeeded } from '../detail/route-detail-cloud.service.js';
import type * as RouteDetailCloudService from '../detail/route-detail-cloud.service.js';
import type { IRouteRepository } from '../../shared/models/route.repository.js';
import type { Route } from '../../shared/models/route.types.js';
import type { Session } from '../../shared/models/session.types.js';
import type { RouteListItem } from './route-list-sync.transform.js';

vi.mock('../detail/route-detail-cloud.service.js', async (importOriginal) => {
  const actual = await importOriginal<typeof RouteDetailCloudService>();
  return { ...actual, autoResyncIfNeeded: vi.fn() };
});

function flushPromises(): Promise<void> {
  return new Promise((resolve) => { setTimeout(resolve, 0); });
}

function createRepository(): IRouteRepository {
  return { updateFavorite: vi.fn().mockResolvedValue(undefined) } as unknown as IRouteRepository;
}

function createItem(overrides?: Partial<RouteListItem>): RouteListItem {
  return { route: { id: 'r1', isFavorite: false } as Route, syncState: 'local', ...overrides };
}

describe('buildRouteCardFavoriteIcon', () => {
  it('renders a non-interactive indicator when there is no active session', () => {
    const el = buildRouteCardFavoriteIcon({
      repository: createRepository(), session: null, item: createItem(), onToggled: vi.fn(),
    });

    expect(el.tagName).toBe('SPAN');
    expect(el.getAttribute('data-cy')).toBe('route-card-btn-favorito');
  });

  it('toggles the route via updateFavorite and calls onToggled when there is an active session', async () => {
    const repository = createRepository();
    const item = createItem();
    const onToggled = vi.fn();

    const el = buildRouteCardFavoriteIcon({ repository, session: {} as Session, item, onToggled });
    expect(el.tagName).toBe('BUTTON');

    (el as HTMLButtonElement).click();
    await flushPromises();

    expect(repository.updateFavorite).toHaveBeenCalledWith('r1', true);
    expect(item.route.isFavorite).toBe(true);
    expect(onToggled).toHaveBeenCalledOnce();
  });

  it('triggers a background re-upload with isSynced: true for an already-synced route', async () => {
    const repository = createRepository();
    const item = createItem({ syncState: 'synced' });
    const session = { token: 'jwt-token', email: 'rider@example.com' };

    const el = buildRouteCardFavoriteIcon({ repository, session, item, onToggled: vi.fn() });
    (el as HTMLButtonElement).click();
    await flushPromises();

    expect(autoResyncIfNeeded).toHaveBeenCalledWith(expect.objectContaining({ session, repository, isSynced: true }));
  });

  it('does not trigger a real re-upload for a purely local route (isSynced: false)', async () => {
    const repository = createRepository();
    const item = createItem({ syncState: 'local' });
    const session = { token: 'jwt-token', email: 'rider@example.com' };

    const el = buildRouteCardFavoriteIcon({ repository, session, item, onToggled: vi.fn() });
    (el as HTMLButtonElement).click();
    await flushPromises();

    expect(autoResyncIfNeeded).toHaveBeenCalledWith(expect.objectContaining({ isSynced: false }));
  });
});

describe('buildFavoritesFilterToggle', () => {
  it('reflects the active state and calls onToggle when clicked', () => {
    const onToggle = vi.fn();
    const btn = buildFavoritesFilterToggle(false, onToggle) as HTMLButtonElement;

    expect(btn.getAttribute('data-cy')).toBe('route-list-filtro-favoritas');
    expect(btn.classList.contains('favorite-icon--active')).toBe(false);

    btn.click();
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it('marks itself active when active=true', () => {
    const btn = buildFavoritesFilterToggle(true, vi.fn()) as HTMLButtonElement;
    expect(btn.classList.contains('favorite-icon--active')).toBe(true);
    expect(btn.getAttribute('aria-pressed')).toBe('true');
  });

  it('is icon-only (no text label), with an aria-label for accessibility', () => {
    const btn = buildFavoritesFilterToggle(false, vi.fn()) as HTMLButtonElement;
    expect(btn.textContent?.trim()).toBe('');
    expect(btn.getAttribute('aria-label')).toBe('Solo favoritas');
    expect(btn.querySelector('svg')).not.toBeNull();
  });
});
