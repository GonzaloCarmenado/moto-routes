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
    setupFiles: [resolve(__dirname, 'tests/setup.ts')],
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
        'src/shared/models/route.repository.spec.ts',
        // Contratos puros (interfaces/tipos) — sin código ejecutable que cubrir,
        // igual que cockpit.types.ts arriba.
        'src/shared/models/index.ts',
        'src/shared/models/route.types.ts',
        'src/shared/models/route.repository.ts',
        'src/shared/models/photo.types.ts',
        'src/shared/models/photo.repository.ts',
        'src/routes/route-detail.types.ts',
        '**/*.d.ts',
        '**/*.spec.ts',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
});
