// Stub para tests — el plugin real solo existe en entorno Tauri
export const open = (_options?: { multiple?: boolean; filters?: { name: string; extensions: string[] }[] }): Promise<string | null> => {
  return Promise.resolve(null);
};
