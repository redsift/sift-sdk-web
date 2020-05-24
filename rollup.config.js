import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import pkg from './package.json';

export default [
  {
    input: './src/index.js',
    output: [
      {
        file: pkg.module,
        format: 'es',
        name: 'sift-sdk-web',
      },
      {
        file: pkg.browser,
        format: 'umd',
        name: 'sift-sdk-web',
      },
    ],
    plugins: [resolve(), commonjs()],
  },
  {
    input: './src/react.js',
    output: [
      {
        file: 'dist/react.esm.js',
        format: 'es',
        name: 'sift-sdk-web-react',
      },
      {
        file: 'dist/react.umd.js',
        format: 'umd',
        name: 'sift-sdk-web-react',
      },
    ],
    plugins: [resolve(), commonjs()],
  },
];
