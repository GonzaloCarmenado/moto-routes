import { describe, it, expect, vi, afterEach } from 'vitest';
import { showToast } from './toast.js';

afterEach(() => {
  document.body.innerHTML = '';
  vi.useRealTimers();
});

describe('showToast', () => {
  it('appends a success toast with the expected message, class and data-cy', () => {
    showToast('📷 Foto añadida', 'success');

    const toast = document.body.querySelector('.photo-toast');
    expect(toast).not.toBeNull();
    expect(toast?.getAttribute('data-cy')).toBe('photo-toast');
    expect(toast?.textContent).toBe('📷 Foto añadida');
  });

  it('appends an error toast with the error data-cy', () => {
    showToast('⚠️ No se pudo guardar la foto', 'error');

    const toast = document.body.querySelector('.photo-toast');
    expect(toast?.getAttribute('data-cy')).toBe('photo-toast-error');
    expect(toast?.textContent).toBe('⚠️ No se pudo guardar la foto');
  });

  it('removes the success toast after its duration elapses', () => {
    vi.useFakeTimers();
    showToast('ok', 'success');
    expect(document.body.querySelector('.photo-toast')).not.toBeNull();

    vi.advanceTimersByTime(3000);
    expect(document.body.querySelector('.photo-toast')).toBeNull();
  });

  it('keeps the error toast visible longer than the success toast', () => {
    vi.useFakeTimers();
    showToast('error', 'error');

    vi.advanceTimersByTime(3000);
    expect(document.body.querySelector('.photo-toast')).not.toBeNull();

    vi.advanceTimersByTime(2000);
    expect(document.body.querySelector('.photo-toast')).toBeNull();
  });
});
