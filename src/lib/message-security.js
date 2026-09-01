/**
 * Helpers to establish which window origins a sift view trusts for
 * postMessage traffic with its embedding client, and to dispatch inbound
 * messages safely.
 */

export function originOf(url) {
  if (!url) {
    return null;
  }
  try {
    return new URL(url).origin;
  } catch (error) {
    return null;
  }
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
  if (explicit.length > 0) {
    return {
      trustedOrigins: withOwnOrigin(explicit, own),
      targetOrigin: explicit[0],
    };
  }

  const referrerOrigin = originOf(win.document && win.document.referrer);
  if (referrerOrigin) {
    return {
      trustedOrigins: withOwnOrigin([referrerOrigin], own),
      targetOrigin: referrerOrigin,
    };
  }

  if (!isEmbedded(win) && own) {
    return { trustedOrigins: [own], targetOrigin: own };
  }

  console.warn(
    '[SiftSdkWeb] Could not determine the client origin (no clientOrigin option and no document.referrer). ' +
      'Falling back to the legacy behaviour of accepting and posting messages to any origin; ' +
      'pass { clientOrigin } to lock this down.'
  );
  return { trustedOrigins: null, targetOrigin: '*' };
}

export function isTrustedOrigin(trustedOrigins, origin) {
  return trustedOrigins === null || trustedOrigins.indexOf(origin) !== -1;
}

/**
 * Resolves an inbound message method name to a callable on `target`.
 * Only functions defined by the SDK or the sift itself are callable —
 * never values inherited from Object.prototype (`constructor`,
 * `hasOwnProperty`, ...) and never non-function properties.
 */
export function resolveDispatchTarget(target, method) {
  if (typeof method !== 'string' || method === 'constructor') {
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
function ownOrigin(win) {
  try {
    return (win.location && win.location.origin) || null;
  } catch (error) {
    return null;
  }
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
