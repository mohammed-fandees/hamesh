import ts from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import react from 'eslint-plugin-react-hooks';

export default [
  {
    ignores: ['.output/**', '.wxt/**', 'node_modules/**', 'landing/js/vendor/**'],
  },
  {
    /* The landing page's own scripts: browser ES modules, no TypeScript and
       no build step. Linted so the site's code is held to the same standard
       as the extension's, rather than being the one corner nothing checks. */
    files: ['landing/js/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        window: 'readonly',
        document: 'readonly',
        localStorage: 'readonly',
        IntersectionObserver: 'readonly',
        CSS: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-undef': 'error',
    },
  },
  {
    files: ['src/**/*.ts', 'src/**/*.tsx', 'tests/**/*.ts', 'e2e/**/*.ts', 'tooling/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      '@typescript-eslint': ts,
      'react-hooks': react,
    },
    rules: {
      ...ts.configs.recommended.rules,
      ...react.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-expressions': 'off',
    },
  },
];
