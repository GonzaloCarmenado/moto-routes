export type ToastVariant = 'success' | 'error';

/**
 * Muestra un toast flotante sobre el documento (no dentro de un Shadow DOM,
 * para que `position: fixed` se posicione respecto al viewport). Se autodestruye
 * pasado `durationMs`.
 */
export function showToast(message: string, variant: ToastVariant): void {
  const toast = document.createElement('div');
  toast.className = 'photo-toast';
  toast.setAttribute('data-cy', variant === 'error' ? 'photo-toast-error' : 'photo-toast');
  toast.textContent = message;
  const color = variant === 'error' ? 'var(--danger, #d64545)' : 'var(--amber, #e8a838)';
  const bg = variant === 'error' ? 'rgba(214, 69, 69, 0.15)' : 'var(--amber-soft, rgba(232, 168, 56, 0.15))';
  const durationMs = variant === 'error' ? 5000 : 3000;
  toast.style.cssText = `
    position: fixed;
    bottom: 100px;
    left: 50%;
    transform: translateX(-50%);
    max-width: 90vw;
    background: ${bg};
    color: ${color};
    padding: 8px 16px;
    border-radius: 8px;
    font-family: var(--font-ui, Barlow, sans-serif);
    font-size: 14px;
    text-align: center;
    z-index: 1000;
    animation: fadeInOut ${String(durationMs / 1000)}s ease forwards;
  `;
  document.body.appendChild(toast);
  setTimeout(() => { toast.remove(); }, durationMs);
}
