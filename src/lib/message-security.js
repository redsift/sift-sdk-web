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
 *     Supplying a value that yields no valid origin throws: a sift asking
 *     for a restriction must not silently get discovery instead.
 *  2. For an embedded view, the origin of the window embedding it — see
 *     `embeddingOrigin` for how that is established and why the referrer
 *     alone is not enough.
 *  3. The page's own origin when it is not embedded (development, tests).
 *
 * When none of these can be established the legacy behaviour is kept —
 * accept and post to any origin — with a warning, so existing deployments
 * keep working rather than losing the channel.
 *
 * `trustedOrigins === null` means "accept any origin".
 */
export function resolveMessagePolicy({ clientOrigin, win = window } = {}) {
  const own = ownOrigin(win);
  // `undefined` means the option was omitted; anything else — including '',
  // null and [] — is an explicit configuration that must yield an origin
  const configured = clientOrigin !== undefined;
  const supplied = configured ? [].concat(clientOrigin) : [];
  const explicit = [];
  supplied.forEach((origin) => {
    const normalized = origin === '*' ? '*' : originOf(origin);
    if (normalized) {
      explicit.push(normalized);
    } else {
      console.error(
        '[SiftSdkWeb] Ignoring an invalid `clientOrigin` entry:',
        origin
      );
    }
  });
  // A sift that supplies `clientOrigin` is asking for a restriction. Dropping
  // an unparseable value and quietly discovering the origin instead would
  // defeat exactly what it configured, so fail loudly rather than fall
  // through to discovery or the wildcard fallback.
  if (configured && explicit.length === 0) {
    throw new Error(
      '[SiftSdkWeb] `clientOrigin` was supplied but contained no valid origin: ' +
        JSON.stringify(supplied)
    );
  }

  if (explicit.indexOf('*') !== -1) {
    return { trustedOrigins: null, targetOrigin: '*' };
  }

  // The origin of the window this view talks to: the embedding client when
  // embedded, otherwise this page itself
  const client = isEmbedded(win) ? embeddingOrigin(win, own) : own;

  if (explicit.length > 0) {
    // Pin outbound messages to the origin actually embedding this view when
    // it is one of the allowed ones: with several allowed clients, pinning to
    // the first entry would have the browser silently drop every message
    const target =
      client && explicit.indexOf(client) !== -1 ? client : explicit[0];
    return {
      trustedOrigins: withOwnOrigin(explicit, own),
      targetOrigin: target,
    };
  }

  if (client) {
    return {
      trustedOrigins: withOwnOrigin([client], own),
      targetOrigin: client,
    };
  }

  if (!warnedLegacyFallback) {
    warnedLegacyFallback = true;
    console.warn(
      '[SiftSdkWeb] Could not determine the client origin (no clientOrigin option, no location.ancestorOrigins, and no usable document.referrer). ' +
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
 * Binds the protocol to the window that embeds this view. A trusted origin
 * alone is not enough: sibling frames and popups served from the client's
 * own origin can hold this frame's WindowProxy and post to it (this product
 * opens OAuth popups on exactly that origin), so a message is only accepted
 * from the embedding window — or from this window itself, whose origin is
 * already trusted and whose code can reach the view directly anyway.
 *
 * `e.source` is absent for a sender that has since closed and for some relay
 * arrangements; enforcing it only when the browser supplies one keeps hosts
 * that legitimately relay working, while closing the vector for every live
 * window. Tighten this to a strict equality check if no host relays.
 */
export function isTrustedSource(expectedSource, source, win = window) {
  if (!source) {
    return true;
  }
  return source === expectedSource || source === win;
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
  // the bound alias of _onWindowMessage held for removeEventListener: without
  // it a message could re-enter dispatch with an origin field of its choosing
  '_messageHandler',
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

// The origin of the window embedding this view.
//
// `location.ancestorOrigins` is authoritative where implemented (Chromium and
// WebKit) and, unlike the referrer, survives navigation inside the frame.
//
// `document.referrer` identifies the embedding page only for the frame's
// *initial* navigation: once the view navigates itself, the referrer becomes
// the previous document in this same frame. A referrer on our own origin
// therefore says nothing about the client, and pinning to it would reject
// every inbound client message while the browser silently dropped every
// outbound one — a dead channel. It is discarded as stale so the caller falls
// back to the documented legacy policy, which keeps the channel working.
// Sifts that navigate in-frame should pass an explicit { clientOrigin }.
function embeddingOrigin(win, own) {
  const ancestors = win.location && win.location.ancestorOrigins;
  if (ancestors && ancestors.length > 0) {
    const fromAncestors = normalizeOrigin(ancestors[0]);
    if (fromAncestors) {
      return fromAncestors;
    }
  }
  const referrerOrigin = originOf(win.document && win.document.referrer);
  if (!referrerOrigin || referrerOrigin === own) {
    return null;
  }
  return referrerOrigin;
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
