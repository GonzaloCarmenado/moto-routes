import { describe, it, expect, vi } from 'vitest';
import { isFullscreenSupported, isElementFullscreen } from './route-map-fullscreen.js';

describe('isFullscreenSupported (AC-020)', () => {
  it('returns true when document.fullscreenEnabled is true and the container exposes requestFullscreen', () => {
    const container = document.createElement('div');
    container.requestFullscreen = vi.fn();
    Object.defineProperty(document, 'fullscreenEnabled', { value: true, configurable: true });

    expect(isFullscreenSupported(container)).toBe(true);
  });

  it('returns false when document.fullscreenEnabled is false, even if the container exposes requestFullscreen', () => {
    const container = document.createElement('div');
    container.requestFullscreen = vi.fn();
    Object.defineProperty(document, 'fullscreenEnabled', { value: false, configurable: true });

    expect(isFullscreenSupported(container)).toBe(false);
  });

  it('returns false when the container does not expose requestFullscreen, even if document.fullscreenEnabled is true', () => {
    const container = document.createElement('div');
    delete (container as { requestFullscreen?: unknown }).requestFullscreen;
    Object.defineProperty(document, 'fullscreenEnabled', { value: true, configurable: true });

    expect(isFullscreenSupported(container)).toBe(false);
  });
});

describe('isElementFullscreen (AC-018, AC-019)', () => {
  it('returns true when document.fullscreenElement is the given container', () => {
    const container = document.createElement('div');
    Object.defineProperty(document, 'fullscreenElement', { value: container, configurable: true });

    expect(isElementFullscreen(container)).toBe(true);
  });

  it('returns false when document.fullscreenElement is a different element', () => {
    const container = document.createElement('div');
    const other = document.createElement('div');
    Object.defineProperty(document, 'fullscreenElement', { value: other, configurable: true });

    expect(isElementFullscreen(container)).toBe(false);
  });

  it('returns false when document.fullscreenElement is null', () => {
    const container = document.createElement('div');
    Object.defineProperty(document, 'fullscreenElement', { value: null, configurable: true });

    expect(isElementFullscreen(container)).toBe(false);
  });
});
