/**
 * Wrappers tipados para invoke<T>() de Tauri.
 * Centraliza todas las llamadas al backend Rust con tipado estricto.
 * Nunca usar window.__TAURI__ directamente.
 */
import { invoke } from '@tauri-apps/api/core';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type InvokeArgs = Record<string, any>;

/** Inicia el foreground service de Android (notificación persistente) */
export async function startForegroundService(): Promise<void> {
  try {
    await invoke('start_foreground_service');
  } catch {
    // Ignorar error si no está disponible (web/desktop)
  }
}

/** Detiene el foreground service de Android */
export async function stopForegroundService(): Promise<void> {
  try {
    await invoke('stop_foreground_service');
  } catch {
    // Ignorar error si no está disponible
  }
}

/** Pausa la captura nativa de ubicación del foreground service (sin detener el
 * servicio ni la notificación). No-op si el comando no existe (web/desktop). */
export async function pauseRecordingLocation(): Promise<void> {
  try {
    await invoke('pause_recording_location');
  } catch {
    // Ignorar error si no está disponible
  }
}

/** Reanuda la captura nativa de ubicación del foreground service. */
export async function resumeRecordingLocation(): Promise<void> {
  try {
    await invoke('resume_recording_location');
  } catch {
    // Ignorar error si no está disponible
  }
}

/** Token de notificaciones push (FCM) del dispositivo actual, o `null` si no está disponible (web/desktop, sin permiso, sin Google Play Services). */
export async function getNotificationToken(): Promise<string | null> {
  try {
    return await invoke<string | null>('get_notification_token');
  } catch {
    return null;
  }
}

/** Pantalla pendiente de abrir tras un tap en notificación con la app cerrada del todo (cold start), o `null` si no hay ninguna. Consultar solo una vez registrado el listener de `notifications://tap` (ver notification-tap.service.ts). */
export async function getPendingTapScreen(): Promise<string | null> {
  try {
    return await invoke<string | null>('get_pending_tap_screen');
  } catch {
    return null;
  }
}

/** Borra la pantalla pendiente ya consumida — evita reabrirla en el próximo arranque sin un tap nuevo. */
export async function clearPendingTapScreen(): Promise<void> {
  try {
    await invoke('clear_pending_tap_screen');
  } catch {
    // Ignorar error si no está disponible (web/desktop)
  }
}

/** Token FCM pendiente de re-registrar tras una rotación (Firebase puede rotarlo en cualquier momento), o `null` si no hay ninguno pendiente. */
export async function getPendingTokenRefresh(): Promise<string | null> {
  try {
    return await invoke<string | null>('get_pending_token_refresh');
  } catch {
    return null;
  }
}

/** Borra el token pendiente ya re-registrado. */
export async function clearPendingTokenRefresh(): Promise<void> {
  try {
    await invoke('clear_pending_token_refresh');
  } catch {
    // Ignorar error si no está disponible (web/desktop)
  }
}

// Ejemplo: comando greet en Rust
/** Argumentos del comando `greet` (ejemplo del backend Rust). */
export interface GreetArgs {
  name: string;
}

/** Respuesta del comando `greet`. */
export interface GreetResponse {
  message: string;
}

/** Ejemplo de comando `greet` del backend Rust. */
export async function greet(args: GreetArgs): Promise<GreetResponse> {
  return invoke<GreetResponse>('greet', args as unknown as InvokeArgs);
}

// Ejemplo: comando con validación
/** Argumentos del comando `save_file`. */
export interface SaveFileArgs {
  path: string;
  content: string;
}

/** Ejemplo de comando `save_file` con validación básica en frontend. */
export async function saveFile(args: SaveFileArgs): Promise<void> {
  // Validación básica en frontend (la validación real está en Rust)
  if (!args.path || !args.content) {
    throw new Error('Path and content are required');
  }
  return invoke('save_file', args as unknown as InvokeArgs);
}