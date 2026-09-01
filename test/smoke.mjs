// Smoke test for the built SDK bundle, run in Node with faked browser globals.
// Written for Node >= 12.17 (the engines minimum with unflagged ESM support).
import assert from 'assert';

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
  removeEventListener: () => {},
  location: { origin: 'https://dmarc.sift.example' },
  document: { referrer: 'https://app.redsift.com/home/abc' },
  parent: fakeParent,
};

globalThis.window = fakeWindow;
globalThis.document = fakeWindow.document;
globalThis.parent = fakeParent;

const deliver = (origin, data) =>
  windowListeners.forEach(
    ({ type, fn }) => type === 'message' && fn({ origin, data })
  );

async function main() {
  const sdk = await import('../dist/sift-sdk-web.esm.mjs');
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
    view._trustedOrigins.slice().sort(),
    ['https://app.redsift.com', 'https://dmarc.sift.example'],
    'trusts referrer origin + own origin'
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

  // ---- malformed payloads don't throw --------------------------------------
  deliver('https://app.redsift.com', null);
  deliver('https://app.redsift.com', 'just a string');
  deliver('https://app.redsift.com', { no: 'method' });
  deliver('https://app.redsift.com', { method: 42 });

  // ---- prototype methods not dispatchable ----------------------------------
  deliver('https://app.redsift.com', { method: 'constructor', params: {} });
  deliver('https://app.redsift.com', { method: 'hasOwnProperty', params: {} });
  deliver('https://app.redsift.com', { method: 'toString', params: {} });

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
    },
    push: (p) => historyCalls.push(['push', p]),
    replace: (p) => historyCalls.push(['replace', p]),
  };
  view.setupSyncHistory({ history: fakeHistory });

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

  // plugin message routed to a plugin without onMessage must not throw
  deliver('https://app.redsift.com', {
    method: '_receivePluginMessages',
    params: { messages: [{ id: 'unknown-plugin', data: {} }] },
  });

  // ---- SiftController in a fake worker scope --------------------------------
  const workerPosts = [];
  const workerListeners = [];
  const makeFakeWorkerScope = () => {
    workerListeners.length = 0;
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

  // a rejected data promise is reported instead of leaving the view waiting
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
  assert.strictEqual(last(workerPosts).method, 'loadViewFailedCallback');
  assert.strictEqual(last(workerPosts).params.error.message, 'boom');

  // malformed worker messages must not throw
  workerDeliver(null);
  workerDeliver({ method: 7 });
  workerDeliver({ method: 'proxy' }); // '_proxy' is not a function

  console.log('All smoke tests passed.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
