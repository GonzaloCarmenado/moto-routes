import { defineConfig } from 'vite';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@tauri-apps/plugin-camera': resolve(__dirname, 'src/shared/tauri-plugins/plugin-camera'),
      '@tauri-apps/plugin-dialog': resolve(__dirname, 'src/shared/tauri-plugins/plugin-dialog'),
    },
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
    chunkSizeWarningLimit: 200,
  },
  server: {
    host: false,
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ['**/src-tauri/**'],
    },
  },
});