import { describe, it, expect, vi, afterEach } from 'vitest';
import { buildExportButton } from './route-detail-export.js';
import type { Session } from '../../shared/models/session.types.js';

const { exportRouteGPXMock } = vi.hoisted(() => ({ exportRouteGPXMock: vi.fn() }));
vi.mock('../../shared/http/route-cloud-api.service.js', () => ({ exportRouteGPX: exportRouteGPXMock }));

const { showToastMock } = vi.hoisted(() => ({ showToastMock: vi.fn() }));
vi.mock('../../shared/feedback/toast.js', () => ({ showToast: showToastMock }));

const { writeFileMock } = vi.hoisted(() => ({ writeFileMock: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@tauri-apps/plugin-fs', () => ({ writeFile: writeFileMock }));

const { saveDialogMock } = vi.hoisted(() => ({
  saveDialogMock: vi.fn().mockResolvedValue('/storage/emulated/0/Download/route-route-1.gpx'),
}));
vi.mock('@tauri-apps/plugin-dialog', () => ({ save: saveDialogMock }));

// Formato de exportación elegido en el menú — 'gpx' por defecto (única opción
// hoy), sobreescribible por test para probar la cancelación del menú.
const { confirmDialogMock } = vi.hoisted(() => ({ confirmDialogMock: vi.fn().mockResolvedValue('gpx') }));
vi.mock('../../shared/feedback/confirm-dialog.element.js', () => ({ confirmDialog: confirmDialogMock }));

const session: Session = { token: 'jwt-token', email: 'rider@example.com' };

function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function setTauri(active: boolean): void {
  if (active) {
    (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {};
  } else {
    delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
  }
}

/** jsdom's Blob polyfill doesn't implement arrayBuffer() — patch it in, mismo criterio que photo-storage.service.spec.ts. */
function makeGpxBlob(): Blob {
  const blob = new Blob(['<gpx></gpx>'], { type: 'application/gpx+xml' });
  if (typeof blob.arrayBuffer !== 'function') {
    Object.defineProperty(blob, 'arrayBuffer', {
      value: (): Promise<ArrayBuffer> => Promise.resolve(new TextEncoder().encode('<gpx></gpx>').buffer),
    });
  }
  return blob;
}

describe('buildExportButton', () => {
  afterEach(() => {
    // clearAllMocks (no restoreAllMocks): mismo criterio que
    // photo-storage.service.spec.ts — restoreAllMocks() también borraría el
    // mockResolvedValue por defecto de saveDialogMock/confirmDialogMock
    // fijado al crearlos (vi.hoisted), no solo el historial de llamadas.
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    setTauri(false);
  });

  it('tiene el data-cy esperado', () => {
    const btn = buildExportButton({ apiBaseUrl: 'http://localhost:8080', session, routeId: 'route-1' });
    expect(btn.getAttribute('data-cy')).toBe('route-detail-btn-exportar-gpx');
  });

  it('al pulsar, abre el menú de formato antes de exportar', async () => {
    exportRouteGPXMock.mockResolvedValue(makeGpxBlob());

    const btn = buildExportButton({ apiBaseUrl: 'http://localhost:8080', session, routeId: 'route-1' });
    btn.click();
    await flushMicrotasks();

    expect(confirmDialogMock).toHaveBeenCalledWith({ title: 'Exportar ruta', actions: [{ id: 'gpx', label: 'GPX', variant: 'primary' }] });
  });

  it('si se cierra el menú de formato sin elegir, no exporta nada', async () => {
    confirmDialogMock.mockResolvedValueOnce(null);

    const btn = buildExportButton({ apiBaseUrl: 'http://localhost:8080', session, routeId: 'route-1' });
    btn.click();
    await flushMicrotasks();

    expect(exportRouteGPXMock).not.toHaveBeenCalled();
    expect(showToastMock).not.toHaveBeenCalled();
  });

  it('al elegir GPX, descarga el fichero y lo comparte con el selector nativo si está disponible', async () => {
    const gpxBlob = new Blob(['<gpx></gpx>'], { type: 'application/gpx+xml' });
    exportRouteGPXMock.mockResolvedValue(gpxBlob);
    const shareMock = vi.fn().mockResolvedValue(undefined);
    const canShareMock = vi.fn().mockReturnValue(true);
    vi.stubGlobal('navigator', { share: shareMock, canShare: canShareMock });

    const btn = buildExportButton({ apiBaseUrl: 'http://localhost:8080', session, routeId: 'route-1' });
    btn.click();
    await flushMicrotasks();

    expect(exportRouteGPXMock).toHaveBeenCalledWith('http://localhost:8080', 'jwt-token', 'route-1');
    expect(shareMock).toHaveBeenCalledTimes(1);
    expect(btn.disabled).toBe(false);
    vi.unstubAllGlobals();
  });

  it('si falla la exportación, muestra un toast de error y no deja el botón deshabilitado', async () => {
    exportRouteGPXMock.mockRejectedValue(new Error('network down'));

    const btn = buildExportButton({ apiBaseUrl: 'http://localhost:8080', session, routeId: 'route-1' });
    btn.click();
    await flushMicrotasks();

    expect(showToastMock).toHaveBeenCalledWith('network down', 'error');
    expect(btn.disabled).toBe(false);
  });

  it('si el usuario cancela el selector nativo (AbortError), no muestra un toast de error', async () => {
    const gpxBlob = new Blob(['<gpx></gpx>'], { type: 'application/gpx+xml' });
    exportRouteGPXMock.mockResolvedValue(gpxBlob);
    const shareMock = vi.fn().mockRejectedValue(new DOMException('cancelled', 'AbortError'));
    const canShareMock = vi.fn().mockReturnValue(true);
    vi.stubGlobal('navigator', { share: shareMock, canShare: canShareMock });

    const btn = buildExportButton({ apiBaseUrl: 'http://localhost:8080', session, routeId: 'route-1' });
    btn.click();
    await flushMicrotasks();

    expect(showToastMock).not.toHaveBeenCalled();
    expect(btn.disabled).toBe(false);
    vi.unstubAllGlobals();
  });

  it('en Tauri, abre el selector nativo "Guardar como" y escribe el GPX en la ruta elegida (ni la Web Share API ni <a download> funcionan en el WebView de Android, ver JSDoc del módulo)', async () => {
    setTauri(true);
    exportRouteGPXMock.mockResolvedValue(makeGpxBlob());

    const btn = buildExportButton({ apiBaseUrl: 'http://localhost:8080', session, routeId: 'route-1' });
    btn.click();
    await flushMicrotasks();

    expect(saveDialogMock).toHaveBeenCalledWith({ defaultPath: 'route-route-1.gpx', filters: [{ name: 'GPX', extensions: ['gpx'] }] });
    expect(writeFileMock).toHaveBeenCalledWith('/storage/emulated/0/Download/route-route-1.gpx', expect.any(Uint8Array));
    expect(showToastMock).toHaveBeenCalledWith('GPX guardado', 'success');
    expect(btn.disabled).toBe(false);
  });

  it('en Tauri, si el usuario cierra el selector nativo sin elegir ruta, no escribe nada ni muestra ningún toast', async () => {
    setTauri(true);
    exportRouteGPXMock.mockResolvedValue(makeGpxBlob());
    saveDialogMock.mockResolvedValueOnce(null);

    const btn = buildExportButton({ apiBaseUrl: 'http://localhost:8080', session, routeId: 'route-1' });
    btn.click();
    await flushMicrotasks();

    expect(writeFileMock).not.toHaveBeenCalled();
    expect(showToastMock).not.toHaveBeenCalled();
    expect(btn.disabled).toBe(false);
  });

  it('en Tauri, si falla la escritura del fichero, muestra un toast de error y no deja el botón deshabilitado', async () => {
    setTauri(true);
    exportRouteGPXMock.mockResolvedValue(makeGpxBlob());
    writeFileMock.mockRejectedValueOnce(new Error('disk full'));

    const btn = buildExportButton({ apiBaseUrl: 'http://localhost:8080', session, routeId: 'route-1' });
    btn.click();
    await flushMicrotasks();

    expect(showToastMock).toHaveBeenCalledWith('disk full', 'error');
    expect(btn.disabled).toBe(false);
  });
});
