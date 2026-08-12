import { describe, it, expect } from 'vitest';
import { camera } from './plugin-camera.js';

describe('plugin-camera (browser stub)', () => {
  it('capturePhoto() always rejects — the real plugin only exists inside Tauri/Android', async () => {
    await expect(camera.capturePhoto({})).rejects.toThrow('plugin-camera no disponible en navegador');
  });
});
