/**
 * Stub para @tauri-apps/plugin-camera en entorno navegador.
 * El plugin real solo existe dentro de Tauri (Android).
 */
export const camera = {
  capturePhoto: (_options: { format?: string; quality?: number }): Promise<{ base64: string; uri: string }> => {
    return Promise.reject(new Error('plugin-camera no disponible en navegador'));
  },
};