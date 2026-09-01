// `SiftView` and `useSiftView` are two front doors onto one protocol, and
// they used to duplicate every part of it. They are now both wiring over
// src/lib/view-core, and this is what keeps them from drifting apart again:
// it renders the hook for real and compares what it exposes, and what it
// puts on the wire, against the class.
//
// The render is server-side, so `useState`, `useMemo` and `useRef` run but
// `useEffect` does not — this covers the surface and the origin policy, not
// the message listener, which test/smoke.mjs exercises through the class.
import assert from 'assert';

const sent = [];
const fakeParent = {
  postMessage: (msg, targetOrigin) => sent.push({ msg, targetOrigin }),
};
const fakeWindow = {
  // keep the bundled js-sha256 on its pure-JS path (no Node require())
  JS_SHA256_NO_NODE_JS: true,
  addEventListener: () => {},
  removeEventListener: () => {},
  location: { origin: 'https://dmarc.sift.example' },
  document: { referrer: 'https://app.redsift.com/home/abc' },
  parent: fakeParent,
};
globalThis.window = fakeWindow;
globalThis.document = fakeWindow.document;
globalThis.parent = fakeParent;

const React = (await import('react')).default;
const { renderToStaticMarkup } = await import('react-dom/server');
const { useSiftView } = await import('../dist/react.mjs');
const { createSiftView } = await import('../dist/sift-sdk-web.mjs');

const CLIENT = 'https://app.redsift.com';

let hookView = null;
function Probe() {
  const [, siftView] = useSiftView({ clientOrigin: CLIENT });
  hookView = siftView;
  return null;
}
renderToStaticMarkup(React.createElement(Probe));
assert.ok(hookView, 'the hook returned a view');

const classView = createSiftView({}, { clientOrigin: CLIENT });

// Every member of the protocol surface, on both. A member added to one and
// forgotten on the other fails here.
const SHARED_MEMBERS = [
  'publish',
  'notifyClient',
  '_initPlugins',
  '_startPlugins',
  '_stopPlugins',
  '_receivePluginMessages',
  'getPlugin',
  'showOAuthPopup',
  'removeOAuthIdentity',
  'signup',
  'login',
  'logout',
  'navigate',
  'setupSyncHistory',
];

assert.deepStrictEqual(
  SHARED_MEMBERS.filter((name) => typeof hookView[name] !== 'function'),
  [],
  'the hook exposes every shared protocol member'
);
assert.deepStrictEqual(
  SHARED_MEMBERS.filter((name) => typeof classView[name] !== 'function'),
  [],
  'the class exposes every shared protocol member'
);
[
  ['hook', hookView],
  ['class', classView],
].forEach(([which, view]) => {
  assert.ok(
    view.controller && typeof view.controller.subscribe === 'function',
    `the ${which} exposes the controller observable`
  );
});

// Identical wire output, member by member: same envelope, same pinned origin.
const envelopeOf = (view, call) => {
  sent.length = 0;
  call(view);
  assert.strictEqual(sent.length, 1, 'exactly one message was posted');
  return sent[0];
};
const CALLS = {
  publish: (v) => v.publish('a-topic', { n: 1 }),
  notifyClient: (v) => v.notifyClient('a-topic', { n: 1 }),
  showOAuthPopup: (v) =>
    v.showOAuthPopup({ provider: 'google', options: { email: 'a@b.co' } }),
  removeOAuthIdentity: (v) => v.removeOAuthIdentity({ provider: 'google' }),
  signup: (v) => v.signup(),
  login: (v) => v.login({ redirectUri: '/back' }),
  logout: (v) => v.logout(),
  navigate: (v) => v.navigate({ href: '/x', openInNewTab: true }),
};
Object.entries(CALLS).forEach(([name, call]) => {
  assert.deepStrictEqual(
    envelopeOf(hookView, call),
    envelopeOf(classView, call),
    `${name} puts the same message on the wire from both`
  );
});
// and it really is pinned, not '*'
assert.strictEqual(
  envelopeOf(classView, CALLS.login).targetOrigin,
  CLIENT,
  'outbound is pinned to the client origin'
);

// The hook must fail closed on an unresolvable origin, exactly as the class
// does — a stale self-referrer with no ancestorOrigins and no clientOrigin.
fakeWindow.document.referrer = 'https://dmarc.sift.example/previous-page';
assert.throws(
  () => createSiftView({}),
  /Could not determine the client origin/,
  'the class fails closed'
);
function Unresolvable() {
  useSiftView();
  return null;
}
assert.throws(
  () => renderToStaticMarkup(React.createElement(Unresolvable)),
  /Could not determine the client origin/,
  'the hook fails closed too'
);

console.log(
  `Hook and class agree on ${SHARED_MEMBERS.length} members and ${Object.keys(CALLS).length} wire messages.`
);
