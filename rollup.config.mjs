import { babel } from '@rollup/plugin-babel';
import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';

// React is a peer dependency: it must never be bundled, or the hook would run
// against a second copy of React whose dispatcher the host app never populates
// (`useState` then throws) — and the peer declaration would be meaningless.
const PEERS = ['react', 'react-dom'];

const PRESETS = [['@babel/preset-env']];

// For the module builds, Babel's helpers are imported from @babel/runtime — a
// declared dependency — so a consumer's bundler dedupes them across packages.
const babelRuntime = () =>
  babel({
    babelHelpers: 'runtime',
    babelrc: false,
    configFile: false,
    presets: PRESETS,
    plugins: [['@babel/plugin-transform-runtime']],
    extensions: ['.js'],
  });

// A UMD bundle has to stand alone in a <script> tag, so its helpers are
// inlined instead. The previous "UMD" output imported them from
// @babel/runtime and expected globals that no page provides.
const babelBundled = () =>
  babel({
    babelHelpers: 'bundled',
    babelrc: false,
    configFile: false,
    presets: PRESETS,
    extensions: ['.js'],
  });

const moduleBuild = (input, file) => ({
  input,
  external: [...PEERS, /^@babel\/runtime/],
  plugins: [resolve(), commonjs(), babelRuntime()],
  output: { file, format: 'es', sourcemap: true },
});

const umdBuild = (input, file, name) => ({
  input,
  external: PEERS,
  plugins: [resolve(), commonjs(), babelBundled()],
  output: {
    file,
    format: 'umd',
    name,
    globals: { react: 'React', 'react-dom': 'ReactDOM' },
    sourcemap: true,
    exports: 'named',
  },
});

export default [
  moduleBuild('./src/index.js', 'dist/sift-sdk-web.mjs'),
  umdBuild('./src/index.js', 'dist/sift-sdk-web.umd.js', 'SiftSdkWeb'),
  moduleBuild('./src/react.js', 'dist/react.mjs'),
  umdBuild('./src/react.js', 'dist/react.umd.js', 'SiftSdkWebReact'),
];
