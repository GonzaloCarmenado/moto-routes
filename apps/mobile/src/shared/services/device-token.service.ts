/**
 * Registro del token de notificaciones push tras un login con éxito
 * (notificaciones-push-fcm). Permiso pedido de forma perezosa — nunca al
 * abrir la app sin sesión — y todo el flujo es best-effort: cualquier fallo
 * (permiso denegado, sin token disponible, error de red) se ignora en
 * silencio, sin bloquear el login ni el resto de la app. El badge in-app de
 * invitaciones pendientes sigue siendo la fuente de verdad con o sin push.
 */
import { isPermissionGranted, requestPermission } from '@tauri-apps/plugin-notification';
import { getNotificationToken, getPendingTokenRefresh, clearPendingTokenRefresh } from '../tauri/commands.js';
import { registerDeviceToken } from '../http/notifications-api.service.js';
import type { Session } from '../models/session.types.js';

const PLATFORM = 'android';

/** Pide el permiso de notificaciones si hace falta y registra el token del dispositivo. */
export async function registerDeviceTokenAfterLogin(apiBaseUrl: string, session: Session): Promise<void> {
  try {
    let granted = await isPermissionGranted();
    if (!granted) {
      granted = (await requestPermission()) === 'granted';
    }
    if (!granted) return;

    const deviceToken = await getNotificationToken();
    if (!deviceToken) return;

    await registerDeviceToken(apiBaseUrl, session.token, deviceToken, PLATFORM);
  } catch {
    // Best-effort — ver JSDoc del módulo.
  }
}

/**
 * Re-registra el token FCM tras una rotación (design.md Decisión 6): Firebase
 * puede rotarlo en cualquier momento, y `NotificationsPlugin.kt::onNewToken`
 * lo deja pendiente en `SharedPreferences` porque Kotlin no tiene acceso a la
 * sesión (vive en SQLite, gestionada por JS). Se consulta en cada arranque de
 * la app con sesión activa — no hace falta volver a pedir permiso, ya estaba
 * concedido para haber llegado a tener un token que rotar. Best-effort, igual
 * que `registerDeviceTokenAfterLogin`.
 */
export async function reregisterDeviceTokenAfterRefresh(apiBaseUrl: string, session: Session): Promise<void> {
  try {
    const pendingToken = await getPendingTokenRefresh();
    if (!pendingToken) return;

    await registerDeviceToken(apiBaseUrl, session.token, pendingToken, PLATFORM);
    await clearPendingTokenRefresh();
  } catch {
    // Best-effort — ver JSDoc del módulo.
  }
}
