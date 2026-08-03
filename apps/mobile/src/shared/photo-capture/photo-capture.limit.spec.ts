import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { applyPhotoCaptureLimit } from './photo-capture.limit.js';
import type { PhotoCaptureElement } from './photo-capture.element.js';

// Register the component before each test
import './photo-capture.element.js';

describe('applyPhotoCaptureLimit', () => {
  let el: PhotoCaptureElement;

  beforeEach(() => {
    el = document.createElement('photo-capture') as PhotoCaptureElement;
    document.body.appendChild(el);
  });

  afterEach(() => {
    el.remove();
  });

  it('leaves the button enabled and limitReached false below the limit', () => {
    applyPhotoCaptureLimit(el, 99);

    expect(el.disabled).toBe(false);
    expect(el.limitReached).toBe(false);
  });

  it('disables the button and sets limitReached true exactly at the limit', () => {
    applyPhotoCaptureLimit(el, 100);

    expect(el.disabled).toBe(true);
    expect(el.limitReached).toBe(true);
  });

  it('disables the button and sets limitReached true above the limit (defensive)', () => {
    applyPhotoCaptureLimit(el, 150);

    expect(el.disabled).toBe(true);
    expect(el.limitReached).toBe(true);
  });

  it('is a no-op when the element is null', () => {
    expect(() => {
      applyPhotoCaptureLimit(null, 100);
    }).not.toThrow();
  });
});
