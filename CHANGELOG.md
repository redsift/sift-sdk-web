# Changelog

## 3.0.0

The first release since the 2.0.3 published in 2021. It contains three rounds
of work — security hardening, toolchain and packaging, then types and
documentation — and this is the first version in which any of it reaches a
consumer.

### Breaking

- **An unresolvable client origin now throws** instead of falling back to
  accepting and posting to any origin. That fallback kept a broken deployment
  working at the cost of running unpinned, with nothing looking wrong while
  every message was readable by any embedder. Pass `clientOrigin` explicitly,
  or `clientOrigin: '*'` to accept the unpinned behaviour.
- **`event.source` is checked strictly.** Inbound messages are accepted only
  from the embedding window. Two exceptions are gone: one for an absent
  `source`, which covered a sender that had since closed, and one for this
  window posting to itself. A client does neither, so the check is now simply
  "must be the embedding window". A view that is not embedded still works,
  since `parent === window` there.
- **The trusted origin set is exactly the client**; the view's own origin is no
  longer added to it.
- **Plugins receive `{ notifyClient }`** as their context rather than the whole
  view. It is the view's own method, so a sift overriding `notifyClient` still
  sees what its plugins send.
- **ESM only.** The package publishes `.mjs` bundles behind an `exports` map,
  with no CommonJS or UMD build. The 2.0.3 "UMD" build was not usable as one
  anyway — loaded via a script tag it threw `ReferenceError: require is not
defined`.
- **React is no longer bundled** and is an optional peer dependency. In 2.0.3
  the React entry point bundled its own copy of React and threw
  `TypeError: Cannot read properties of null (reading 'useState')` when used.
- **Outbound messages are pinned** to the resolved client origin instead of
  being posted to `'*'`.

### Added

- **TypeScript declarations** for the whole public surface, wired through the
  `exports` map, with the protocol documented in TSDoc.
- **A README** documenting the postMessage protocol in all four directions, the
  lifecycle, the origin model, and the plugins.
- `SiftView.destroy()`, and plugin cleanup when a `useSiftView` component
  unmounts.
- Three test suites over the built bundles: behavioural (`test/smoke.mjs`),
  runtime-vs-declaration export parity (`test/export-parity.mjs`), and
  class-vs-hook parity (`test/hook-parity.mjs`, which renders the hook for
  real — the first runtime coverage the React entry point has had).

### Changed

- `SiftView` and `useSiftView` are now the same implementation underneath
  (`src/lib/view-core.js`), so they cannot disagree about the protocol or its
  security. They previously duplicated all of it.
- Inbound messages cannot reach lifecycle or dispatch internals, `Object`
  prototype members, or the outbound emitters, on either the view or the
  controller side.
- The controller uses `addEventListener` rather than assigning `onmessage`, so
  it no longer clobbers other listeners on the worker scope.
- `loadView` failures are reported as `loadViewFailedCallback` instead of
  leaving the view waiting: a throw, a non-object return, and a rejected `data`
  promise are all covered.
- `showOAuthPopup` no longer lets a caller-supplied `subject` overwrite the
  hash derived from `email`.
- `sync-history` maps a `POP` from the client onto `replace`, so browser
  back/forward no longer adds a duplicate entry inside the view; it also
  unsubscribes when stopped.
- `track-ui-activity` throttles to one message every 5 seconds and removes all
  its listeners on stop, including the capture-phase `scroll`.
- Toolchain: Rollup 4, ESLint 9 flat config, Prettier 3, husky 9, Babel 7
  current, pinned `cimg/node` in CI with lint, typecheck and test gates, and
  tag-driven publishing that verifies the tag matches `package.json`.
- `npm audit` reports no vulnerabilities, down from 17 (1 critical, 9 high).

## 2.0.3 and earlier

No changelog was kept.
