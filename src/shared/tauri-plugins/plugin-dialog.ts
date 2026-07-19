/**
 * Stub para @tauri-apps/plugin-dialog en entorno navegador.
 * El plugin real solo existe dentro de Tauri (Android).
 */
export const open = (_options?: { multiple?: boolean; filters?: { name: string; extensions: string[] }[] }): Promise<string | null> => {
  return Promise.resolve(null);
};