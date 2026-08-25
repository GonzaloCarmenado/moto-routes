/**
 * Monta `<update-banner>` y refleja en él el resultado de `checkForUpdate()` —
 * extraído de `app.element.ts` para mantener su `render()`/`init()` bajo el
 * límite de sentencias/líneas del proyecto, sin sufijo `.element` (excepción
 * de extracción por límite de líneas ya documentada en `CLAUDE.md`), mismo
 * criterio que `app-route-upload.ts`/`app-username-gate.ts`.
 */
import '../update/update-banner.element.js';
import type { UpdateBannerElement } from '../update/update-banner.element.js';
import { checkForUpdate } from '../update/update-check.service.js';
import { notifyUpdateAvailable } from '../update/update-notification.service.js';
import { downloadUpdate } from '../update/update-download.service.js';
import { installUpdate, canInstallUpdatePackages, requestInstallUpdatePermission } from '../shared/tauri/commands.js';
import { toErrorMessage } from '../shared/utils/errors.js';

/** Elemento `<update-banner>` ya montado, junto con la función para dejar de escuchar sus eventos (ver `listenForUpdateEvents`). */
export interface MountedUpdateBanner {
  element: HTMLElement;
  unlisten: () => void;
}

/**
 * Crea `<update-banner>`, lo añade a `host` y engancha sus eventos —
 * combinado en una sola llamada para que `app.element.ts::render()` no
 * necesite más de una sentencia (límite del proyecto), un único campo en vez
 * de dos.
 */
export function mountUpdateBanner(host: HTMLElement): MountedUpdateBanner {
  const element = document.createElement('update-banner');
  host.appendChild(element);
  return { element, unlisten: listenForUpdateEvents(element) };
}

/**
 * Comprueba si hay actualización disponible, la refleja en `banner` y, si la
 * hay, dispara la notificación local (deduplicada por versión). Best-effort:
 * ni `checkForUpdate()` ni `notifyUpdateAvailable()` lanzan nunca.
 */
export function checkForUpdateAndReflect(banner: HTMLElement): void {
  void checkForUpdate().then((result) => {
    (banner as UpdateBannerElement).result = result;
    if (result.hasUpdate && result.latestVersion) void notifyUpdateAvailable(result.latestVersion);
  });
}

/** Ruta del último APK descargado con éxito — estado a nivel de módulo, mismo
 * criterio ya usado en `achievement-unlock-overlay.ts` (`queue`/`activeElement`):
 * solo existe una instancia real de `<update-banner>` en toda la app. */
let downloadedApkPath: string | null = null;

/**
 * Descarga el APK de `downloadUrl`, reflejando el progreso en `banner` y
 * dejándolo listo para instalar (o en error, reintentable) al terminar.
 */
export function handleUpdateDownloadRequested(banner: HTMLElement, downloadUrl: string): void {
  const el = banner as UpdateBannerElement;
  void downloadUpdate({
    downloadUrl,
    onProgress: (progress) => {
      el.setDownloading(progress);
    },
  })
    .then((path) => {
      downloadedApkPath = path;
      el.setReadyToInstall();
    })
    .catch((err: unknown) => {
      el.setDownloadError(toErrorMessage(err, 'No se pudo descargar la actualización'));
    });
}

/**
 * Lanza el instalador nativo sobre el último APK descargado. Si el permiso de
 * instalar APKs externos no está concedido, dirige a Ajustes en su lugar (ver
 * `install-update.rs`/`InstallUpdatePlugin.kt`) — el usuario puede volver a
 * pulsar "Instalar" tras concederlo, sin volver a descargar nada. Best-effort:
 * `Intent.ACTION_VIEW` no informa si la instalación termina con éxito, se
 * cancela o falla (ver JSDoc de `UpdateBannerPhase`), así que no hay más
 * estado que reflejar aquí tras lanzarlo.
 */
export async function handleUpdateInstallRequested(): Promise<void> {
  if (!downloadedApkPath) return;

  const canInstall = await canInstallUpdatePackages();
  if (!canInstall) {
    await requestInstallUpdatePermission();
    return;
  }

  try {
    await installUpdate(downloadedApkPath);
  } catch {
    // Best-effort — ver JSDoc de esta función.
  }
}

/**
 * Registra en `window` los listeners de `update-download-requested`/
 * `update-install-requested` para `banner`, devolviendo la función de
 * limpieza — extraído para que `app.element.ts` no necesite un campo/handler
 * por evento (mismo motivo de extracción que el resto de este fichero).
 */
export function listenForUpdateEvents(banner: HTMLElement): () => void {
  const onDownload = (e: Event): void => {
    const { downloadUrl } = (e as CustomEvent<{ downloadUrl: string; latestVersion: string }>).detail;
    handleUpdateDownloadRequested(banner, downloadUrl);
  };
  const onInstall = (): void => {
    void handleUpdateInstallRequested();
  };

  window.addEventListener('update-download-requested', onDownload);
  window.addEventListener('update-install-requested', onInstall);

  return () => {
    window.removeEventListener('update-download-requested', onDownload);
    window.removeEventListener('update-install-requested', onInstall);
  };
}
