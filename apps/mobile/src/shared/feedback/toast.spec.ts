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

  it('sets an accessible ARIA role per variant (AC-001): alert for errors, status otherwise', () => {
    showToast('éxito', 'success');
    expect(document.body.querySelector('.photo-toast')?.getAttribute('role')).toBe('status');
    document.body.innerHTML = '';

    showToast('fallo', 'error');
    expect(document.body.querySelector('.photo-toast')?.getAttribute('role')).toBe('alert');
    document.body.innerHTML = '';

    showToast('progreso', 'info');
    expect(document.body.querySelector('.photo-toast')?.getAttribute('role')).toBe('status');
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

  it('appends an info toast with its own data-cy (AC-001)', () => {
    showToast('Descartando ruta…', 'info');

    const toast = document.body.querySelector('.photo-toast');
    expect(toast?.getAttribute('data-cy')).toBe('photo-toast-info');
    expect(toast?.textContent).toBe('Descartando ruta…');
  });

  it('returns a dismiss function that removes the toast immediately, before its own duration elapses', () => {
    vi.useFakeTimers();
    const dismiss = showToast('Guardando…', 'info');
    expect(document.body.querySelector('.photo-toast')).not.toBeNull();

    dismiss();
    expect(document.body.querySelector('.photo-toast')).toBeNull();

    // Y no revive al llegar el timeout original (el timer se canceló)
    vi.advanceTimersByTime(10000);
    expect(document.body.querySelector('.photo-toast')).toBeNull();
  });
});
