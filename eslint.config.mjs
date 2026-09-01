import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';

// Flat config (ESLint 9). The previous .eslintrc.json set no parser, so the
// class fields used throughout src/ were unparseable and linting silently did
// nothing. Class fields are standard ES2022, so no Babel parser is needed.
export default [
  { ignores: ['dist/**', 'node_modules/**'] },
  js.configs.recommended,
  {
    files: ['src/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      // The SDK runs both in a window (view) and a worker (controllers)
      globals: { ...globals.browser, ...globals.worker },
    },
    plugins: { react, 'react-hooks': reactHooks },
    settings: { react: { version: '16.13' } },
    rules: {
      ...react.configs.flat.recommended.rules,
      ...reactHooks.configs['recommended-latest'].rules,
    },
  },
  {
    files: ['test/**/*.mjs', '*.mjs', '*.cjs'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.node },
    },
  },
  {
    files: ['react.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: { ...globals.node },
    },
  },
];
