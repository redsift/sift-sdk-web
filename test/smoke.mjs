// Smoke test for the built SDK bundle, run in Node with faked browser globals.
import assert from 'assert';
import { readFileSync } from 'fs';

const sent = []; // messages posted to the (fake) parent window
const windowListeners = [];

function last(arr) {
  return arr[arr.length - 1];
}

const fakeParent = {
  postMessage: (msg, targetOrigin) => sent.push({ msg, targetOrigin }),
};

const fakeWindow = {
  // keep the bundled js-sha256 on its pure-JS path (no Node require())
  JS_SHA256_NO_NODE_JS: true,
  addEventListener: (type, fn) => windowListeners.push({ type, fn }),
  // Really remove, so tests asserting a listener survives (or not) can fail
  removeEventListener: (type, fn) => {
    const index = windowListeners.findIndex(
      (l) => l.type === type && l.fn === fn
    );
    if (index !== -1) {
      windowListeners.splice(index, 1);
    }
  },
  location: { origin: 'https://dmarc.sift.example' },
  document: { referrer: 'https://app.redsift.com/home/abc' },
  parent: fakeParent,
};

globalThis.window = fakeWindow;
globalThis.document = fakeWindow.document;
globalThis.parent = fakeParent;

// `source` defaults to the embedding window, as a real client message has
const deliver = (origin, data, source = fakeParent) =>
  windowListeners.forEach(
    ({ type, fn }) => type === 'message' && fn({ origin, data, source })
  );

