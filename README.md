# @redsift/sift-sdk-web

SDK for building the web front end of a **sift** — a Red Sift app that runs
inside the Red Sift Cloud shell.

A sift's front end is two halves that never talk to each other directly:

```
                    ┌─────────────────────────────────┐
                    │   client shell (Red Sift Cloud) │
                    │      relays every message       │
                    └───────┬──────────────────┬──────┘
        window.postMessage  │                  │  Worker.postMessage
        (cross-origin)      │                  │  (client's own origin)
                    ┌───────▼───────┐   ┌──────▼──────────┐
                    │  <iframe>     │   │  Web Worker     │
                    │  the view     │   │  the controller │
                    │  SiftView     │   │  SiftController │
                    │  useSiftView  │   │                 │
                    └───────────────┘   └─────────────────┘
```

- The **view** is a page served from the sift's own origin and embedded in an
  iframe. It renders the UI.
- The **controller** is a Web Worker created by the client from the sift's
  controller bundle. It owns data access (`SiftStorage`, backed by IndexedDB)
  and prepares what the view renders.
- The **client** is the shell that hosts both. It brokers every message
  between the two halves, and owns everything the sift itself cannot do:
  OAuth popups, billing, top-level navigation, browser history.

This package is the library both halves are built on: it owns the wire
protocol, the message security, and the plugin system.

## Contents

