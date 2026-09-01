// `SiftView` and `useSiftView` are two front doors onto one protocol, and
// they used to duplicate every part of it. They are now both wiring over
// src/lib/view-core, and this is what keeps them from drifting apart again:
// it renders the hook for real and compares what it exposes, and what it
// puts on the wire, against the class.
//
// Two renders, because they cover different halves. A server-side render runs
// `useState`/`useMemo`/`useRef` but not effects, which is enough to compare the
// surface and the origin policy against the class. The hook's message listener
// lives in an effect, though, and it is where the hook's half of the security
// change sits — so the second half of this file renders through
// react-test-renderer, where effects do run, and drives real messages at it.
import assert from 'assert';

const sent = [];
const fakeParent = {
  postMessage: (msg, targetOrigin) => sent.push({ msg, targetOrigin }),
};
const windowListeners = [];
const fakeWindow = {
  // keep the bundled js-sha256 on its pure-JS path (no Node require())
  JS_SHA256_NO_NODE_JS: true,
  addEventListener: (type, fn) => windowListeners.push({ type, fn }),
  // really remove, so the unmount assertion below can fail
  removeEventListener: (type, fn) => {
    const at = windowListeners.findIndex((l) => l.type === type && l.fn === fn);
    if (at !== -1) {
      windowListeners.splice(at, 1);
    }
  },
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

// ---------------------------------------------------------------------------
// The hook's own listener wiring, with effects actually running.
// ---------------------------------------------------------------------------
// Everything above holds even if the hook never registered a listener, or
// registered one with the wrong proxy or dispatch target. This is what would
// catch that.
fakeWindow.document.referrer = 'https://app.redsift.com/home/abc';
windowListeners.length = 0;

const TestRenderer = (await import('react-test-renderer')).default;

let liveParams = null;
let liveView = null;
function Listener() {
  const [params, siftView] = useSiftView({ clientOrigin: CLIENT });
  liveParams = params;
  liveView = siftView;
  return null;
}

let tree;
TestRenderer.act(() => {
  tree = TestRenderer.create(React.createElement(Listener));
});

assert.deepStrictEqual(
  windowListeners.map((l) => l.type),
  ['message'],
  'mounting the hook registers exactly one message listener'
);

const deliver = (origin, data, source = fakeParent) =>
  TestRenderer.act(() => {
    windowListeners.forEach(
      ({ type, fn }) => type === 'message' && fn({ origin, data, source })
    );
  });

// the happy path: the client's presentView arrives as state
deliver(CLIENT, { method: 'presentView', params: { rows: 7 } });
assert.deepStrictEqual(
  liveParams,
  { rows: 7 },
  'a client message from the embedding window becomes state'
);

// ...and each rejection the class is tested for is rejected here too
[
  [
    'https://evil.example',
    { method: 'presentView', params: { bad: 'origin' } },
    fakeParent,
    'an untrusted origin',
  ],
  [
    CLIENT,
    { method: 'presentView', params: { bad: 'no source' } },
    null,
    'a message with no source',
  ],
  [
    CLIENT,
    { method: 'presentView', params: { bad: 'self' } },
    fakeWindow,
    'a self-posted message',
  ],
  [
    CLIENT,
    { method: 'presentView', params: { bad: 'rogue' } },
    { postMessage() {} },
    'another window on the client origin',
  ],
].forEach(([origin, data, source, what]) => {
  deliver(origin, data, source);
  assert.deepStrictEqual(
    liveParams,
    { rows: 7 },
    `${what} is ignored by the hook, as by the class`
  );
});

// the controller's messages still reach the observable
let fromController = null;
liveView.controller.subscribe('data-changed', (message) => {
  fromController = message;
});
deliver(CLIENT, {
  method: 'notifyView',
  params: { topic: 'data-changed', value: { n: 1 } },
});
assert.deepStrictEqual(
  fromController,
  { n: 1 },
  'notifyView is routed to the controller observable'
);

// unmount must remove the listener and stop the plugins it started, handing
// them the same context `SiftView.destroy` does — PluginManager forwards it to
// every plugin's `stop`, so an omission here is a difference a third-party
// plugin would see on unmount only
let probeStopped = false;
let stopArgs = null;
const ProbePlugin = class {
  static id = () => 'probe';
  static contexts = () => ['view'];
  init = () => true;
  stop = (args) => {
    probeStopped = true;
    stopArgs = args;
  };
};
liveView.pluginManager._pluginFactory = [ProbePlugin];
liveView._initPlugins({ pluginConfigs: [{ id: 'probe' }] });
assert.strictEqual(
  liveView.pluginManager.getActivePlugins().length,
  1,
  'the probe plugin started'
);

const beforeUnmount = liveParams;
TestRenderer.act(() => {
  tree.unmount();
});
assert.deepStrictEqual(windowListeners, [], 'unmount removes the listener');
assert.strictEqual(probeStopped, true, 'unmount stops the plugins');
assert.strictEqual(stopArgs.contextType, 'view', 'stop gets the context type');
assert.deepStrictEqual(
  Object.keys(stopArgs.context ?? {}),
  ['notifyClient'],
  'unmount hands plugins the same { notifyClient } context as the class'
);

// ...and the class's teardown agrees, member for member
let classStopArgs = null;
const teardownView = createSiftView({}, { clientOrigin: CLIENT });
teardownView._pluginManager._pluginFactory = [
  class extends ProbePlugin {
    stop = (args) => {
      classStopArgs = args;
    };
  },
];
teardownView._initPlugins({ pluginConfigs: [{ id: 'probe' }] });
teardownView.destroy();
assert.deepStrictEqual(
  Object.keys(classStopArgs).sort(),
  Object.keys(stopArgs).sort(),
  'both teardowns pass the same shape to a plugin'
);
assert.deepStrictEqual(
  Object.keys(classStopArgs.context ?? {}),
  ['notifyClient'],
  "the class's teardown context matches too"
);
deliver(CLIENT, { method: 'presentView', params: { after: 'unmount' } });
assert.deepStrictEqual(
  liveParams,
  beforeUnmount,
  'no message is dispatched after unmount'
);

console.log("The hook's listener registers, filters, routes and cleans up.");
