/**
 * Helpers to establish which window origins a sift view trusts for
 * postMessage traffic with its embedding client, and to dispatch inbound
 * messages safely.
 */

export function originOf(url) {
  if (!url) {
    return null;
  }
  let origin;
  try {
    origin = new URL(url).origin;
  } catch (error) {
    return null;
  }
  return normalizeOrigin(origin);
}

/**
 * Resolves the origins trusted for inbound messages and the target origin
 * for outbound messages, in order of preference:
 *
 *  1. An explicit `clientOrigin` (string or array of strings) configured by
 *     the sift. Pass `'*'` to explicitly restore the legacy behaviour.
 *  2. The origin of `document.referrer` — for an embedded view this is the
 *     page that created the iframe, i.e. the client.
 *  3. The page's own origin when it is not embedded (development, tests).
 *
 * When none of these are available (embedded, but the client stripped the
 * referrer and no explicit origin was configured) the legacy behaviour is
 * kept — accept and post to any origin — with a warning, so existing
 * deployments keep working.
 *
 * `trustedOrigins === null` means "accept any origin".
 */
export function resolveMessagePolicy({ clientOrigin, win = window } = {}) {
  const own = ownOrigin(win);
  const explicit = []
    .concat(clientOrigin || [])
    .map((origin) => (origin === '*' ? '*' : originOf(origin)))
    .filter(Boolean);

  if (explicit.indexOf('*') !== -1) {
    return { trustedOrigins: null, targetOrigin: '*' };
  }
  const referrerOrigin = originOf(win.document && win.document.referrer);

  if (explicit.length > 0) {
    // Pin outbound messages to the origin actually embedding this view when
    // it is one of the allowed ones: with several allowed clients, pinning to
    // the first entry would have the browser silently drop every message
    const target =
      referrerOrigin && explicit.indexOf(referrerOrigin) !== -1
        ? referrerOrigin
        : explicit[0];
    return {
      trustedOrigins: withOwnOrigin(explicit, own),
      targetOrigin: target,
    };
  }

  if (referrerOrigin) {
    return {
      trustedOrigins: withOwnOrigin([referrerOrigin], own),
      targetOrigin: referrerOrigin,
    };
  }

  if (!isEmbedded(win) && own) {
    return { trustedOrigins: [own], targetOrigin: own };
  }

  if (!warnedLegacyFallback) {
    warnedLegacyFallback = true;
    console.warn(
      '[SiftSdkWeb] Could not determine the client origin (no clientOrigin option and no document.referrer). ' +
        'Falling back to the legacy behaviour of accepting and posting messages to any origin; ' +
        'pass { clientOrigin } to lock this down.'
    );
  }
  return { trustedOrigins: null, targetOrigin: '*' };
}

export function isTrustedOrigin(trustedOrigins, origin) {
  return trustedOrigins === null || trustedOrigins.indexOf(origin) !== -1;
}

/**
 * Methods on a sift view that an inbound message must never invoke, shared
 * by the class and the hook so the two cannot drift apart:
 *
 *  - teardown and dispatch machinery, which a message could use to silence
 *    or duplicate the channel;
 *  - the raw outbound emitters, which no host sends inbound (the view posts
 *    them), so a message must not make the view emit on its behalf.
 *
 * The user-facing helpers (`login`, `navigate`, ...) stay dispatchable: they
 * only ever notify the client that sent the message, and some hosts may rely
 * on driving them.
 */
export const NON_DISPATCHABLE_VIEW_METHODS = [
  'destroy',
  '_onWindowMessage',
  '_registerMessageListeners',
  'publish',
  'notifyClient',
];

/**
 * Resolves an inbound message method name to a callable on `target`.
 * Only functions defined by the SDK or the sift itself are callable —
 * never values inherited from Object.prototype (`constructor`,
 * `hasOwnProperty`, ...), never non-function properties, and never
 * methods named in `blockedMethods` (internal lifecycle/dispatch
 * machinery that is not part of the message protocol).
 */
export function resolveDispatchTarget(target, method, blockedMethods) {
  if (typeof method !== 'string' || method === 'constructor') {
    return null;
  }
  if (blockedMethods && blockedMethods.indexOf(method) !== -1) {
    return null;
  }
  const fn = target[method];
  if (typeof fn !== 'function' || fn === Object.prototype[method]) {
    return null;
  }
  return fn;
}

/**
 * Local functions
 */
let warnedLegacyFallback = false;

function ownOrigin(win) {
  try {
    return normalizeOrigin(win.location && win.location.origin);
  } catch (error) {
    return null;
  }
}

// Opaque origins — `file:`, `data:`, and documents in a sandbox without
// `allow-same-origin` — all serialize to the literal string "null" while
// *not* being same-origin with one another. Treating that as an origin would
// trust every opaque context alike (and pins an unusable target origin), so
// it is discarded and the caller falls back to the documented policy.
function normalizeOrigin(origin) {
  return origin && origin !== 'null' ? origin : null;
}

function withOwnOrigin(origins, own) {
  // The page's own origin is always part of its trust domain: same-origin
  // code can reach into the window directly anyway, and the legacy
  // iframe-controller architecture relays messages from a same-origin window.
  if (own && origins.indexOf(own) === -1) {
    return origins.concat(own);
  }
  return origins;
}

function isEmbedded(win) {
  try {
    return win.parent !== win;
  } catch (error) {
    return true;
  }
}
