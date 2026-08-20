/**
 * Botón "Exportar" de `<route-detail>`, junto a "Compartir": abre un menú de
 * formato (reutiliza `confirmDialog`, ver confirm-dialog.element.ts — solo
 * "GPX" hoy, preparado para más formatos sin rediseñar el botón) y descarga
 * el fichero generado por el servidor (`route-cloud-api.service.ts`) para
 * guardarlo en el dispositivo. Extraído de route-detail-header.ts, mismo
 * patrón que route-detail-share.ts.
 *
 * En Tauri (Android) usa `@tauri-apps/plugin-dialog` (selector nativo
 * "Guardar como") + `@tauri-apps/plugin-fs` para escribir en la ruta elegida
 * por el usuario — verificado en dispositivo real, en dos pasos: (1) ni la
 * Web Share API (`navigator.share`/`canShare`, ambas `undefined` en el
 * WebView de Android de Tauri) ni la descarga de blob vía `<a download>` (el
 * WebView no tiene gestor de descargas registrado) funcionan ahí, así que se
 * mantienen solo como fallback fuera de Tauri (usado también por el E2E de
 * Cypress, que corre contra el Chromium de un navegador real, no el WebView
 * de Tauri); (2) escribir directamente en `downloadDir()` sí funciona sin
 * error, pero Android lo resuelve a la carpeta *privada* de la app
 * (`Android/data/com.motoroutes.app/files/Download/`), invisible para un
 * gestor de archivos normal — el selector "Guardar como" (Storage Access
 * Framework) es la única vía fiable a la carpeta Descargas pública real.
 */
import type { Session } from '../../shared/models/session.types.js';
import { EXPORT_ICON } from '../../shared/icons/action-icons.js';
import { confirmDialog } from '../../shared/feedback/confirm-dialog.element.js';
import { showToast } from '../../shared/feedback/toast.js';
import { toErrorMessage } from '../../shared/utils/errors.js';
import { exportRouteGPX } from '../../shared/http/route-cloud-api.service.js';
import { isTauri } from '../../shared/services/photo-capture-adapter.service.js';

export interface ExportButtonOptions {
  apiBaseUrl: string;
  session: Session;
  routeId: string;
}

/** El llamador solo debe construir este botón con sesión activa y una ruta
 * que ya exista en el servidor (misma condición que "Compartir", ver
 * route-detail-header.ts) — el endpoint de exportación es server-side. */
export function buildExportButton(options: ExportButtonOptions): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'sync-icon-btn';
  btn.setAttribute('data-cy', 'route-detail-btn-exportar-gpx');
  btn.setAttribute('aria-label', 'Exportar ruta');
  btn.innerHTML = EXPORT_ICON;
  btn.addEventListener('click', () => {
    void openFormatMenu(options, btn);
  });
  return btn;
}

/** Menú de formato de exportación — solo GPX por ahora; añadir otro formato
 * es solo una acción más en este array, sin tocar el botón ni su gesto. */
async function openFormatMenu(options: ExportButtonOptions, btn: HTMLButtonElement): Promise<void> {
  const format = await confirmDialog({
    title: 'Exportar ruta',
    actions: [{ id: 'gpx', label: 'GPX', variant: 'primary' }],
  });
  if (format !== 'gpx') return; // cerrado sin elegir — no es un error
  await handleExport(options, btn);
}

async function handleExport(options: ExportButtonOptions, btn: HTMLButtonElement): Promise<void> {
  btn.disabled = true;
  try {
    const blob = await exportRouteGPX(options.apiBaseUrl, options.session.token, options.routeId);
    const fileName = `route-${options.routeId}.gpx`;
    if (isTauri()) {
      const saved = await saveGpxWithNativeDialog(blob, fileName);
      if (saved) showToast('GPX guardado', 'success');
      return; // cancelar el selector no es un error — sin toast en ese caso
    }
    const file = new File([blob], fileName, { type: 'application/gpx+xml' });
    await shareOrDownload(file);
  } catch (err) {
    showToast(toErrorMessage(err, 'Error al exportar la ruta'), 'error');
  } finally {
    btn.disabled = false;
  }
}

/** Abre el selector nativo "Guardar como" de Android (Storage Access
 * Framework) y escribe el GPX en la ruta elegida — la única vía fiable a la
 * carpeta Descargas pública real (ver JSDoc del módulo). Devuelve `false`
 * sin escribir nada si el usuario cierra el selector sin elegir ruta. */
async function saveGpxWithNativeDialog(blob: Blob, fileName: string): Promise<boolean> {
  const { save } = await import('@tauri-apps/plugin-dialog');
  const { writeFile } = await import('@tauri-apps/plugin-fs');

  const path = await save({ defaultPath: fileName, filters: [{ name: 'GPX', extensions: ['gpx'] }] });
  if (!path) return false;

  const buffer = await blob.arrayBuffer();
  await writeFile(path, new Uint8Array(buffer));
  return true;
}

/** Comparte el fichero con el selector nativo (Web Share API) si el WebView
 * lo soporta; si no, cae a una descarga de blob normal. Cancelar el selector
 * nativo (AbortError) no se trata como fallo. El tipado de lib.dom asume
 * `navigator.share`/`canShare` siempre presentes — en runtime no lo están
 * fuera de un WebView compatible, de ahí la comprobación explícita pese al
 * tipo no-opcional. */
async function shareOrDownload(file: File): Promise<void> {
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      throw err;
    }
    return;
  }

  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.name;
  // Adjuntar al DOM antes de click() — algunos navegadores (incluido el
  // Electron headless que usa Cypress) no disparan la descarga de un <a>
  // desconectado del documento.
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
