/**
 * @packageDocumentation
 * Escucha el tap de una notificación push nativa (notificaciones-push-fcm) y
 * traduce el tipo de evento a una acción — mismo patrón que
 * `cockpit-native-gps.service.ts::createNativeGpsProvider` para el puente
 * Kotlin→Rust→JS: `listen()` puede fallar en plataformas sin el evento
 * (web/desktop), se ignora en silencio.
 */
import { listen } from '@tauri-apps/api/event';

/** Nombre del evento Tauri emitido al tocar una notificación push (ver notifications.rs). */
export const NOTIFICATION_TAP_EVENT = 'notifications://tap';

interface NotificationTapPayload {
  type: string;
}

/**
 * Escucha `notifications://tap` y llama a `onRouteShareInvite` cuando el tipo
 * es `route_share_invite` — el único tipo implementado hoy (ver
 * specs/notificaciones-push/spec.md). Devuelve una función para dejar de
 * escuchar.
 */
export function listenForNotificationTaps(onRouteShareInvite: () => void): () => void {
  let unlisten: (() => void) | null = null;
  let cancelled = false;

  listen<NotificationTapPayload>(NOTIFICATION_TAP_EVENT, (event) => {
    if (event.payload.type === 'route_share_invite') onRouteShareInvite();
  })
    .then((fn) => {
      if (cancelled) {
        fn();
        return;
      }
      unlisten = fn;
    })
    .catch(() => { /* no-op: el evento nativo no está disponible en esta plataforma */ });

  return (): void => {
    cancelled = true;
    unlisten?.();
  };
}
