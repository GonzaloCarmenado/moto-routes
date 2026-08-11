/**
 * @packageDocumentation
 * Toast flotante de feedback (éxito/error/info) montado en document.body.
 */
import { TOAST_SUCCESS_ICON, TOAST_ERROR_ICON } from '../icons/toast-icons.js';

/** Variante de toast: éxito, error o info (progreso). */
export type ToastVariant = 'success' | 'error' | 'info';

const DATA_CY_BY_VARIANT: Record<ToastVariant, string> = {
  success: 'photo-toast',
  error: 'photo-toast-error',
  info: 'photo-toast-info',
};

// Los lectores de pantalla anuncian role="alert" de inmediato (apto para
// errores) y role="status" de forma más discreta (éxito/progreso).
const ARIA_ROLE_BY_VARIANT: Record<ToastVariant, 'status' | 'alert'> = {
  success: 'status',
  error: 'alert',
  info: 'status',
};

// info se usa como indicador de progreso ("Guardando…") mientras dura una
// operación async — dura más que un aviso normal como red de seguridad, pero
// el llamador debe descartarlo explícitamente con el dismiss() devuelto en
// cuanto la operación termine, sin esperar a este plazo.
const DURATION_MS_BY_VARIANT: Record<ToastVariant, number> = {
  success: 3000,
  error: 5000,
  info: 10000,
};

// info (progreso) no lleva icono — sin cambio de comportamiento respecto a antes.
const ICON_BY_VARIANT: Partial<Record<ToastVariant, string>> = {
  success: TOAST_SUCCESS_ICON,
  error: TOAST_ERROR_ICON,
};

/**
 * Muestra un toast flotante sobre el documento (montado en document.body para que
 * `position: fixed` se posicione respecto al viewport). Los estilos viven en
 * `src/shared/styles/overlays.css` (clases `.photo-toast--*`). Se autodestruye
 * pasado su tiempo de vida, o antes si se llama a la función `dismiss` devuelta.
 */
export function showToast(message: string, variant: ToastVariant): () => void {
  const toast = document.createElement('div');
  toast.className = `photo-toast photo-toast--${variant}`;
  toast.setAttribute('data-cy', DATA_CY_BY_VARIANT[variant]);
  toast.setAttribute('role', ARIA_ROLE_BY_VARIANT[variant]);

  const icon = ICON_BY_VARIANT[variant];
  if (icon) {
    const iconSpan = document.createElement('span');
    iconSpan.className = 'photo-toast__icon';
    iconSpan.innerHTML = icon;
    toast.appendChild(iconSpan);
  }
  const messageSpan = document.createElement('span');
  messageSpan.className = 'photo-toast__message';
  messageSpan.textContent = message;
  toast.appendChild(messageSpan);

  document.body.appendChild(toast);

  const timer = setTimeout(() => { toast.remove(); }, DURATION_MS_BY_VARIANT[variant]);
  return (): void => {
    clearTimeout(timer);
    toast.remove();
  };
}
