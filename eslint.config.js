import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['dist/', 'node_modules/', 'coverage/', 'src-tauri/', 'cypress/', 'scripts/', '**/*.d.ts'],
  },
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylistic,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/explicit-function-return-type': 'error',
      '@typescript-eslint/explicit-module-boundary-types': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/prefer-readonly': 'error',
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unnecessary-condition': 'off', // Demasiado estricto para tests con shadowRoot
      '@typescript-eslint/no-non-null-assertion': 'off', // shadowRoot! es un patrón válido en Web Components
      '@typescript-eslint/no-unnecessary-type-parameters': 'off', // emit<T> es un patrón válido
      'no-console': 'warn',
      'prefer-const': 'error',
      'no-var': 'error',
      'no-eval': 'error', // Tauri CSP: no eval permitido

      // ─── Límites de tamaño ───────────────────────────────────────
      'max-lines': ['warn', { max: 300, skipComments: true, skipBlankLines: true }],
      'max-lines-per-function': ['warn', { max: 60, skipComments: true, skipBlankLines: true }],
      'max-depth': ['warn', { max: 3 }],
      'max-params': ['warn', { max: 4 }],
      'max-statements': ['warn', { max: 25 }],
    },
  },
  {
    // Los ficheros de test agrupan muchos `it()` en un mismo `describe`, y `expect(obj.method)`
    // es un patrón idiomático de Vitest — ninguno de los dos indica complejidad real de producción.
    files: ['**/*.spec.ts'],
    rules: {
      'max-lines': 'off',
      'max-lines-per-function': 'off',
      '@typescript-eslint/unbound-method': 'off',
      // Template literals con números son ubicuos en tests (ids dinámicos, array indices)
      '@typescript-eslint/restrict-template-expressions': 'off',
    },
  },
  {
    // route-detail.element.ts es un componente complejo que agrupa toda la lógica de detalle
    // de ruta (mapa, fotos, notas, estadísticas, timeline) — excede el límite genérico de 300 líneas
    // de forma justificada y cohesionada.
    files: ['**/route-detail.element.ts'],
    rules: {
      'max-lines': ['warn', { max: 400, skipComments: true, skipBlankLines: true }],
    },
  },
);
