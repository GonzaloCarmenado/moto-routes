import { describe, it, expect, afterEach } from 'vitest';
import './photo-gallery.element.js';
import { PHOTO_GALLERY_SELECT_EVENT, type PhotoGallerySelectDetail, type GalleryPhoto } from './photo-gallery.element.js';

type GalleryEl = HTMLElement & { photos: GalleryPhoto[]; layout: 'strip' | 'grid' };

afterEach(() => {
  document.body.innerHTML = '';
});

function mount(): GalleryEl {
  const el = document.createElement('photo-gallery') as GalleryEl;
  document.body.appendChild(el);
  return el;
}

describe('photo-gallery', () => {
  it('shows the "Sin fotos" placeholder when there are no photos (AC-012, AC-021)', () => {
    const el = mount();
    const root = el.shadowRoot!;
    expect(root.querySelector('[data-cy="photo-placeholder"]')?.textContent).toBe('Sin fotos');
    expect(root.querySelector('[data-cy="photo-gallery"]')).toBeNull();
  });

  it('renders one thumbnail per photo, in the given order (AC-012, AC-019)', () => {
    const el = mount();
    el.photos = [
      { id: 'a', objectUrl: 'a.jpg' },
      { id: 'b', objectUrl: 'b.jpg' },
      { id: 'c', objectUrl: 'c.jpg' },
    ];

    const root = el.shadowRoot!;
    const thumbs = root.querySelectorAll('[data-cy="photo-thumbnail"]');
    expect(thumbs).toHaveLength(3);
    expect(root.querySelector('[data-cy="photo-placeholder"]')).toBeNull();

    const imgs = root.querySelectorAll('img');
    expect(imgs[0]?.getAttribute('src')).toBe('a.jpg');
    expect(imgs[1]?.getAttribute('src')).toBe('b.jpg');
    expect(imgs[2]?.getAttribute('src')).toBe('c.jpg');
  });

  it('emits a select event with the clicked index when a thumbnail is clicked (AC-012)', () => {
    const el = mount();
    el.photos = [{ id: 'a', objectUrl: 'a.jpg' }, { id: 'b', objectUrl: 'b.jpg' }];

    let received: PhotoGallerySelectDetail | null = null;
    el.addEventListener(PHOTO_GALLERY_SELECT_EVENT, ((event: CustomEvent<PhotoGallerySelectDetail>) => {
      received = event.detail;
    }) as EventListener);

    const thumbs = el.shadowRoot!.querySelectorAll<HTMLElement>('[data-cy="photo-thumbnail"]');
    thumbs[1]!.click();

    expect(received).toEqual({ index: 1 });
  });

  it('re-renders when the photos property is reassigned (used to refresh after adding/removing a photo)', () => {
    const el = mount();
    el.photos = [{ id: 'a', objectUrl: 'a.jpg' }];
    expect(el.shadowRoot!.querySelectorAll('[data-cy="photo-thumbnail"]')).toHaveLength(1);

    el.photos = [];
    expect(el.shadowRoot!.querySelectorAll('[data-cy="photo-thumbnail"]')).toHaveLength(0);
    expect(el.shadowRoot!.querySelector('[data-cy="photo-placeholder"]')).not.toBeNull();
  });

  describe('layout property (AC-009, AC-010, AC-028)', () => {
    it('keeps the existing horizontal strip container class by default, when layout is left unset (regression for <cockpit-view>)', () => {
      const el = mount();
      el.photos = [{ id: 'a', objectUrl: 'a.jpg' }];

      const container = el.shadowRoot!.querySelector('[data-cy="photo-gallery"]')!;
      expect(container.classList.contains('photo-gallery--grid')).toBe(false);
    });

    it('adds the grid modifier class to the container instead of the strip one when layout is set to "grid"', () => {
      const el = mount();
      el.layout = 'grid';
      el.photos = [{ id: 'a', objectUrl: 'a.jpg' }];

      const container = el.shadowRoot!.querySelector('[data-cy="photo-gallery"]')!;
      expect(container.classList.contains('photo-gallery--grid')).toBe(true);
    });

    it('still emits photo-gallery:select with the clicked index when layout is "grid" (same contract as strip)', () => {
      const el = mount();
      el.layout = 'grid';
      el.photos = [{ id: 'a', objectUrl: 'a.jpg' }, { id: 'b', objectUrl: 'b.jpg' }];

      let received: PhotoGallerySelectDetail | null = null;
      el.addEventListener(PHOTO_GALLERY_SELECT_EVENT, ((event: CustomEvent<PhotoGallerySelectDetail>) => {
        received = event.detail;
      }) as EventListener);

      const thumbs = el.shadowRoot!.querySelectorAll<HTMLElement>('[data-cy="photo-thumbnail"]');
      thumbs[1]!.click();

      expect(received).toEqual({ index: 1 });
    });

    it('shows the same "Sin fotos" empty state regardless of layout ("grid")', () => {
      const el = mount();
      el.layout = 'grid';

      const root = el.shadowRoot!;
      expect(root.querySelector('[data-cy="photo-placeholder"]')?.textContent).toBe('Sin fotos');
      expect(root.querySelector('[data-cy="photo-gallery"]')).toBeNull();
    });
  });
});
