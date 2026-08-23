import { describe, it, expect, afterEach, vi } from 'vitest';
import { showRouteUploadSnackbar } from './route-upload-snackbar.js';

describe('showRouteUploadSnackbar', () => {
  afterEach(() => {
    document.querySelectorAll('[data-cy="route-upload-snackbar"]').forEach((el) => { el.remove(); });
    vi.useRealTimers();
  });

  it('mounts with the progress message', () => {
    showRouteUploadSnackbar('Subiendo ruta…');

    const el = document.querySelector('[data-cy="route-upload-snackbar"]');
    expect(el).not.toBeNull();
    expect(el?.textContent).toContain('Subiendo ruta…');
    expect(el?.className).toContain('route-upload-snackbar--progress');
  });

  it('succeed() switches the text and state to success', () => {
    const handle = showRouteUploadSnackbar('Subiendo ruta…');

    handle.succeed();

    const el = document.querySelector('[data-cy="route-upload-snackbar"]');
    expect(el?.textContent).toContain('Ruta subida');
    expect(el?.className).toContain('route-upload-snackbar--success');
  });

  it('fail(message) switches the text and state to error', () => {
    const handle = showRouteUploadSnackbar('Subiendo ruta…');

    handle.fail('Sin conexión');

    const el = document.querySelector('[data-cy="route-upload-snackbar"]');
    expect(el?.textContent).toContain('Sin conexión');
    expect(el?.className).toContain('route-upload-snackbar--error');
  });

  it('auto-dismisses after succeed()', () => {
    vi.useFakeTimers();
    const handle = showRouteUploadSnackbar('Subiendo ruta…');

    handle.succeed();
    vi.advanceTimersByTime(10000);

    expect(document.querySelector('[data-cy="route-upload-snackbar"]')).toBeNull();
  });

  it('auto-dismisses after fail()', () => {
    vi.useFakeTimers();
    const handle = showRouteUploadSnackbar('Subiendo ruta…');

    handle.fail('Error');
    vi.advanceTimersByTime(10000);

    expect(document.querySelector('[data-cy="route-upload-snackbar"]')).toBeNull();
  });

  it('does not auto-dismiss while still in progress', () => {
    vi.useFakeTimers();
    showRouteUploadSnackbar('Subiendo ruta…');

    vi.advanceTimersByTime(60000);

    expect(document.querySelector('[data-cy="route-upload-snackbar"]')).not.toBeNull();
  });
});
