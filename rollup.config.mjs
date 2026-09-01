import { readFileSync } from 'fs';
import { babel } from '@rollup/plugin-babel';
import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';

// React is a peer dependency: it must never be bundled, or the hook would run
// against a second copy of React whose dispatcher the host app never populates
// (`useState` then throws) — and the peer declaration would be meaningless.
// react-dom is deliberately absent: nothing in src/ imports it, so it is not a
// peer either.
const PEERS = ['react'];

// Read from package.json rather than duplicated here: transform-runtime must
// only emit helpers the declared runtime actually provides, and a hard-coded
// copy would drift from the dependency it has to match.
const pkg = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8')
);
const RUNTIME_VERSION = pkg.dependencies && pkg.dependencies['@babel/runtime'];
if (!RUNTIME_VERSION) {
  throw new Error(
    'rollup.config.mjs: @babel/runtime must be a dependency — the build emits ' +
      'helper imports from it, and its version decides which helpers are safe.'
  );
}

// ESM only. Sifts are built with bundlers, which consume ESM directly, so
// there is no UMD/AMD/CJS output to keep in step.
const moduleBuild = (input, file) => ({
  input,
  // Babel's helpers are imported from @babel/runtime — a declared dependency —
  // so a consumer's bundler dedupes them across packages.
  external: [...PEERS, /^@babel\/runtime/],
  plugins: [
    resolve(),
    commonjs(),
    babel({
      babelHelpers: 'runtime',
      babelrc: false,
      configFile: false,
      presets: [['@babel/preset-env']],
      // `version` must track the @babel/runtime dependency below: it stops
      // Babel emitting a helper that an older installed runtime lacks, which
      // would only fail in a consumer's build.
      plugins: [
        ['@babel/plugin-transform-runtime', { version: RUNTIME_VERSION }],
      ],
      extensions: ['.js'],
    }),
  ],
  output: { file, format: 'es', sourcemap: true },
});

export default [
  moduleBuild('./src/index.js', 'dist/sift-sdk-web.mjs'),
  moduleBuild('./src/react.js', 'dist/react.mjs'),
];
