// Stub para tests — el plugin real solo existe en entorno Tauri
export const open = async (_options?: { multiple?: boolean; filters?: { name: string; extensions: string[] }[] }) => {
  return null as string | null;
};