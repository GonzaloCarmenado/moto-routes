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

// Ejemplo: comando greet en Rust
export interface GreetArgs {
  name: string;
}

export interface GreetResponse {
  message: string;
}

export async function greet(args: GreetArgs): Promise<GreetResponse> {
  return invoke<GreetResponse>('greet', args as unknown as InvokeArgs);
}

// Ejemplo: comando con validación
export interface SaveFileArgs {
  path: string;
  content: string;
}

export async function saveFile(args: SaveFileArgs): Promise<void> {
  // Validación básica en frontend (la validación real está en Rust)
  if (!args.path || !args.content) {
    throw new Error('Path and content are required');
  }
  return invoke('save_file', args as unknown as InvokeArgs);
}