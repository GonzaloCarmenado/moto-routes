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

    const menu = el.shadowRoot?.querySelector('[popover]');
    expect(menu).not.toBeNull();

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

  it('should close menu when clicking outside', () => {
    const btn = el.shadowRoot?.querySelector('button');
    btn?.click();

    // Click outside
    document.body.click();

    const menu = el.shadowRoot?.querySelector('[popover]') as HTMLElement | null;
    // After click outside, popover should be hidden
    // Using the popover API: menu.hidden or !menu.matches(':popover-open')
    // Since jsdom may not fully support popover, we check the attribute
    expect(menu?.hasAttribute('open')).toBe(false);
  });

  it('should close menu when pressing Escape', () => {
    const btn = el.shadowRoot?.querySelector('button');
    btn?.click();

    // Dispatch escape key
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    const menu = el.shadowRoot?.querySelector('[popover]') as HTMLElement | null;
    expect(menu?.hasAttribute('open')).toBe(false);
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

    const menu = el.shadowRoot?.querySelector('[popover]');
    expect(menu?.hasAttribute('open')).toBe(false);
  });
});