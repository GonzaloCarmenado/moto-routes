/**
 * Puente hacia el foreground service Android real que mantiene el GPS activo
 * con la pantalla bloqueada (ver RecordingService.kt / RecordingServicePlugin.kt).
 * Sin este puente, watchPosition() y el tick del cronómetro se congelan en
 * cuanto el WebView pasa a segundo plano.
 */
import { startForegroundService, stopForegroundService } from '../shared/tauri/commands.js';

export interface ForegroundServiceProvider {
  start(): Promise<void>;
  stop(): Promise<void>;
}

/** Implementación real: invoca los comandos Tauri start/stop_foreground_service.
 * No-op en web/desktop (los wrappers ya ignoran el error si `invoke` no aplica). */
export function createTauriForegroundServiceProvider(): ForegroundServiceProvider {
  return {
    start: (): Promise<void> => startForegroundService(),
    stop: (): Promise<void> => stopForegroundService(),
  };
}

/** Fire-and-forget: nunca debe romper el flujo de grabación si el puente
 * nativo falla o no aplica (web/desktop, sin plugin registrado). */
export function triggerForegroundService(provider: ForegroundServiceProvider | undefined, active: boolean): void {
  const action = active ? provider?.start() : provider?.stop();
  action?.catch(() => { /* no-op fuera de Android */ });
}
