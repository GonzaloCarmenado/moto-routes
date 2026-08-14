import { describe, it, expect, vi } from 'vitest';
import { buildDetailHeader } from './route-detail-header.js';
import type { IRouteRepository } from '../../shared/models/route.repository.js';
import type { Route } from '../../shared/models/route.types.js';
import type { Session } from '../../shared/models/session.types.js';

function createRepository(): IRouteRepository {
  return { updateFavorite: vi.fn().mockResolvedValue(undefined) } as unknown as IRouteRepository;
}

function createRoute(): Route {
  return { id: 'r1', name: 'Puerto de la Bonaigua', createdAt: '2026-01-05T10:00:00.000Z', isFavorite: false } as Route;
}

function render(fragment: DocumentFragment): HTMLDivElement {
  const container = document.createElement('div');
  container.appendChild(fragment);
  return container;
}

describe('buildDetailHeader', () => {
  it('renders the title and the date', () => {
    const container = render(buildDetailHeader({
      route: createRoute(), repository: null, session: null, isLocalRoute: true, isSynced: false,
      onFavoriteToggled: vi.fn(), onUploaded: vi.fn(),
    }));

    expect(container.querySelector('[data-cy="route-detail-title"]')?.textContent).toBe('Puerto de la Bonaigua');
    expect(container.querySelector('.detail-date')).not.toBeNull();
  });

  it('does not render the favorite icon without a repository', () => {
    const container = render(buildDetailHeader({
      route: createRoute(), repository: null, session: {} as Session, isLocalRoute: true, isSynced: false,
      onFavoriteToggled: vi.fn(), onUploaded: vi.fn(),
    }));

    expect(container.querySelector('[data-cy="route-detail-btn-favorito"]')).toBeNull();
  });

  it('renders the favorite icon when a repository is present, even without a session', () => {
    const container = render(buildDetailHeader({
      route: createRoute(), repository: createRepository(), session: null, isLocalRoute: true, isSynced: false,
      onFavoriteToggled: vi.fn(), onUploaded: vi.fn(),
    }));

    expect(container.querySelector('[data-cy="route-detail-btn-favorito"]')).not.toBeNull();
  });

  it('renders the sync icon only with session, local route and repository', () => {
    const withoutSync = render(buildDetailHeader({
      route: createRoute(), repository: createRepository(), session: null, isLocalRoute: true, isSynced: false,
      onFavoriteToggled: vi.fn(), onUploaded: vi.fn(),
    }));
    expect(withoutSync.querySelector('[data-cy="route-detail-btn-subir-nube"]')).toBeNull();

    const withSync = render(buildDetailHeader({
      route: createRoute(), repository: createRepository(), session: {} as Session, isLocalRoute: true, isSynced: false,
      onFavoriteToggled: vi.fn(), onUploaded: vi.fn(),
    }));
    expect(withSync.querySelector('[data-cy="route-detail-btn-subir-nube"]')).not.toBeNull();
  });

  it('does not render the sync icon for a non-local (cloud-only) route', () => {
    const container = render(buildDetailHeader({
      route: createRoute(), repository: createRepository(), session: {} as Session, isLocalRoute: false, isSynced: false,
      onFavoriteToggled: vi.fn(), onUploaded: vi.fn(),
    }));

    expect(container.querySelector('[data-cy="route-detail-btn-subir-nube"]')).toBeNull();
  });
});
