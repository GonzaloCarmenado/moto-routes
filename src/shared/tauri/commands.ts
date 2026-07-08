/**
 * Wrappers tipados para invoke<T>() de Tauri.
 * Centraliza todas las llamadas al backend Rust con tipado estricto.
 * Nunca usar window.__TAURI__ directamente.
 */
import { invoke } from '@tauri-apps/api/core';

// Ejemplo: comando greet en Rust
export interface GreetArgs {
  name: string;
}

export interface GreetResponse {
  message: string;
}

export async function greet(args: GreetArgs): Promise<GreetResponse> {
  return invoke<GreetResponse>('greet', args);
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
  return invoke<void>('save_file', args);
}