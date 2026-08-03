import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PHOTO_CAPTURE_EVENT, type PhotoCaptureEventDetail } from './photo-capture.types.js';

// Register the component before each test
import './photo-capture.element.js';

describe('<photo-capture>', () => {
  let el: HTMLElement;

  beforeEach(() => {
    el = document.createElement('photo-capture');
    document.body.appendChild(el);
  });

  afterEach(() => {
    el.remove();
  });

  it('should render a button with minimum 56px hitbox CSS variables', () => {
    const btn = el.shadowRoot?.querySelector('button');
    expect(btn).not.toBeNull();
    expect(btn!.classList.contains('photo-btn')).toBe(true);
    // La hitbox mínima se garantiza via CSS (min-width/min-height: var(--hitbox-min, 56px))
    // Test E2E verifica visualmente que cumple 56×56px
  });

  it('should show menu with camera and gallery options when button is clicked', () => {
    const btn = el.shadowRoot?.querySelector('button');
    btn?.click();

    const menu = el.shadowRoot?.querySelector('.photo-menu');
    expect(menu).not.toBeNull();
    expect(menu!.classList.contains('menu-open')).toBe(true);

    const items = menu?.querySelectorAll('[data-cy="photo-menu-camera"], [data-cy="photo-menu-gallery"]');
    expect(items?.length).toBe(2);
  });

  it('should emit photo-capture:select event with source camera when camera is selected', () => {
    const handler = vi.fn();
    el.addEventListener(PHOTO_CAPTURE_EVENT, handler as EventListener);

    const btn = el.shadowRoot?.querySelector('button');
    btn?.click();

    const cameraItem = el.shadowRoot?.querySelector('[data-cy="photo-menu-camera"]') as HTMLElement;
    cameraItem?.click();

    expect(handler).toHaveBeenCalledTimes(1);
    const event = handler.mock.calls[0]?.[0] as CustomEvent<PhotoCaptureEventDetail>;
    expect(event.detail.source).toBe('camera');
  });

  it('should emit photo-capture:select event with source gallery when gallery is selected', () => {
    const handler = vi.fn();
    el.addEventListener(PHOTO_CAPTURE_EVENT, handler as EventListener);

    const btn = el.shadowRoot?.querySelector('button');
    btn?.click();

    const galleryItem = el.shadowRoot?.querySelector('[data-cy="photo-menu-gallery"]') as HTMLElement;
    galleryItem?.click();

    expect(handler).toHaveBeenCalledTimes(1);
    const event = handler.mock.calls[0]?.[0] as CustomEvent<PhotoCaptureEventDetail>;
    expect(event.detail.source).toBe('gallery');
  });

  it('should keep menu open when clicking outside (manual popover)', () => {
    const btn = el.shadowRoot?.querySelector('button');
    btn?.click();

    // Click outside — menu should stay open (only closes on Escape or selection)
    document.body.click();

    const menu = el.shadowRoot?.querySelector('.photo-menu') as HTMLElement | null;
    expect(menu?.classList.contains('menu-open')).toBe(true);
  });

  it('should close menu when pressing Escape', () => {
    const btn = el.shadowRoot?.querySelector('button');
    btn?.click();

    // Dispatch escape key
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    const menu = el.shadowRoot?.querySelector('.photo-menu') as HTMLElement | null;
    expect(menu?.classList.contains('menu-open')).toBe(false);
  });

  it('should accept disabled property and disable the button', async () => {
    el.setAttribute('disabled', '');
    // Wait for attributeChangedCallback
    await new Promise((r) => setTimeout(r, 0));

    const btn = el.shadowRoot?.querySelector('button') as HTMLButtonElement | null;
    expect(btn?.disabled).toBe(true);
  });

  it('should not show menu when disabled and button is clicked', () => {
    el.setAttribute('disabled', '');
    const btn = el.shadowRoot?.querySelector('button') as HTMLButtonElement | null;

    // Click should not open menu since button is disabled
    btn?.click();

    const menu = el.shadowRoot?.querySelector('.photo-menu');
    expect(menu?.classList.contains('menu-open')).toBe(false);
  });

  it('should accept loading property and disable the button with a spinner while loading', async () => {
    el.setAttribute('loading', '');
    await new Promise((r) => setTimeout(r, 0));

    const btn = el.shadowRoot?.querySelector('button') as HTMLButtonElement | null;
    expect(btn?.disabled).toBe(true);
    expect(btn?.classList.contains('is-loading')).toBe(true);
    expect(btn?.getAttribute('aria-busy')).toBe('true');
  });

  it('should not show menu when loading and button is clicked', () => {
    el.setAttribute('loading', '');
    const btn = el.shadowRoot?.querySelector('button') as HTMLButtonElement | null;

    btn?.click();

    const menu = el.shadowRoot?.querySelector('.photo-menu');
    expect(menu?.classList.contains('menu-open')).toBe(false);
  });

  it('should close an already-open menu as soon as loading starts', () => {
    const btn = el.shadowRoot?.querySelector('button') as HTMLButtonElement | null;
    btn?.click();
    expect(el.shadowRoot?.querySelector('.photo-menu')?.classList.contains('menu-open')).toBe(true);

    el.setAttribute('loading', '');

    expect(el.shadowRoot?.querySelector('.photo-menu')?.classList.contains('menu-open')).toBe(false);
  });

  it('should re-enable the button once loading finishes', async () => {
    el.setAttribute('loading', '');
    await new Promise((r) => setTimeout(r, 0));
    el.removeAttribute('loading');
    await new Promise((r) => setTimeout(r, 0));

    const btn = el.shadowRoot?.querySelector('button') as HTMLButtonElement | null;
    expect(btn?.disabled).toBe(false);
    expect(btn?.classList.contains('is-loading')).toBe(false);
  });

  it('should default to limitReached false with the standard "Añadir foto" label', () => {
    const el2 = el as HTMLElement & { limitReached: boolean };
    expect(el2.limitReached).toBe(false);

    const btn = el.shadowRoot?.querySelector('button') as HTMLButtonElement | null;
    expect(btn?.getAttribute('aria-label')).toBe('Añadir foto');
  });

  it('should switch the accessible label when limitReached is set to true (without disabled)', async () => {
    const el2 = el as HTMLElement & { limitReached: boolean };
    el2.limitReached = true;
    await new Promise((r) => setTimeout(r, 0));

    const btn = el.shadowRoot?.querySelector('button') as HTMLButtonElement | null;
    expect(btn?.getAttribute('aria-label')).toBe('Límite de fotos alcanzado');
    expect(btn?.getAttribute('title')).toBe('Límite de fotos alcanzado');
  });

  it('should keep the standard label when only loading is set (not limitReached)', async () => {
    el.setAttribute('loading', '');
    await new Promise((r) => setTimeout(r, 0));

    const btn = el.shadowRoot?.querySelector('button') as HTMLButtonElement | null;
    expect(btn?.getAttribute('aria-label')).toBe('Añadir foto');
  });

  it('should reflect limitReached as the limit-reached DOM attribute', () => {
    const el2 = el as HTMLElement & { limitReached: boolean };
    el2.limitReached = true;
    expect(el.hasAttribute('limit-reached')).toBe(true);

    el2.limitReached = false;
    expect(el.hasAttribute('limit-reached')).toBe(false);
  });

  it('should show the limit label on initial render when limitReached is set before insertion into the DOM', () => {
    const freshEl = document.createElement('photo-capture') as HTMLElement & { limitReached: boolean };
    freshEl.limitReached = true;
    document.body.appendChild(freshEl);

    const btn = freshEl.shadowRoot?.querySelector('button') as HTMLButtonElement | null;
    expect(btn?.getAttribute('aria-label')).toBe('Límite de fotos alcanzado');

    freshEl.remove();
  });
});
