// Export parity between the built bundles and the shipped declarations.
//
// Compiling test/types/api.test-d.ts cannot catch this class of drift on its
// own: it only contains code that *should* compile, so a declaration for
// something the runtime does not export still passes. `EmailClient` was
// exactly that — declared as a class, absent from the bundle, so
// `import { EmailClient }` typechecked and then failed to link with
// "does not provide an export named 'EmailClient'".
//
// Checked in both directions:
//
//  - every declaration that produces a runtime binding (class, function,
//    const, enum — never interface or type alias, which must not exist at
//    runtime) is exported by the bundle;
//  - every runtime export is named by the declarations, so nothing ships
//    untyped.
//
// The declarations are scanned line-wise rather than parsed: TypeScript 7
// exposes its AST only under an explicitly unstable subpath, which is not
// something to hang a CI gate on. Prettier keeps every top-level export on
// its own line, and the non-empty assertion below fails loudly if the scan
// ever stops matching.
import assert from 'assert';
import { readFileSync } from 'fs';

// The bundled js-sha256 reaches for `require('crypto')` when it sees a Node
// process, which an ES module cannot do. Browsers and workers never take that
// path. The library only reads its opt-out flag off `window` (with no window
// it keeps its own empty object), so importing the bundle in Node needs this
// stub, exactly as test/smoke.mjs does. Dropping js-sha256 for Web Crypto
// would remove the need for it.
globalThis.window = { JS_SHA256_NO_NODE_JS: true };

const ENTRIES = [
  { types: '../types/index.d.ts', bundle: '../dist/sift-sdk-web.mjs' },
  { types: '../types/react.d.ts', bundle: '../dist/react.mjs' },
];

// `export interface` / `export type` are deliberately absent: they are the
// correct way to declare something with no runtime counterpart.
const VALUE_EXPORT =
  /^export\s+(?:abstract\s+)?(?:class|function|const|let|var|enum)\s+([A-Za-z_$][\w$]*)/gm;

let checked = 0;

for (const entry of ENTRIES) {
  const source = readFileSync(new URL(entry.types, import.meta.url), 'utf8');
  const declared = new Set(
    [...source.matchAll(VALUE_EXPORT)].map((match) => match[1])
  );
  const module = await import(new URL(entry.bundle, import.meta.url));
  const runtime = new Set(Object.keys(module));

  assert.ok(
    declared.size > 0,
    `${entry.types}: the scan matched no exported values, so this check is ` +
      `passing vacuously — fix the pattern rather than trusting it`
  );

  assert.deepStrictEqual(
    [...declared].filter((name) => !runtime.has(name)).sort(),
    [],
    `${entry.types} declares value exports that ${entry.bundle} does not ` +
      `provide. A consumer importing one typechecks and then fails to link. ` +
      `Declare it as an interface or type alias if it is only a type, or ` +
      `export it from src/.`
  );

  assert.deepStrictEqual(
    [...runtime].filter((name) => !declared.has(name)).sort(),
    [],
    `${entry.bundle} exports names the declarations do not, so consumers ` +
      `get no types for them.`
  );

  checked += declared.size;
}

console.log(`Export parity holds for ${checked} declared value exports.`);
