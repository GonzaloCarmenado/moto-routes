import { describe, it, expect } from 'vitest';
import { buildAvatarPlaceholder } from './avatar-placeholder-icon.js';

describe('avatar-placeholder-icon', () => {
  it('builds an SVG element with the placeholder data-cy', () => {
    const svg = buildAvatarPlaceholder();

    expect(svg.tagName.toLowerCase()).toBe('svg');
    expect(svg.getAttribute('data-cy')).toBe('profile-avatar-placeholder');
    expect(svg.getAttribute('aria-hidden')).toBe('true');
  });

  it('builds a fresh element on each call, not a shared node', () => {
    const first = buildAvatarPlaceholder();
    const second = buildAvatarPlaceholder();

    expect(first).not.toBe(second);
  });
});
