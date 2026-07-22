export type ToastVariant = 'success' | 'error';

/**
 * Muestra un toast flotante sobre el documento (montado en document.body para que
 * `position: fixed` se posicione respecto al viewport). Los estilos viven en
 * `src/shared/styles/overlays.css` (clases `.photo-toast--*`). Se autodestruye
 * pasado su tiempo de vida (éxito 3s, error 5s).
 */
export function showToast(message: string, variant: ToastVariant): void {
  const toast = document.createElement('div');
  toast.className = `photo-toast photo-toast--${variant}`;
  toast.setAttribute('data-cy', variant === 'error' ? 'photo-toast-error' : 'photo-toast');
  toast.textContent = message;
  const durationMs = variant === 'error' ? 5000 : 3000;
  document.body.appendChild(toast);
  setTimeout(() => { toast.remove(); }, durationMs);
}
