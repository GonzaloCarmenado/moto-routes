import { isPermissionGranted, sendNotification } from '@tauri-apps/plugin-notification';

const LAST_NOTIFIED_VERSION_KEY = 'lastNotifiedUpdateVersion';

/**
 * Notifica localmente que hay una versión más reciente disponible, como mucho
 * una vez por versión (dedupe vía `localStorage` — un único valor de estado
 * ligero, no merece una tabla SQLite nueva). Nunca pide el permiso de
 * notificaciones (solo lo comprueba): si no está ya concedido —p. ej. porque
 * el registro de push tras login (`device-token.service.ts`) nunca llegó a
 * pedirlo—, simplemente no notifica; el aviso dentro de la propia app
 * (`<update-banner>`) sigue siendo el canal principal. Nunca lanza.
 */
export async function notifyUpdateAvailable(latestVersion: string): Promise<void> {
  if (localStorage.getItem(LAST_NOTIFIED_VERSION_KEY) === latestVersion) return;

  try {
    const granted = await isPermissionGranted();
    if (!granted) return;

    sendNotification({
      title: 'Actualización disponible',
      body: `Moto Routes ${latestVersion} ya está disponible para instalar.`,
    });
    localStorage.setItem(LAST_NOTIFIED_VERSION_KEY, latestVersion);
  } catch {
    // Best-effort — ver JSDoc del módulo.
  }
}
