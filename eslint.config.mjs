import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';

// Flat config (ESLint 10). The original .eslintrc.json set no parser, so the
// class fields used throughout src/ were unparseable and linting silently did
// nothing. Class fields are standard ES2022, so no Babel parser is needed.
//
// eslint-plugin-react is deliberately absent. Its latest release supports
// eslint up to ^9.7 only, which would pin us to a maintenance line, and every
// rule it contributes needs either JSX, a class component or ReactDOM — none
// of which exist here: the SDK's whole React surface is the useSiftView hook,
// and React is an optional peer that is never bundled. react-hooks is the
// plugin doing real work (it is what caught a render-phase ref write), and it
// supports eslint ^10.
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
    plugins: { 'react-hooks': reactHooks },
    rules: {
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
];
