import { describe, it, expect, vi } from 'vitest';
import { buildProfileHeader } from './profile-header.js';

describe('buildProfileHeader', () => {
  it('renders an <img> with the given src and the circular-crop class when avatarUrl is provided (AC-001)', () => {
    const header = buildProfileHeader({ avatarUrl: 'blob:http://localhost/avatar-123', name: 'Marc' });

    const img = header.querySelector('img');
    expect(img).not.toBeNull();
    expect(img?.getAttribute('src')).toBe('blob:http://localhost/avatar-123');
    expect(img?.classList.contains('avatar-image')).toBe(true);
  });

  it('never renders an <img> and instead renders the placeholder node when avatarUrl is null (AC-002)', () => {
    const header = buildProfileHeader({ avatarUrl: null, name: 'Marc' });

    expect(header.querySelector('img')).toBeNull();
    const placeholder = header.querySelector('[data-cy="profile-avatar-placeholder"]');
    expect(placeholder).not.toBeNull();
  });

  it('shows the default placeholder text when name is null (AC-003)', () => {
    const header = buildProfileHeader({ avatarUrl: null, name: null });

    const nameEl = header.querySelector('.profile-name');
    expect(nameEl?.textContent).toBe('Motorista sin nombre');
  });

  it('shows the given name as-is when present', () => {
    const header = buildProfileHeader({ avatarUrl: null, name: 'Marc' });

    const nameEl = header.querySelector('.profile-name');
    expect(nameEl?.textContent).toBe('Marc');
  });

  it('sets data-cy="profile-avatar-editar" and the "avatar" hitbox class on the root avatar button, and invokes onAvatarClick on a real click event', () => {
    const onAvatarClick = vi.fn();
    const header = buildProfileHeader({ avatarUrl: null, name: 'Marc', onAvatarClick });

    const button = header.querySelector<HTMLButtonElement>('[data-cy="profile-avatar-editar"]');
    expect(button).not.toBeNull();
    expect(button?.classList.contains('avatar')).toBe(true);

    button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onAvatarClick).toHaveBeenCalledOnce();
  });

  it('does not throw when the avatar button is clicked without an onAvatarClick callback', () => {
    const header = buildProfileHeader({ avatarUrl: null, name: 'Marc' });
    const button = header.querySelector<HTMLButtonElement>('[data-cy="profile-avatar-editar"]');

    expect(() => {
      button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    }).not.toThrow();
  });
});
