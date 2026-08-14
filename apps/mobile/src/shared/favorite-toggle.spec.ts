import { describe, it, expect, vi } from 'vitest';
import { buildFavoriteToggle } from './favorite-toggle.js';

describe('buildFavoriteToggle', () => {
  it('renders a non-interactive <span> when there is no active session (onToggle null), still with data-cy (locatable, per project rule)', () => {
    const el = buildFavoriteToggle({ isFavorite: true, onToggle: null, dataCy: 'route-list-btn-favorito' });

    expect(el.tagName).toBe('SPAN');
    expect(el.getAttribute('data-cy')).toBe('route-list-btn-favorito');
    expect(el.classList.contains('favorite-icon--active')).toBe(true);
  });

  it('renders an interactive <button> with data-cy when there is an active session', () => {
    const el = buildFavoriteToggle({ isFavorite: false, onToggle: vi.fn(), dataCy: 'route-list-btn-favorito' });

    expect(el.tagName).toBe('BUTTON');
    expect(el.getAttribute('data-cy')).toBe('route-list-btn-favorito');
    expect(el.classList.contains('favorite-icon--active')).toBe(false);
  });

  it('shows the read-only indicator filled regardless of session, even without an action', () => {
    const el = buildFavoriteToggle({ isFavorite: true, onToggle: null, dataCy: 'route-list-btn-favorito' });
    expect(el.classList.contains('favorite-icon--active')).toBe(true);
  });

  it('calls onToggle and stops propagation when clicked', () => {
    const onToggle = vi.fn();
    const el = buildFavoriteToggle({ isFavorite: false, onToggle, dataCy: 'route-list-btn-favorito' });
    const parent = document.createElement('div');
    const parentClick = vi.fn();
    parent.addEventListener('click', parentClick);
    parent.appendChild(el);

    (el as HTMLButtonElement).click();

    expect(onToggle).toHaveBeenCalledOnce();
    expect(parentClick).not.toHaveBeenCalled();
  });

  it('reflects aria-pressed for the interactive state', () => {
    const marked = buildFavoriteToggle({ isFavorite: true, onToggle: vi.fn(), dataCy: 'x' });
    const unmarked = buildFavoriteToggle({ isFavorite: false, onToggle: vi.fn(), dataCy: 'x' });

    expect(marked.getAttribute('aria-pressed')).toBe('true');
    expect(unmarked.getAttribute('aria-pressed')).toBe('false');
  });
});
