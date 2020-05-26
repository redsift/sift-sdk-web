import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import { getBabelOutputPlugin } from '@rollup/plugin-babel';
import pkg from './package.json';

const babelConfig = {
  presets: [['@babel/preset-env']],
  plugins: [
    '@babel/plugin-transform-runtime',
    '@babel/plugin-proposal-class-properties',
  ],
};

const babelConfigUmd = {
  presets: [['@babel/preset-env', { modules: 'umd' }]],
  plugins: babelConfig.plugins,
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
        plugins: [getBabelOutputPlugin(babelConfig)],
      },
      {
        file: pkg.browser,
        format: 'esm',
        name: 'sift-sdk-web',
        plugins: [getBabelOutputPlugin(babelConfigUmd)],
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
        plugins: [getBabelOutputPlugin(babelConfig)],
      },
      {
        file: 'dist/react.umd.js',
        format: 'esm',
        name: 'sift-sdk-web/react',
        plugins: [getBabelOutputPlugin(babelConfigUmd)],
      },
    ],
  },
];
