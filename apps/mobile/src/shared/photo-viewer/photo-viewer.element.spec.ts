import { describe, it, expect, vi, afterEach } from 'vitest';
import { openPhotoViewer } from './photo-viewer.element.js';
import type { GalleryPhoto } from '../photo-gallery/photo-gallery.element.js';

afterEach(() => {
  document.body.innerHTML = '';
});

function getViewer(): HTMLElement {
  const el = document.body.querySelector('photo-viewer');
  expect(el).not.toBeNull();
  return el as HTMLElement;
}

const photos: GalleryPhoto[] = [
  { id: 'a', objectUrl: 'a.jpg' },
  { id: 'b', objectUrl: 'b.jpg' },
  { id: 'c', objectUrl: 'c.jpg' },
];

describe('openPhotoViewer', () => {
  it('opens showing the photo at startIndex, with a counter and a close button (AC-015, AC-033)', () => {
    openPhotoViewer({ photos, startIndex: 1 });
    const root = getViewer().shadowRoot!;

    expect(root.querySelector('.img')?.getAttribute('src')).toBe('b.jpg');
    expect(root.querySelector('.counter')?.textContent).toBe('2 de 3');
    const closeBtn = root.querySelector('[data-cy="photo-viewer-close"]');
    expect(closeBtn).not.toBeNull();
    expect(closeBtn?.querySelector('svg')).not.toBeNull();
    expect(closeBtn?.textContent).not.toContain('✕');
  });

  it('closes on close button click, on ESC, and on clicking the overlay background', () => {
    openPhotoViewer({ photos, startIndex: 0 });
    (getViewer().shadowRoot!.querySelector('[data-cy="photo-viewer-close"]') as HTMLButtonElement).click();
    expect(document.body.querySelector('photo-viewer')).toBeNull();

    openPhotoViewer({ photos, startIndex: 0 });
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(document.body.querySelector('photo-viewer')).toBeNull();

    openPhotoViewer({ photos, startIndex: 0 });
    const overlay = getViewer().shadowRoot!.querySelector('.overlay') as HTMLElement;
    overlay.click();
    expect(document.body.querySelector('photo-viewer')).toBeNull();
  });

  it('navigates to the next/previous photo with the nav buttons, wrapping around (AC-015)', () => {
    openPhotoViewer({ photos, startIndex: 2 });
    const root = getViewer().shadowRoot!;

    (root.querySelector('[data-cy="photo-viewer-next"]') as HTMLButtonElement).click();
    expect(root.querySelector('.img')?.getAttribute('src')).toBe('a.jpg');
    expect(root.querySelector('.counter')?.textContent).toBe('1 de 3');

    (root.querySelector('[data-cy="photo-viewer-prev"]') as HTMLButtonElement).click();
    expect(root.querySelector('.img')?.getAttribute('src')).toBe('c.jpg');
  });

  it('navigates with the ArrowLeft/ArrowRight keys', () => {
    openPhotoViewer({ photos, startIndex: 0 });
    const root = getViewer().shadowRoot!;

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    expect(root.querySelector('.img')?.getAttribute('src')).toBe('b.jpg');

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    expect(root.querySelector('.img')?.getAttribute('src')).toBe('a.jpg');
  });

  it('navigates on a horizontal swipe gesture (AC-015)', () => {
    openPhotoViewer({ photos, startIndex: 0 });
    const root = getViewer().shadowRoot!;
    const surface = root.querySelector('.img') as HTMLElement;

    surface.dispatchEvent(new TouchEvent('touchstart', { touches: [{ clientX: 300 } as Touch] }));
    surface.dispatchEvent(new TouchEvent('touchend', { changedTouches: [{ clientX: 100 } as Touch] }));
    expect(root.querySelector('.img')?.getAttribute('src')).toBe('b.jpg'); // swipe izquierda → siguiente

    surface.dispatchEvent(new TouchEvent('touchstart', { touches: [{ clientX: 100 } as Touch] }));
    surface.dispatchEvent(new TouchEvent('touchend', { changedTouches: [{ clientX: 300 } as Touch] }));
    expect(root.querySelector('.img')?.getAttribute('src')).toBe('a.jpg'); // swipe derecha → anterior
  });

  it('does not show nav buttons or counter with a single photo', () => {
    openPhotoViewer({ photos: [photos[0]!], startIndex: 0 });
    const root = getViewer().shadowRoot!;
    expect(root.querySelector('[data-cy="photo-viewer-next"]')).toBeNull();
    expect(root.querySelector('[data-cy="photo-viewer-prev"]')).toBeNull();
    expect(root.querySelector('.counter')).toBeNull();
  });

  it('does not show a delete button when onDelete is not provided', () => {
    openPhotoViewer({ photos, startIndex: 0 });
    expect(getViewer().shadowRoot!.querySelector('[data-cy="photo-viewer-delete"]')).toBeNull();
  });

  it('calls onDelete for the current photo, removes it and moves on when it resolves true (AC-009)', async () => {
    const onDelete = vi.fn().mockResolvedValue(true);
    openPhotoViewer({ photos: [...photos], startIndex: 1, onDelete });
    const root = getViewer().shadowRoot!;
    const deleteBtn = root.querySelector('[data-cy="photo-viewer-delete"]');
    expect(deleteBtn?.querySelector('svg')).not.toBeNull();
    expect(deleteBtn?.textContent).not.toContain('🗑');

    (deleteBtn as HTMLButtonElement).click();
    await Promise.resolve();
    await Promise.resolve();

    expect(onDelete).toHaveBeenCalledWith(photos[1]);
    expect(root.querySelector('.counter')?.textContent).toBe('2 de 2');
  });

  it('closes the viewer when the last remaining photo is deleted', async () => {
    const onDelete = vi.fn().mockResolvedValue(true);
    openPhotoViewer({ photos: [photos[0]!], startIndex: 0, onDelete });

    (getViewer().shadowRoot!.querySelector('[data-cy="photo-viewer-delete"]') as HTMLButtonElement).click();
    await Promise.resolve();
    await Promise.resolve();

    expect(document.body.querySelector('photo-viewer')).toBeNull();
  });

  it('keeps the photo and the viewer open when onDelete resolves false (user cancelled)', async () => {
    const onDelete = vi.fn().mockResolvedValue(false);
    openPhotoViewer({ photos: [...photos], startIndex: 0, onDelete });
    const root = getViewer().shadowRoot!;

    (root.querySelector('[data-cy="photo-viewer-delete"]') as HTMLButtonElement).click();
    await Promise.resolve();
    await Promise.resolve();

    expect(document.body.querySelector('photo-viewer')).not.toBeNull();
    expect(root.querySelector('.counter')?.textContent).toBe('1 de 3');
  });
});
