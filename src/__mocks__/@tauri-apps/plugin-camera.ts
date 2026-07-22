// Stub para tests — el plugin real solo existe en entorno Tauri Android
export const camera = {
  capturePhoto: (_options: { format?: string; quality?: number }): Promise<{ base64: string; uri: string }> => {
    return Promise.resolve({ base64: '', uri: '' });
  },
};
