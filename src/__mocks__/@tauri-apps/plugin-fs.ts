// Stub para tests — el plugin real solo existe en entorno Tauri
export const writeFile = async (_path: string, _data: Uint8Array): Promise<void> => { /* noop */ };
export const readFile = async (_path: string): Promise<Uint8Array> => new Uint8Array();
export const exists = async (_path: string): Promise<boolean> => false;
export const mkdir = async (_path: string, _options?: { recursive?: boolean }): Promise<void> => { /* noop */ };