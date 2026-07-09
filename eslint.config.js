import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['dist/', 'node_modules/', 'coverage/', 'src-tauri/'],
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
);