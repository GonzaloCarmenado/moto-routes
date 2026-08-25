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

/** Crea `<update-banner>` y lo añade a `host` (typado como el resto de vistas globales de `app.element.ts`). */
export function mountUpdateBanner(host: HTMLElement): HTMLElement {
  const el = document.createElement('update-banner');
  host.appendChild(el);
  return el;
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
