import { describe, it, expect, vi } from 'vitest';
import { buildLocalOnlyFilterToggle, buildCloudOnlyFilterToggle } from './route-list-sync-filters.js';

describe('buildLocalOnlyFilterToggle', () => {
  it('has the right data-cy, aria-label, and calls onToggle when clicked', () => {
    const onToggle = vi.fn();
    const btn = buildLocalOnlyFilterToggle(false, onToggle);

    expect(btn.getAttribute('data-cy')).toBe('route-list-filtro-locales');
    expect(btn.getAttribute('aria-label')).toBe('Solo locales');
    expect(btn.classList.contains('favorite-icon--active')).toBe(false);

    btn.click();
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it('marks itself active when active=true', () => {
    const btn = buildLocalOnlyFilterToggle(true, vi.fn());
    expect(btn.classList.contains('favorite-icon--active')).toBe(true);
    expect(btn.getAttribute('aria-pressed')).toBe('true');
  });
});

describe('buildCloudOnlyFilterToggle', () => {
  it('has the right data-cy, aria-label, and calls onToggle when clicked', () => {
    const onToggle = vi.fn();
    const btn = buildCloudOnlyFilterToggle(false, onToggle);

    expect(btn.getAttribute('data-cy')).toBe('route-list-filtro-nube');
    expect(btn.getAttribute('aria-label')).toBe('Solo en la nube');

    btn.click();
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it('marks itself active when active=true', () => {
    const btn = buildCloudOnlyFilterToggle(true, vi.fn());
    expect(btn.classList.contains('favorite-icon--active')).toBe(true);
    expect(btn.getAttribute('aria-pressed')).toBe('true');
  });
});
