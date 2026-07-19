import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@tauri-apps/plugin-camera': resolve(__dirname, 'src/__mocks__/@tauri-apps/plugin-camera'),
      '@tauri-apps/plugin-dialog': resolve(__dirname, 'src/__mocks__/@tauri-apps/plugin-dialog'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.spec.ts'],
    exclude: ['src/shared/models/route.repository.spec.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        'src/main.ts',
        'src/vite-env.d.ts',
        'src/app/app.element.ts',
        'src/cockpit/cockpit.types.ts',
        'src/shared/tauri/commands.ts',
        'src/shared/utils/dom.ts',
        'src/shared/models/route.repository.spec.ts',
        '**/*.spec.ts',
      ],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 70,
        statements: 70,
      },
    },
  },
});
