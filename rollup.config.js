import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import { getBabelOutputPlugin } from '@rollup/plugin-babel';
import pkg from './package.json';

const babelConfig = {
  presets: [['@babel/preset-env', { modules: 'umd' }]],
  plugins: [
    '@babel/plugin-transform-runtime',
    '@babel/plugin-proposal-class-properties',
  ],
};

export default [
  {
    input: './src/index.js',
    plugins: [resolve(), commonjs()],
    output: [
      {
        file: pkg.module,
        format: 'es',
        name: 'sift-sdk-web',
      },
      {
        file: pkg.browser,
        format: 'esm',
        name: 'sift-sdk-web',
        plugins: [getBabelOutputPlugin(babelConfig)],
      },
    ],
  },
  {
    input: './src/react.js',
    plugins: [resolve(), commonjs()],
    output: [
      {
        file: 'dist/react.esm.js',
        format: 'es',
        name: 'sift-sdk-web/react',
      },
      {
        file: 'dist/react.umd.js',
        format: 'esm',
        name: 'sift-sdk-web/react',
        plugins: [getBabelOutputPlugin(babelConfig)],
      },
    ],
  },
];
