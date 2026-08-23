/**
 * @packageDocumentation
 * Snackbar de progreso de la subida automática de una ruta, montado en
 * document.body en la parte superior de la app (estilo "subiendo historia"
 * de Instagram) — a diferencia de `toast.ts`, el mismo elemento cambia de
 * estado (progreso → éxito/error) sin desaparecer y volver a aparecer.
 * Estilos en `shared/styles/overlays.css` (clases `.route-upload-snackbar--*`).
 */
import { TOAST_SUCCESS_ICON, TOAST_ERROR_ICON } from '../icons/toast-icons.js';

/** Tiempo que el snackbar permanece visible tras resolverse (éxito o error), antes de autodescartarse. */
const RESOLVED_DISPLAY_MS = 4000;

/** Handle devuelto al mostrar el snackbar, para transicionarlo a su estado final. */
export interface RouteUploadSnackbarHandle {
  /** Transiciona el snackbar a "subida completada" y lo autodescarta poco después. */
  succeed: () => void;
  /** Transiciona el snackbar a estado de error con `message` y lo autodescarta poco después. */
  fail: (message: string) => void;
}

/**
 * Muestra el snackbar con `message` (estado de progreso) y lo mantiene
 * visible hasta que el llamador invoque `succeed()` o `fail()` en el handle
 * devuelto — nunca se autodescarta mientras sigue en progreso.
 */
export function showRouteUploadSnackbar(message: string): RouteUploadSnackbarHandle {
  const el = document.createElement('div');
  el.className = 'route-upload-snackbar route-upload-snackbar--progress';
  el.setAttribute('data-cy', 'route-upload-snackbar');
  el.setAttribute('role', 'status');

  const messageSpan = document.createElement('span');
  messageSpan.className = 'route-upload-snackbar__message';
  messageSpan.textContent = message;
  el.appendChild(messageSpan);

  document.body.appendChild(el);

  function resolve(variant: 'success' | 'error', text: string, icon: string): void {
    el.className = `route-upload-snackbar route-upload-snackbar--${variant}`;
    el.setAttribute('role', variant === 'error' ? 'alert' : 'status');
    el.innerHTML = '';
    const iconSpan = document.createElement('span');
    iconSpan.className = 'route-upload-snackbar__icon';
    iconSpan.innerHTML = icon;
    el.appendChild(iconSpan);
    const textSpan = document.createElement('span');
    textSpan.className = 'route-upload-snackbar__message';
    textSpan.textContent = text;
    el.appendChild(textSpan);

    setTimeout(() => { el.remove(); }, RESOLVED_DISPLAY_MS);
  }

  return {
    succeed: (): void => { resolve('success', 'Ruta subida', TOAST_SUCCESS_ICON); },
    fail: (message: string): void => { resolve('error', message, TOAST_ERROR_ICON); },
  };
}