async function main() {
  const sdk = await import('../dist/sift-sdk-web.mjs');
  const { createSiftView, createSiftController, SiftView } = sdk;

  // ---- view construction + message policy ---------------------------------
  let presented = null;
  const view = createSiftView({
    presentView(p) {
      presented = p;
    },
  });
  assert.ok(view instanceof SiftView, 'createSiftView returns a SiftView');
  assert.deepStrictEqual(
    view._trustedOrigins,
    ['https://app.redsift.com'],
    'trusts exactly the client origin, not our own as well'
  );
  assert.strictEqual(
    view._targetOrigin,
    'https://app.redsift.com',
    'outbound pinned to referrer origin'
  );

  // ---- outbound pinning ----------------------------------------------------
  view.publish('topic-a', { x: 1 });
  assert.strictEqual(
    last(sent).targetOrigin,
    'https://app.redsift.com',
    'publish uses pinned origin'
  );
  assert.strictEqual(last(sent).msg.method, 'notifyController');

  // ---- oauth email hashing -------------------------------------------------
  view.showOAuthPopup({
    provider: 'google',
    options: { email: 'a@b.co', scope: 's' },
  });
  const oauth = last(sent).msg.params.value.options;
  assert.strictEqual(oauth.email, undefined, 'email replaced');
  assert.ok(/^[0-9a-f]{16}$/.test(oauth.subject), 'subject is 16 hex chars');
  assert.strictEqual(oauth.scope, 's', 'other options preserved');

  // a subject supplied next to the email must not override the derived hash
  view.showOAuthPopup({
    provider: 'google',
    options: { email: 'a@b.co', subject: 'supplied-not-derived' },
  });
  assert.ok(
    /^[0-9a-f]{16}$/.test(last(sent).msg.params.value.options.subject),
    'a supplied subject cannot overwrite the hashed email'
  );

  // ---- inbound origin filtering --------------------------------------------
  deliver('https://evil.example', {
    method: 'presentView',
    params: { pwned: true },
  });
  assert.strictEqual(presented, null, 'untrusted origin ignored');

  deliver('https://app.redsift.com', {
    method: 'presentView',
    params: { ok: true },
  });
  assert.deepStrictEqual(
    presented,
    { ok: true },
    'trusted origin dispatches sift-defined method'
  );

  // ---- inbound source filtering --------------------------------------------
  // A trusted origin is not enough: sibling frames and popups served from the
  // client's own origin can hold this frame's WindowProxy and post to it
  const rogueWindow = { postMessage: () => {} };
  presented = null;
  deliver(
    'https://app.redsift.com',
    { method: 'presentView', params: { rogue: true } },
    rogueWindow
  );
  assert.strictEqual(
    presented,
    null,
    'trusted origin from a non-embedding window is ignored'
  );

  // `MessageEvent.source` is null for anything that is not a window, so a
  // service worker, MessagePort or BroadcastChannel on this very origin could
  // otherwise drive the whole inbound protocol
  presented = null;
  deliver(
    'https://app.redsift.com',
    { method: 'presentView', params: { noSource: true } },
    null
  );
  assert.strictEqual(
    presented,
    null,
    'a message with no source (service worker, MessagePort) is ignored'
  );

  // the window itself is not a special case either — only the window this
  // view actually talks to
  presented = null;
  deliver(
    'https://app.redsift.com',
    { method: 'presentView', params: { self: true } },
    fakeWindow
  );
  assert.strictEqual(
    presented,
    null,
    'a self-posted message is ignored while embedded'
  );

  // ---- malformed payloads don't throw --------------------------------------
  deliver('https://app.redsift.com', null);
  deliver('https://app.redsift.com', 'just a string');
  deliver('https://app.redsift.com', { no: 'method' });
  deliver('https://app.redsift.com', { method: 42 });

  // ---- prototype methods not dispatchable ----------------------------------
  deliver('https://app.redsift.com', { method: 'constructor', params: {} });
  deliver('https://app.redsift.com', { method: 'hasOwnProperty', params: {} });
  deliver('https://app.redsift.com', { method: 'toString', params: {} });

  // ---- lifecycle methods not dispatchable -----------------------------------
  // 'destroy' must not be reachable via postMessage: the listener stays active
  deliver('https://app.redsift.com', { method: 'destroy' });
  presented = null;
  deliver('https://app.redsift.com', {
    method: 'presentView',
    params: { still: 'alive' },
  });
  assert.deepStrictEqual(
    presented,
    { still: 'alive' },
    'destroy is not message-dispatchable'
  );

  // the bound dispatcher alias must not be reachable either: it would let a
  // message re-enter dispatch carrying an `origin` field of its own choosing
  presented = null;
  deliver('https://app.redsift.com', { method: '_messageHandler' }); // no throw
  deliver('https://app.redsift.com', {
    method: '_messageHandler',
    params: {
      origin: 'https://app.redsift.com',
      data: { method: 'presentView', params: { reentered: true } },
    },
  });
  assert.strictEqual(
    presented,
    null,
    '_messageHandler is not message-dispatchable (no dispatch re-entry)'
  );
  deliver('https://app.redsift.com', { method: '_onWindowMessage' }); // no throw

  // the raw outbound emitters must not be drivable by an inbound message
  const sentBeforeReflect = sent.length;
  deliver('https://app.redsift.com', {
    method: 'publish',
    params: { topic: 'reflected' },
  });
  deliver('https://app.redsift.com', {
    method: 'notifyClient',
    params: { topic: 'reflected' },
  });
  assert.strictEqual(
    sent.length,
    sentBeforeReflect,
    'publish/notifyClient are not message-dispatchable'
  );

  // ---- handlers tolerate missing or null params ------------------------------
  deliver('https://app.redsift.com', { method: '_initPlugins' }); // no params
  deliver('https://app.redsift.com', { method: '_initPlugins', params: null });
  deliver('https://app.redsift.com', { method: '_receivePluginMessages' });
  deliver('https://app.redsift.com', { method: 'login' }); // destructuring must not throw
  deliver('https://app.redsift.com', { method: 'getPlugin' }); // no params
  deliver('https://app.redsift.com', {
    method: 'showOAuthPopup',
    params: null,
  });

  // ---- notifyView routes to controller observable --------------------------
  let received = null;
  view.controller.subscribe('t1', (v) => (received = v));
  deliver('https://app.redsift.com', {
    method: 'notifyView',
    params: { topic: 't1', value: 'hello' },
  });
  assert.strictEqual(
    received,
    'hello',
    'notifyView publishes to controller observable'
  );
  deliver('https://app.redsift.com', { method: 'notifyView', params: null }); // no throw

  // ---- plugins: init/dedupe + sync-history ----------------------------------
  view._initPlugins({ pluginConfigs: [{ id: 'sync-history' }] });
  view._initPlugins({ pluginConfigs: [{ id: 'sync-history' }] }); // replay
  assert.strictEqual(
    view._pluginManager.getActivePlugins().length,
    1,
    'replayed init does not duplicate plugins'
  );

  const historyCalls = [];
  const fakeHistory = {
    listen: function (fn) {
      fakeHistory._listener = fn;
      return () => {
        fakeHistory._listener = null;
      };
    },
    push: (p) => historyCalls.push(['push', p]),
    replace: (p) => historyCalls.push(['replace', p]),
  };
  // A truthy but unusable history must be rejected rather than handed to
  // .listen(). NOTE: the sync-history plugin has to be active for this to
  // reach the plugin's own guard at all.
  assert.ok(view.getPlugin({ id: 'sync-history' }), 'sync-history is active');
  deliver('https://app.redsift.com', {
    method: 'setupSyncHistory',
    params: { history: {} },
  });

  view.setupSyncHistory({ history: fakeHistory });

  // an unknown navigation action is ignored, not treated as push
  deliver('https://app.redsift.com', {
    method: '_receivePluginMessages',
    params: {
      messages: [
        {
          id: 'sync-history',
          data: { action: 'PUSHH', location: { pathname: '/x', search: '' } },
        },
      ],
    },
  });
  assert.strictEqual(historyCalls.length, 0, 'unknown action ignored');

  // client -> view POP is mirrored as replace (previously crashed: history.pop)
  deliver('https://app.redsift.com', {
    method: '_receivePluginMessages',
    params: {
      messages: [
        {
          id: 'sync-history',
          data: { action: 'POP', location: { pathname: '/p', search: '?q=1' } },
        },
      ],
    },
  });
  assert.deepStrictEqual(
    last(historyCalls),
    ['replace', '/p?q=1'],
    'POP mirrored as replace'
  );

  // the mirrored navigation must not echo back to the client (recursion guard)
  const sentBefore = sent.length;
  fakeHistory._listener({ pathname: '/p', search: '?q=1' }, 'REPLACE');
  assert.strictEqual(
    sent.length,
    sentBefore,
    'cloud-initiated navigation not echoed back'
  );

  // a user navigation IS reported, with the history v5 ({ location, action })
  // listener shape normalized to the flat shape the client expects
  fakeHistory._listener({
    location: { pathname: '/u', search: '' },
    action: 'PUSH',
  });
  assert.strictEqual(last(sent).msg.params.topic, 'sync-history');
  assert.strictEqual(
    last(sent).msg.params.value.pathname,
    '/u',
    'v5 listener shape flattened'
  );

  // plugin message routed to an ACTIVE plugin without onMessage must not
  // throw (track-ui-activity implements no onMessage); an unknown plugin id
  // is skipped as before
  view._initPlugins({ pluginConfigs: [{ id: 'track-ui-activity' }] });
  assert.strictEqual(view._pluginManager.getActivePlugins().length, 2);
  deliver('https://app.redsift.com', {
    method: '_receivePluginMessages',
    params: { messages: [{ id: 'track-ui-activity', data: {} }] },
  });
  deliver('https://app.redsift.com', {
    method: '_receivePluginMessages',
    params: { messages: [{ id: 'unknown-plugin', data: {} }] },
  });

  // ---- track-ui-activity: throttling and listener removal -------------------
  // Driven through the plugin's own lifecycle API — the same { context, global }
  // PluginManager passes — so the test controls the global and the clock.
  const activityPlugin = view.getPlugin({ id: 'track-ui-activity' });
  assert.ok(activityPlugin, 'track-ui-activity is active');

  const captureOf = (opts) => !!(opts === true || (opts && opts.capture));
  const globalListeners = [];
  const fakeGlobal = {
    addEventListener: (type, fn, opts) =>
      globalListeners.push({ type, fn, capture: captureOf(opts) }),
    // removal requires the capture flag to match, as the DOM does
    removeEventListener: (type, fn, opts) => {
      const capture = captureOf(opts);
      const index = globalListeners.findIndex(
        (l) => l.type === type && l.fn === fn && l.capture === capture
      );
      if (index !== -1) {
        globalListeners.splice(index, 1);
      }
    },
    dispatch: (type) =>
      globalListeners
        .filter((l) => l.type === type)
        .forEach((l) => l.fn({ type })),
  };
  const activityPings = [];
  const activityContext = {
    notifyClient: (topic, value) => activityPings.push({ topic, value }),
  };

  const realDateNow = Date.now;
  let clock = 1000000;
  Date.now = () => clock;
  try {
    activityPlugin.start({ context: activityContext, global: fakeGlobal });
    assert.deepStrictEqual(
      globalListeners.map((l) => l.type).sort(),
      ['click', 'keydown', 'mousedown', 'mousemove', 'scroll', 'touchstart'],
      'every activity event is listened for'
    );
    assert.ok(
      globalListeners.find((l) => l.type === 'scroll').capture,
      'scroll is captured, so it is seen from nested scrollers'
    );
    assert.strictEqual(
      activityPings.length,
      1,
      'the view having started counts as activity'
    );
    assert.strictEqual(last(activityPings).topic, 'track-ui-activity');

    // a burst inside the throttle window must not become a burst of messages
    for (let i = 0; i < 50; i += 1) {
      fakeGlobal.dispatch('mousemove');
      fakeGlobal.dispatch('scroll');
    }
    assert.strictEqual(
      activityPings.length,
      1,
      'activity is throttled, not one message per event'
    );

    // once the window has elapsed the next event reports again
    clock += 6000;
    fakeGlobal.dispatch('mousemove');
    assert.strictEqual(
      activityPings.length,
      2,
      'activity is reported again after the throttle window'
    );

    // stop() must remove every listener, the capture-phase scroll included
    activityPlugin.stop({ context: activityContext, global: fakeGlobal });
    assert.deepStrictEqual(
      globalListeners,
      [],
      'stop removes every activity listener'
    );

    clock += 60000;
    fakeGlobal.dispatch('mousemove');
    assert.strictEqual(
      activityPings.length,
      2,
      'a stopped plugin reports nothing'
    );
  } finally {
    Date.now = realDateNow;
  }

  // stopping plugins unsubscribes sync-history from the history object, so a
  // discarded instance cannot keep forwarding navigations
  deliver('https://app.redsift.com', { method: '_stopPlugins', params: {} });
  assert.strictEqual(
    view._pluginManager.getActivePlugins().length,
    0,
    'stop clears active plugins'
  );
  assert.strictEqual(
    fakeHistory._listener,
    null,
    'stop unsubscribes the history listener'
  );

  // a direct destroy() call (not via message) removes the message listener
  view.destroy();
  presented = null;
  deliver('https://app.redsift.com', {
    method: 'presentView',
    params: { after: 'destroy' },
  });
  assert.strictEqual(presented, null, 'destroy removes the message listener');

  // ---- origin policy edge cases ---------------------------------------------
  // An opaque referrer (file:, data:, sandboxed document) serializes its
  // origin as the literal "null"; trusting that would trust every opaque
  // context alike. With nothing else to go on the policy now refuses to
  // resolve rather than accepting and posting to any origin.
  fakeWindow.document.referrer = 'file:///tmp/sift.html';
  assert.throws(
    () => createSiftView({}),
    /Could not determine the client origin/,
    'an opaque referrer fails closed instead of falling back to any origin'
  );
  fakeWindow.document.referrer = 'https://app.redsift.com/home/abc';

  // An in-frame navigation makes document.referrer point at the *previous
  // document in this frame*, i.e. our own origin — it says nothing about the
  // client. Pinning to it would reject every inbound client message and have
  // the browser drop every outbound one, so it must be discarded as stale and
  // the channel kept alive under the legacy policy.
  fakeWindow.document.referrer = 'https://dmarc.sift.example/previous-page';
  assert.throws(
    () => createSiftView({}),
    /Could not determine the client origin/,
    'a self-referrer is not mistaken for the client, and fails closed'
  );
  // ...and the escape hatch is what keeps such a deployment working
  const optedOut = createSiftView({}, { clientOrigin: '*' });
  assert.strictEqual(
    optedOut._trustedOrigins,
    null,
    "clientOrigin '*' still opts out of pinning entirely"
  );
  assert.strictEqual(optedOut._targetOrigin, '*');
  optedOut.destroy();

  // Where location.ancestorOrigins exists (Chromium, WebKit) it is
  // authoritative and survives that same in-frame navigation
  fakeWindow.location.ancestorOrigins = ['https://app.redsift.com'];
  const ancestorView = createSiftView({});
  assert.strictEqual(
    ancestorView._targetOrigin,
    'https://app.redsift.com',
    'ancestorOrigins identifies the client despite a stale referrer'
  );
  assert.deepStrictEqual(
    ancestorView._trustedOrigins,
    ['https://app.redsift.com'],
    'ancestorOrigins identifies exactly the client to trust'
  );
  ancestorView.destroy();
  delete fakeWindow.location.ancestorOrigins;
  fakeWindow.document.referrer = 'https://app.redsift.com/home/abc';

  // A clientOrigin that yields no valid origin is a configuration error: the
  // sift asked for a restriction and must not silently get discovery instead
  assert.throws(
    () => createSiftView({}, { clientOrigin: 'htps://typo.example' }),
    /clientOrigin/,
    'an unparseable clientOrigin throws instead of falling back'
  );

  // an explicitly empty configuration is a misconfiguration too (an unset env
  // var arrives as ''), and must not silently fall through to discovery
  ['', null, []].forEach((value) => {
    assert.throws(
      () => createSiftView({}, { clientOrigin: value }),
      /clientOrigin/,
      `an explicitly empty clientOrigin (${JSON.stringify(value)}) throws`
    );
  });

  // ...but valid entries alongside an invalid one are still honoured
  const partialView = createSiftView(
    {},
    { clientOrigin: ['htps://typo.example', 'https://app.redsift.com'] }
  );
  assert.strictEqual(
    partialView._targetOrigin,
    'https://app.redsift.com',
    'valid clientOrigin entries survive an invalid one'
  );
  partialView.destroy();

  // With several allowed client origins, outbound must be pinned to the one
  // actually embedding this view — not blindly to the first entry, which the
  // browser would silently drop
  const multiView = createSiftView(
    {},
    { clientOrigin: ['https://other.example', 'https://app.redsift.com'] }
  );
  assert.strictEqual(
    multiView._targetOrigin,
    'https://app.redsift.com',
    'outbound pinned to the embedding client among allowed origins'
  );
  assert.ok(
    multiView._trustedOrigins.indexOf('https://other.example') !== -1,
    'all allowed origins stay trusted for inbound'
  );
  multiView.destroy();

  // ---- a view that is not embedded (standalone development) ----------------
  // `parent === window` there, so the window this view talks to is itself:
  // strict source equality must still accept its own posts, and the policy
  // must resolve to its own origin rather than failing closed.
  const selfPosts = [];
  fakeWindow.postMessage = (msg, targetOrigin) =>
    selfPosts.push({ msg, targetOrigin });
  fakeWindow.parent = fakeWindow;
  globalThis.parent = fakeWindow;

  let standalonePresented = null;
  const standaloneView = createSiftView({
    presentView(p) {
      standalonePresented = p;
    },
  });
  assert.deepStrictEqual(
    standaloneView._trustedOrigins,
    ['https://dmarc.sift.example'],
    'not embedded: trusts its own origin'
  );
  assert.strictEqual(
    standaloneView._targetOrigin,
    'https://dmarc.sift.example',
    'not embedded: outbound pinned to its own origin, never "*"'
  );
  deliver(
    'https://dmarc.sift.example',
    { method: 'presentView', params: { standalone: true } },
    fakeWindow
  );
  assert.deepStrictEqual(
    standalonePresented,
    { standalone: true },
    'not embedded: a self-posted client message still dispatches'
  );
  standaloneView.destroy();
  fakeWindow.parent = fakeParent;
  globalThis.parent = fakeParent;
  delete fakeWindow.postMessage;

  // ---- plugins receive only what they need ---------------------------------
  // The context handed to a plugin used to be the whole view. Both bundled
  // plugins only ever call `notifyClient`, so that is all they now get.
  const contextView = createSiftView({});
  let pluginContext = null;
  contextView._pluginManager._pluginFactory = [
    class Probe {
      static id = () => 'probe';
      static contexts = () => ['view'];
      init = ({ context }) => {
        pluginContext = context;
        return true;
      };
    },
  ];
  contextView._initPlugins({ pluginConfigs: [{ id: 'probe' }] });
  assert.deepStrictEqual(
    Object.keys(pluginContext),
    ['notifyClient'],
    'a plugin receives only notifyClient, not the whole view'
  );
  // and it is the pinned one, not a raw postMessage
  pluginContext.notifyClient('probe-topic', { via: 'plugin' });
  assert.strictEqual(
    last(sent).targetOrigin,
    'https://app.redsift.com',
    "the plugin's notifyClient is pinned like the view's"
  );
  assert.strictEqual(last(sent).msg.params.topic, 'probe-topic');
  contextView.destroy();

  // ---- SiftController in a fake worker scope --------------------------------
  const workerPosts = [];
  const workerListeners = [];
  const makeFakeWorkerScope = () => {
    // Clear posts too, so assertions are scoped to the controller under test
    // and `last(workerPosts)` cannot read a previous scope's message
    workerListeners.length = 0;
    workerPosts.length = 0;
    globalThis.self = {
      addEventListener: (type, fn) => workerListeners.push({ type, fn }),
      postMessage: (msg) => workerPosts.push(msg),
      close: () => {},
    };
  };
  const workerDeliver = (data) =>
    workerListeners.forEach(
      ({ type, fn }) => type === 'message' && fn({ data })
    );

  // loadView returning nothing must not throw, and must report failure
  makeFakeWorkerScope();
  createSiftController({
    loadView() {
      return undefined;
    },
  });
  workerDeliver({
    method: 'loadView',
    params: { type: 'summary', sizeClass: 'full' },
  });
  assert.strictEqual(
    last(workerPosts).method,
    'loadViewFailedCallback',
    'undefined result reported'
  );

  // a controller that implements no loadView at all must report failure
  // rather than leaving the host waiting for a callback that never comes
  makeFakeWorkerScope();
  createSiftController({});
  workerDeliver({
    method: 'loadView',
    params: { type: 'summary', sizeClass: 'full' },
  });
  assert.strictEqual(
    workerPosts.length,
    1,
    'missing loadView posts exactly one reply'
  );
  assert.strictEqual(
    last(workerPosts).method,
    'loadViewFailedCallback',
    'missing loadView reported'
  );

  // promise data: html-first callback, then data callback
  makeFakeWorkerScope();
  createSiftController({
    loadView() {
      return { html: 'index.html', data: Promise.resolve({ rows: 1 }) };
    },
  });
  workerDeliver({
    method: 'loadView',
    params: { type: 'summary', sizeClass: 'full' },
  });
  assert.strictEqual(last(workerPosts).method, 'loadViewCallback');
  assert.deepStrictEqual(
    last(workerPosts).params.result,
    { html: 'index.html' },
    'html-first'
  );
  await new Promise((r) => setTimeout(r, 0));
  assert.deepStrictEqual(
    last(workerPosts).params.result,
    { html: 'index.html', data: { rows: 1 } },
    'data callback after promise resolves'
  );

  // a rejected data promise is reported instead of leaving the view waiting.
  // The html still goes out first, so the client can already have loaded the
  // view by the time the failure arrives — the README documents that, and
  // this pins the ordering it describes.
  makeFakeWorkerScope();
  createSiftController({
    loadView() {
      return { html: 'index.html', data: Promise.reject(new Error('boom')) };
    },
  });
  workerDeliver({
    method: 'loadView',
    params: { type: 'summary', sizeClass: 'full' },
  });
  await new Promise((r) => setTimeout(r, 0));
  assert.deepStrictEqual(
    workerPosts.map((m) => m.method),
    ['loadViewCallback', 'loadViewFailedCallback'],
    'html is delivered before the rejection is reported'
  );
  assert.deepStrictEqual(workerPosts[0].params.result, { html: 'index.html' });
  assert.strictEqual(last(workerPosts).params.error.message, 'boom');

  // ...whereas with no html to send first, nothing precedes the failure, so
  // no view is loaded at all
  makeFakeWorkerScope();
  createSiftController({
    loadView() {
      return { data: Promise.reject(new Error('boom')) };
    },
  });
  workerDeliver({
    method: 'loadView',
    params: { type: 'summary', sizeClass: 'full' },
  });
  await new Promise((r) => setTimeout(r, 0));
  assert.deepStrictEqual(
    workerPosts.map((m) => m.method),
    ['loadViewFailedCallback'],
    'without html the failure is the only message'
  );

  // `loadView` is re-entrant: a host re-sends it when the size class or view
  // type changes, and the SDK relays every one. The README's quick start
  // guards its one-time setup because of this.
  makeFakeWorkerScope();
  let loadViewCalls = 0;
  createSiftController({
    loadView() {
      loadViewCalls += 1;
      return { html: 'index.html', data: { rows: loadViewCalls } };
    },
  });
  workerDeliver({
    method: 'loadView',
    params: { type: 'summary', sizeClass: 'full' },
  });
  workerDeliver({
    method: 'loadView',
    params: { type: 'summary', sizeClass: 'compact' },
  });
  assert.strictEqual(loadViewCalls, 2, 'every loadView reaches the sift');
  assert.strictEqual(last(workerPosts).params.sizeClass, 'compact');

  // malformed worker messages must not throw
  workerDeliver(null);
  workerDeliver({ method: 7 });
  workerDeliver({ method: 'proxy' }); // '_proxy' is not a function
  // the '_' prefix must not reach Object.prototype built-ins:
  // '_' + '_defineGetter__' would resolve to __defineGetter__
  workerDeliver({ method: '_defineGetter__', params: {} });
  workerDeliver({ method: '_defineSetter__', params: {} });
  workerDeliver({ method: '_lookupGetter__', params: {} });

  // internal machinery is not message-dispatchable: 'registerMessageListeners'
  // must not install a second listener, and parameterless protocol messages
  // must be ignored rather than crash the handler
  makeFakeWorkerScope();
  createSiftController({
    loadView() {
      return { html: 'index.html' };
    },
  });
  assert.strictEqual(workerListeners.length, 1);
  workerDeliver({ method: 'registerMessageListeners' });
  assert.strictEqual(
    workerListeners.length,
    1,
    'registerMessageListeners is not message-dispatchable'
  );
  const postsBefore = workerPosts.length;
  workerDeliver({ method: 'loadView' }); // no params
  workerDeliver({ method: 'loadView', params: null });
  workerDeliver({ method: 'init' }); // no params
  workerDeliver({ method: 'initPlugins', params: null }); // null params: defaults apply
  workerDeliver({ method: 'triggerSiftViewInit', params: {} });
  workerDeliver({ method: 'triggerSiftViewFailed', params: {} });
  assert.strictEqual(
    workerPosts.length,
    postsBefore,
    'malformed/internal controller messages are ignored'
  );

  // ---- EmailClientController guards ------------------------------------------
  const { createEmailClientController } = sdk;
  makeFakeWorkerScope();
  createEmailClientController({});
  assert.strictEqual(workerListeners.length, 1);
  workerDeliver({ method: 'registerMessageListeners' });
  assert.strictEqual(
    workerListeners.length,
    1,
    'email controller listener registration is not message-dispatchable'
  );
  workerDeliver({ method: 'emailStats' }); // no params: must not throw
  workerDeliver({ method: 'getThreadRowDisplayInfo' }); // no params: must not throw
  workerDeliver({ method: '_defineSetter__', params: {} }); // prototype built-in
  workerDeliver({ method: 'getThreadRowDisplayInfo', params: { tris: null } });
  // malformed tris entries must be skipped, not throw, and still answer
  const emailPostsBefore = workerPosts.length;
  workerDeliver({
    method: 'getThreadRowDisplayInfo',
    params: { tris: [null, { value: null }, { key: 'k', value: {} }] },
  });
  assert.strictEqual(workerPosts.length, emailPostsBefore + 1);
  assert.deepStrictEqual(last(workerPosts), {
    method: 'getThreadRowDisplayInfoCallback',
    params: {},
  });

  // ---- the React entry must never bundle React ------------------------------
  // A bundled second copy means useSiftView's hooks run against a dispatcher
  // the host app never populates. Published 2.0.3 did exactly that and threw
  // "Cannot read properties of null (reading 'useState')" on first use.
  const REACT_IMPL = /__SECRET_INTERNALS|ReactCurrentDispatcher/;
  const reactEsm = readFileSync(
    new URL('../dist/react.mjs', import.meta.url),
    'utf8'
  );
  assert.ok(
    /from ['"]react['"]/.test(reactEsm),
    'the React build imports react instead of bundling it'
  );
  assert.ok(!REACT_IMPL.test(reactEsm), 'no React implementation is bundled');
  console.log('All smoke tests passed.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