- [Install](#install)
- [Entry points](#entry-points)
- [Quick start](#quick-start)
- [Lifecycle](#lifecycle)
- [Protocol reference](#protocol-reference)
- [API reference](#api-reference)
- [Origin and message security](#origin-and-message-security)
- [Plugins](#plugins)
- [TypeScript](#typescript)
- [Upgrading to 3.0](#upgrading-to-30)
- [Upgrading from 2.0.x](#upgrading-from-20x)
- [Development](#development)

## Install

```sh
npm install @redsift/sift-sdk-web
```

React is an **optional peer dependency** (`>=16.13.1`) — install it only if you
use the [`useSiftView`](#usesiftviewprops) hook. It is never bundled into the
SDK, so your app's copy of React is the one the hook uses.

The package declares `engines` of Node ≥ 18.18 and npm ≥ 9. The published
bundles are ES modules with no CommonJS or UMD build — use a bundler, or
native ESM.

## Entry points

| Import                        | Contents                                                                                                      |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `@redsift/sift-sdk-web`       | `SiftView`, `SiftController`, `SiftStorage`, `EmailClientController`, and the `create*`/`register*` factories |
| `@redsift/sift-sdk-web/react` | `useSiftView`                                                                                                 |

Type declarations ship with the package and are wired up through the `exports`
map, so `import type` works with `moduleResolution` of `bundler`, `node16` or
`nodenext` without a `@types` package.

## Quick start

### The controller (Web Worker)

```js
import { createSiftController } from '@redsift/sift-sdk-web';

createSiftController({
  // Required. Return the view's HTML entry point and its data. `data` may be
  // a promise: the SDK sends the HTML immediately and the data when it
  // resolves, so the view can render its shell while the query runs.
  loadView: function ({ type, sizeClass, params }) {
    // One-time setup, guarded: `loadView` can be called more than once in a
    // worker's lifetime (a host re-sends it when the view's size class or
    // type changes), and each call would otherwise add another subscriber.
    //
    // It is still the earliest place this can go: `this.storage` is created
    // when the client's `init` message is handled, whereas a method named
    // `init` on this object runs at *construction*, before that.
    if (!this._subscribed) {
      this._subscribed = true;

      this.storage.subscribe('*', (buckets) => {
        this.publish('data-changed', { buckets });
      });

      // Messages the view published with `publish`.
      this.view.subscribe('refresh', () => this.publish('data-changed', {}));
    }

    return {
      html: 'index.html',
      data: this.storage.getAll({ bucket: 'summary' }),
    };
  },
});
```

If `loadView` throws, returns something that is not an object, or returns a
`data` promise that rejects, the SDK reports `loadViewFailedCallback` to the
client rather than leaving the view waiting for data that never arrives.

### The view (class)

```js
import { createSiftView } from '@redsift/sift-sdk-web';

const view = createSiftView(
  {
    init: function () {
      // Messages the controller published with `publish`.
      this.controller.subscribe('data-changed', () => this.render());
    },

    // Called by the client with whatever the controller's `loadView` resolved.
    presentView: function (params) {
      this.data = params.data;
      this.render();
    },

    render: function () {
      // ...
    },
  },
  // Pin the protocol to the client's origin. Optional where the host lets the
  // origin be discovered, required otherwise — construction throws rather
  // than running unpinned. See "Origin and message security".
  { clientOrigin: 'https://app.redsift.io' }
);

// Ask the client to do something only it can do:
document.querySelector('#login').onclick = () =>
  view.login({ redirectUri: '/' });
```

### The view (React)

```jsx
import { useEffect, useState } from 'react';
import { useSiftView } from '@redsift/sift-sdk-web/react';

export default function App() {
  const [params, siftView] = useSiftView({
    clientOrigin: 'https://app.redsift.io',
  });
  const [changed, setChanged] = useState(null);

  useEffect(() => {
    // Handle the controller's message locally. Answering it with a `publish`
    // back to the controller would loop forever: the controller's `refresh`
    // handler publishes `data-changed`, which arrives here again.
    const onChange = (message) => setChanged(message);
    siftView.controller.subscribe('data-changed', onChange);
    return () => siftView.controller.unsubscribe('data-changed', onChange);
  }, [siftView]);

  // `params` is null until the client sends `presentView`.
  if (!params) return <Spinner />;

  return (
    <Dashboard
      data={params.data}
      changed={changed}
      // A user action is a fresh cause, so this one is safe to publish
      onRefresh={() => siftView.publish('refresh')}
      onLogin={() => siftView.login({ redirectUri: '/' })}
    />
  );
}
```

`siftView` is referentially stable across renders, so it is safe in dependency
arrays. The hook registers the window message listener for the life of the
component and, on unmount, removes it and stops any plugins it started.

## Lifecycle

The client drives the whole sequence; both halves only respond.

| #   | Direction           | Message                                              | What happens                                                                                                            |
| --- | ------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| 1   | client → controller | `init`                                               | The SDK opens the sift's storage, then replies `initCallback`.                                                          |
| 2   | client → controller | `initPlugins`, `loadView`, `startPlugins`            | Sent on `initCallback`. Your `loadView({ type, sizeClass, params })` runs.                                              |
| 3   | controller → client | `loadViewCallback`                                   | Carries `{ html, data }`. Sent twice when `html` accompanies a `data` promise: once with the HTML, again with the data. |
| 4   | client → view       | _(iframe `src` set to the sift's web root + `html`)_ | The view page loads and constructs `SiftView` / mounts the hook.                                                        |
| 5   | client → view       | `_initPlugins`, `presentView`, `_startPlugins`       | Sent on iframe load. Your `presentView(params)` runs, `params.data` being what step 3 delivered.                        |

After that the channel is bidirectional and event-driven: the view publishes to
the controller and notifies the client, the controller publishes to the view,
and the client pushes storage updates and plugin messages in.

If `loadView` fails at step 2 the client receives `loadViewFailedCallback`,
but whether a view was already loaded depends on how it failed. A throw, a
return that is not an object, or a rejecting `data` promise with no `html`
means no `loadViewCallback` was ever sent, so no view is loaded. When `html`
accompanies a `data` promise, though, the HTML goes out as soon as `loadView`
returns — so the client may already have loaded the view by the time the
rejection arrives, leaving it showing its shell with no data. Do not assume
failure precedes view creation.

## Protocol reference

Every message is a structured-clonable object with a `method` naming the
operation. Most also carry a `params`, but that is a convention rather than a
guarantee — `initCallback` puts its payload in `result` — so the tables below
name each message's payload field rather than promising one shape. They list
the complete set the SDK handles or sends; a sift never needs to construct one
by hand.

### Client → controller

Dispatch rule: an inbound method `x` is handled by the controller's `_x`.
Unknown methods are warned about once each (another controller may share the
worker scope).

| `method`           | `params`                              | Effect                                                                                           |
| ------------------ | ------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `init`             | `{ accountGuid, siftGuid, dbSchema }` | Creates `this.storage`; replies `initCallback`.                                                  |
| `initPlugins`      | `{ pluginConfigs }`                   | Initialises plugins whose contexts include `controller`.                                         |
| `startPlugins`     | `{ pluginConfigs }`                   | Starts them.                                                                                     |
| `stopPlugins`      | `{ pluginConfigs }`                   | Stops them and clears the active set.                                                            |
| `loadView`         | `{ client, type, sizeClass, data }`   | Calls your `loadView({ type, sizeClass, params: data })`. May arrive more than once — see below. |
| `storageUpdated`   | `string[]` of bucket names            | Publishes `'*'` with the array on `this.storage`, then each bucket name.                         |
| `notifyController` | `{ topic, value }`                    | Publishes `topic` on `this.view`.                                                                |
| `emailComposer`    | `{ topic, value }`                    | Publishes `topic` on `this.emailclient`.                                                         |
| `terminate`        | —                                     | `self.close()`.                                                                                  |

`loadView` is not once-per-worker: the legacy `iframe-controller` host sends it
again whenever the size class or view type changes, and the SDK relays each one
straight to your `loadView`. Guard anything in there that must happen only once
— subscriptions especially, since nothing de-duplicates a fresh closure.

`EmailClientController` handles two more: `emailStats` (`{ name, value }` →
your `onstats`) and `getThreadRowDisplayInfo` (`{ tris, supportedTemplates }` →
your `loadThreadListView`, answered with `getThreadRowDisplayInfoCallback`).

### Controller → client

| `method`                 | Payload                                                           | Sent by                                                               |
| ------------------------ | ----------------------------------------------------------------- | --------------------------------------------------------------------- |
| `initCallback`           | `result`: the `init` params                                       | the SDK, after storage is open                                        |
| `loadViewCallback`       | `params: { user, sift, type, sizeClass, result: { html, data } }` | the SDK, when `loadView` succeeds                                     |
| `loadViewFailedCallback` | `params: { user, sift, type, sizeClass, error: { message } }`     | the SDK, when `loadView` throws, returns a non-object, or rejects     |
| `notifyView`             | `params: { topic, value }`                                        | `controller.publish(topic, value)` — the client relays it to the view |
| `notifyClient`           | `params: { topic, value }`                                        | `controller.emailclient.goto(...)` / `.close()`                       |

### Client → view

Dispatch rule: the method name is looked up directly on your view instance, so
`presentView` calls `presentView`. Internal lifecycle and outbound-only methods
are never dispatchable — see [the dispatch
denylist](#what-an-inbound-message-cannot-do).

| `method`                 | `params`                            | Effect                                                                               |
| ------------------------ | ----------------------------------- | ------------------------------------------------------------------------------------ |
| `presentView`            | `{ client, type, sizeClass, data }` | Your `presentView`. With the hook, becomes the returned `params`.                    |
| `willPresentView`        | `{ client, type, sizeClass }`       | Your optional `willPresentView`, or the hook's `willPresentView` prop.               |
| `notifyView`             | `{ topic, value }`                  | Publishes `topic` on `view.controller`. Handled by the SDK, not dispatched.          |
| `_initPlugins`           | `{ pluginConfigs }`                 | Initialises plugins whose contexts include `view`.                                   |
| `_startPlugins`          | `{ pluginConfigs }`                 | Starts them.                                                                         |
| `_stopPlugins`           | `{ pluginConfigs }`                 | Stops them and clears the active set.                                                |
| `_receivePluginMessages` | `{ messages: [{ id, data }] }`      | Routes each message to the active plugin with that `id`.                             |
| anything else            | any                                 | Called on your view instance if it is a dispatchable method; otherwise warned about. |

`willPresentView` is a round trip rather than part of the boot sequence: both
known clients send it only in response to a raw `{ method: 'willPresentView' }`
message from the frame, and the SDK exposes no helper for that outbound half.
Treat it as optional — do not depend on it firing.

### View → client

| `method`           | `params`           | Sent by                                                               |
| ------------------ | ------------------ | --------------------------------------------------------------------- |
| `notifyController` | `{ topic, value }` | `view.publish(topic, value)` — the client relays it to the controller |
| `notifyClient`     | `{ topic, value }` | `view.notifyClient(topic, value)` and every helper below              |

Topics the SDK sends through `notifyClient`:

| Topic                  | `value`                                                                  | Sent by                        |
| ---------------------- | ------------------------------------------------------------------------ | ------------------------------ |
| `showOAuthPopup`       | `{ provider, options }`                                                  | `showOAuthPopup`               |
| `showOAuthRemovePopup` | `{ provider, options }`                                                  | `removeOAuthIdentity`          |
| `signup`               | `{}`                                                                     | `signup`                       |
| `login`                | `{ redirectUri }`                                                        | `login`                        |
| `logout`               | `{}`                                                                     | `logout`                       |
| `navigate`             | `{ href, openInNewTab }`                                                 | `navigate`                     |
| `sync-history`         | the router location's own fields (`pathname`, `search`, …) plus `action` | the `sync-history` plugin      |
| `track-ui-activity`    | `{}`                                                                     | the `track-ui-activity` plugin |

Anything else the client understands — product-specific topics such as billing
or chat panels — goes through `notifyClient(topic, value)` directly. Keep
`value` a plain object or omit it: the Red Sift client rejects arrays and
primitives.

### Pub/sub, in one line

Each half **publishes on its own object** and **subscribes to the other half's**:

|            | to reach the other half            | to hear from the other half            |
| ---------- | ---------------------------------- | -------------------------------------- |
| view       | `view.publish(topic, value)`       | `view.controller.subscribe(topic, fn)` |
| controller | `controller.publish(topic, value)` | `controller.view.subscribe(topic, fn)` |

Nothing de-duplicates this channel, so do not answer a message from the other
half with a message back to it — the two handlers will publish at each other
indefinitely. Handle what arrives locally, and publish only on a fresh cause: a
user action, a storage change, a request from the client.

## API reference

### `createSiftView(instanceMethods, options)`

Builds a `SiftView` subclass with `instanceMethods` on its prototype, and
returns an instance. If `instanceMethods.init` is a function it is called at
construction. `options` is passed to the `SiftView` constructor.

`createSiftController(instanceMethods, options)` and
`createEmailClientController(instanceMethods, options)` work the same way.

`registerSiftView`, `registerSiftController` and
`registerEmailClientController` are deprecated no-ops kept for compatibility;
they only log.

### `class SiftView`

`new SiftView({ clientOrigin })` — see [Origin and message
security](#origin-and-message-security) for `clientOrigin`.

| Member                                             | Description                                                                                                                                                                   |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `controller`                                       | `Observable` of messages the controller published.                                                                                                                            |
| `publish(topic, value)`                            | Relays a message to the controller, via the client.                                                                                                                           |
| `notifyClient(topic, value)`                       | Sends a topic the client itself acts on. This is what applies the origin pinning — prefer it over reaching for `parent.postMessage`.                                          |
| `destroy()`                                        | Removes the window message listener and stops active plugins. Call it if the view is torn down without a page unload.                                                         |
| `showOAuthPopup({ provider, options })`            | Opens the client's OAuth flow. An `options.email` is replaced by `options.subject`, a truncated SHA-256 of it, so the raw address does not travel through the redirect chain. |
| `removeOAuthIdentity({ provider, options })`       | Opens the client's identity-removal flow.                                                                                                                                     |
| `signup()` / `login({ redirectUri })` / `logout()` | Account actions, performed by the client.                                                                                                                                     |
| `navigate({ href, openInNewTab })`                 | Top-level navigation, performed by the client.                                                                                                                                |
| `setupSyncHistory({ history, initialPath })`       | Connects a history object to the `sync-history` plugin. Requires that plugin to be enabled.                                                                                   |
| `getPlugin({ id })`                                | The active plugin instance with that id, or `undefined`.                                                                                                                      |

Implement `presentView(params)`, and optionally `willPresentView(params)`.

### `class SiftController`

| Member                  | Description                                                                                                                                                                                                                      |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `view`                  | `Observable` of messages the view published.                                                                                                                                                                                     |
| `storage`               | `SiftStorage`. Created when the client's `init` message is handled, so `loadView` is the earliest place to use it — a method named `init` on the object passed to `createSiftController` runs at construction, before it exists. |
| `emailclient`           | `EmailClient`: `goto(params)`, `close()`, plus `Observable`.                                                                                                                                                                     |
| `publish(topic, value)` | Relays a message to the view, via the client.                                                                                                                                                                                    |

Implement `loadView({ type, sizeClass, params })`, returning
`{ html, data }`. `data` may be a promise.

### `class SiftStorage`

An `Observable` wrapper over [`@redsift/rs-storage`](https://www.npmjs.com/package/@redsift/rs-storage):
`get`, `getIndexKeys`, `getIndex`, `getWithIndex`, `getAllKeys`, `getAll`,
`getUser`, `putUser`, `delUser` — each taking a query object and returning a
promise. Subscribe to `'*'` for every change (the message is the array of
changed buckets) or to a bucket name for that bucket.

### `class EmailClientController`

For email-client integrations. Implement `onstats(name, value)` and
`loadThreadListView(list, supportedTemplates)`; the SDK answers the client's
`getThreadRowDisplayInfo` with whatever `loadThreadListView` returns, keyed by
thread.

### `useSiftView(props?)`

```js
const [params, siftView] = useSiftView({ willPresentView, clientOrigin });
```

Returns the client's `presentView` params (`null` until they arrive) and the
same API as `SiftView` apart from `destroy()`, which the hook's own cleanup
covers. `willPresentView` is a prop rather than a method, and the latest one
passed is always the one called.

## Origin and message security

The view is cross-origin to the client, so both directions of the window
channel are checked.

**Outbound** messages are posted to a single resolved target origin rather than
`'*'`, so the client is the only window that can read them.

**Inbound** messages must clear three checks before anything is dispatched:

1. `event.origin` is one of the trusted origins;
2. `event.source` **is** the embedding window — a trusted origin is not enough
   on its own, because sibling frames and popups on the client's origin can
   hold a reference to this frame and post to it. Strict equality, with no
   exception for an absent `source` and none for a self-post: cross-document
   `postMessage` sets `source` to the sending window, and it is null only when
   that window has since been discarded, so those exceptions covered a closed
   sender and this window posting to itself — neither of which a client does.
   A view that is not embedded still works, since `parent === window` there;
3. the payload is an object with a string `method`.

### How the origin is resolved

`clientOrigin` accepts a string or an array of strings.

| Situation                                                 | Trusted origins        | Outbound target                                                   |
| --------------------------------------------------------- | ---------------------- | ----------------------------------------------------------------- |
| `clientOrigin` given                                      | those origins          | the embedding origin when it is one of them, else the first entry |
| omitted, `location.ancestorOrigins` available             | the embedding origin   | the embedding origin                                              |
| omitted, no `ancestorOrigins`, usable `document.referrer` | the referrer's origin  | the referrer's origin                                             |
| omitted, not embedded                                     | this page's own origin | this page's own origin                                            |
| `clientOrigin: '*'`                                       | any                    | `'*'`                                                             |
| nothing resolvable                                        | **throws**             | **throws**                                                        |

The trusted set is exactly the client — this page's own origin is not added to
it. With the source check below requiring the embedding window, a message from
anywhere else on this origin is rejected regardless, so listing it would widen
the set for nothing.

**An unresolvable origin fails closed.** Earlier versions fell back to
accepting and posting to any origin, which kept a broken deployment working at
the cost of running unpinned — and nothing looked wrong while every message was
readable by any embedder. It now throws, and the escape hatch is explicit:
`clientOrigin: '*'` restores the unpinned behaviour, so an operator can unbreak
production without a code change.

Two cases make an origin unresolvable, and both are deliberate:

- **Opaque origins** — `file:`, `data:`, and sandboxed documents without
  `allow-same-origin` — all serialize to the literal string `"null"` while not
  being same-origin with one another. Treating that as an origin would trust
  every opaque context alike, so it is discarded.
- **A stale referrer.** `document.referrer` identifies the embedding page only
  for the frame's _initial_ navigation. Once the view navigates itself the
  referrer becomes the previous document in the same frame, which says nothing
  about the client. A referrer on the view's own origin is therefore discarded
  as stale rather than pinned to, which would make the browser drop every
  message in both directions.

So a host keeps discovery working by granting the frame `allow-same-origin`
(its origin is then not opaque) and by not stripping the referrer — a
`Referrer-Policy` of `no-referrer` on the embedding page leaves Firefox, which
has no `ancestorOrigins`, with nothing to go on. **If your view navigates
in-frame, pass `clientOrigin` explicitly**, for the same reason.

Passing a `clientOrigin` that yields no valid origin **throws** as well. A sift
that asks for a restriction must not silently get origin discovery instead.
Individual unparseable entries in an array are logged and skipped; only an
entirely empty result throws.

### What an inbound message cannot do

Message dispatch resolves a method name on your view instance, so it is
constrained on purpose:

- `constructor`, non-functions, and anything inherited from
  `Object.prototype` (`hasOwnProperty`, `__defineGetter__`, …) never resolve;
- `destroy`, `_onWindowMessage`, `_messageHandler` and
  `_registerMessageListeners` are blocked, so a message cannot silence,
  duplicate or re-enter the channel;
- `publish` and `notifyClient` are blocked, so a message cannot make the view
  emit on its behalf. The user-facing helpers (`login`, `navigate`, …) stay
  dispatchable: they only ever notify the client that sent the message.

The controller side is equivalent. Its `_`-prefix rule means a method name of
`_defineGetter__` would otherwise resolve to `Object.prototype.__defineGetter__`;
`_registerMessageListeners`, `_triggerSiftViewInit` and
`_triggerSiftViewFailed` are blocked outright.

## Plugins

Plugins are enabled by the **client**, not by the sift, through the
`pluginConfigs` on the `initPlugins` / `_initPlugins` messages:

```js
// the client's side, for reference — a sift does not send this itself
const params = {
  pluginConfigs: [{ id: 'sync-history' }, { id: 'track-ui-activity' }],
};
```

A plugin only initialises in a context it declares, is never initialised twice
for the same id, and is dropped from the active set when stopped — a later
init/start cycle recreates it.

A plugin's `context` is `{ notifyClient }` and nothing more, so it can send
topics to the client — pinned, like the view's own — without reaching the rest
of the view's surface.

| Plugin id           | Contexts | What it does                                                |
| ------------------- | -------- | ----------------------------------------------------------- |
| `sync-history`      | `view`   | Two-way sync between the view's router and the browser URL. |
| `track-ui-activity` | `view`   | Reports that the user is active in the view.                |

### `sync-history`

Call `setupSyncHistory({ history, initialPath })` once the plugin is running,
passing your router's history object:

```js
view.setupSyncHistory({ history: myHistory, initialPath: '/summary' });
```

Navigations inside the view are forwarded to the client as the `sync-history`
topic, and the client's own navigations arrive as plugin messages and are
applied to your history. Compatible with react-router v3 (action inside the
navigation op), react-router v4/v5 (action as a second argument), and the
`history` v5 `{ location, action }` shape.

A `POP` from the client — the user pressed back or forward, so the client has
already moved — is applied with `replace`, not `push`, so it does not add a
duplicate entry inside the view. A missing action defaults to `push`; an
unrecognised one is rejected with a warning. Navigations echoed back from the
client are suppressed, so the two histories do not drive each other in a loop.

### `track-ui-activity`

Reports `mousemove`, `mousedown`, `touchstart`, `click`, `keydown` and
capture-phase `scroll` as a single `track-ui-activity` topic, throttled to one
message every 5 seconds — activity is an on/off signal, so there is no point
crossing the frame boundary per event. Listeners are registered passively and
all of them, including the capture-phase `scroll`, are removed on stop.

## TypeScript

The declarations are hand-written and cover the whole public surface. The
factories are generic, so methods you pass in are visible on the result:

```ts
import { createSiftView, type PresentViewParams } from '@redsift/sift-sdk-web';

const view = createSiftView({
  presentView(params: PresentViewParams) {
    /* ... */
  },
  render() {
    /* ... */
  },
});

view.render(); // known to exist
```

Because the declarations are hand-written they can drift from the JavaScript,
so `test/types/api.test-d.ts` exercises the public surface and `npm run
typecheck` runs in CI — the drift is a build failure, not a surprise at
install time.

## Upgrading to 3.0

The origin model changed in ways that can turn a previously "working" view
into a loud failure. That is the point — the failure was already there, just
silent.

- **An unresolvable client origin now throws** instead of falling back to
  accepting and posting to any origin. If a view constructs and immediately
  throws `Could not determine the client origin`, the host is not giving it
  anything to discover: grant the frame `allow-same-origin`, stop stripping the
  referrer, or pass `clientOrigin` explicitly. `clientOrigin: '*'` restores the
  old unpinned behaviour if you need production working first.
- **`event.source` is now checked strictly.** A message whose `source` is not
  the embedding window is dropped, including one with no `source` at all. If
  anything in your view was driving the protocol by posting to its own window,
  or by synthesising a `message` event, it will stop being delivered.
- **The trusted set no longer includes your own origin.** It is exactly the
  client. Nothing legitimate relied on this once the source check is strict.
- **Plugins receive `{ notifyClient }`, not the whole view.** Only relevant if
  you wrote a plugin against the internal context object. It is still the
  view's own `notifyClient`, so a sift that overrides that method still sees
  what its plugins send.

Nothing else in the API changed, and `SiftView` and `useSiftView` are now the
same implementation underneath, so they cannot disagree about any of it.

## Upgrading from 2.0.x

- **ESM only.** The package publishes `.mjs` bundles and an `exports` map. The
  2.0.3 UMD build was not usable as a UMD build in the first place: loaded via
  a script tag it threw `ReferenceError: require is not defined`. Import the
  package from a bundler or native ESM instead.
- **React is no longer bundled.** In 2.0.3 the React entry point bundled its
  own copy of React and threw
  `TypeError: Cannot read properties of null (reading 'useState')` when used.
  React is now an optional peer dependency and your app's copy is used.
- **Origins are pinned by default.** Outbound messages went to `'*'` and
  inbound messages were accepted from any origin. They are now resolved as
  described above. Pass `clientOrigin: '*'` to restore the old behaviour if a
  deployment needs it, and prefer passing the real origin.
- **New:** `destroy()` on `SiftView`, plugin cleanup on hook unmount, and
  bundled type declarations.

## Development

Developing this package needs a newer Node than using it does: eslint 10
requires `^20.19.0 || ^22.13.0 || >=24`, which `devEngines.runtime` declares so
npm warns on a version that will not work. The `engines` floor stays at Node
18.18 because that is the consumer contract — nothing in the published bundles
needs more, and eslint is never installed by a consumer.

```sh
npm ci
npm run lint        # eslint (flat config)
npm run typecheck   # tsc --noEmit over the declarations and their tests
npm test            # builds, then runs the three test suites below
npm run build       # rollup, ESM bundles into dist/
npm run format      # prettier
```

All three suites run against the **built bundles**, not the sources, so they
cover the packaging as well as the behaviour:

- `test/smoke.mjs` — origin and source filtering, malformed payloads, the
  dispatch denylists, plugin lifecycle and cleanup, the controller's load-view
  paths and callback ordering, and the assertion that React is not bundled.
- `test/export-parity.mjs` — every value the declarations export exists at
  runtime, and every runtime export is declared. Compiling the type test cannot
  catch that direction, since it only contains code that should compile.
- `test/hook-parity.mjs` — renders `useSiftView` for real (server-side, so the
  render phase runs) and checks that it exposes the same members as `SiftView`
  and puts identical messages on the wire. Both are wiring over
  `src/lib/view-core.js`; this is what keeps them from drifting apart again.

Releases are tag-driven. CI publishes on a `vX.Y.Z` tag and fails if the tag
does not match the version in `package.json`; pushes to branches only build.

## License

MIT
