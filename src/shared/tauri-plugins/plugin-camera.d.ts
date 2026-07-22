declare module '@tauri-apps/plugin-camera' {
  export const camera: {
    capturePhoto(options?: { format?: string; quality?: number }): Promise<{ base64: string; uri: string }>;
  };
}