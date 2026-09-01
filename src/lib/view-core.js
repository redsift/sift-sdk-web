/**
 * The half of a sift view that the class (`SiftView`) and the hook
 * (`useSiftView`) have to implement identically: the inbound message
 * pipeline, the outbound envelopes, the plugin lifecycle, and the helpers
 * that ask the client to do something only it can do.
 *
 * Both wire these factories onto their own object, so a change to the
 * protocol or to its security lands in one place. The two implementations
 * previously duplicated all of it, which is why the dispatch denylist was
 * already shared — this removes the reason that was needed.
 *
 * The one genuine difference between them is where a message method is
 * looked up: the class resolves it against the instance, so a sift's own
 * prototype methods are callable, while the hook resolves it against the
 * object it memoises. `createMessageDispatcher` takes that as `getTarget`.
 */
import {
  isTrustedOrigin,
  isTrustedSource,
  resolveDispatchTarget,
  NON_DISPATCHABLE_VIEW_METHODS,
} from './message-security';
import { withHashedEmailSubject } from './oauth-options';

/**
 * The two outbound envelopes. Both are pinned to the resolved target origin,
 * which is what makes this the only correct way for a sift to reach the
 * client — reaching for `parent.postMessage` skips the pinning.
 */
export function createOutbound({ proxy, targetOrigin }) {
  const post = (method, topic, value) =>
    proxy.postMessage({ method, params: { topic, value } }, targetOrigin);

  return {
    publish: (topic, value) => post('notifyController', topic, value),
    notifyClient: (topic, value = {}) => post('notifyClient', topic, value),
  };
}

/**
 * Plugin lifecycle and lookup. Plugins receive `{ notifyClient }` as their
 * context rather than the whole view: that is all either bundled plugin
 * uses, and it keeps a plugin from reaching the rest of the surface.
 */
export function createPluginSurface({ pluginManager, notifyClient, global }) {
  const context = { notifyClient };
  const call =
    (name) =>
    ({ pluginConfigs } = {}) =>
      pluginManager[name]({
        pluginConfigs,
        contextType: 'view',
        context,
        global,
      });

  const getPlugin = ({ id } = {}) =>
    pluginManager
      .getActivePlugins()
      // NOTE: see https://stackoverflow.com/questions/28627908/call-static-methods-from-regular-es6-class-methods
      .find((plugin) => plugin.constructor.id() === id);

  return {
    _initPlugins: call('init'),
    _startPlugins: call('start'),
    _stopPlugins: call('stop'),
    _receivePluginMessages: (params) => {
      const messages = params && params.messages;
      if (!Array.isArray(messages)) {
        console.warn(
          '[SiftView::_receivePluginMessages]: expected an array of messages'
        );
        return;
      }
      pluginManager.onMessages({ messages });
    },
    getPlugin,
    // Called on teardown: plugins hold global listeners (activity tracking,
    // history sync) that would otherwise outlive the view
    stopPlugins: () =>
      pluginManager.stop({ contextType: 'view', context, global }),
  };
}

/**
 * The actions a sift can only ask the client to perform: account flows,
 * top-level navigation, OAuth popups, history sync.
 */
export function createClientActions({ notifyClient, getPlugin }) {
  return {
    showOAuthPopup: ({ provider, options = null } = {}) =>
      notifyClient('showOAuthPopup', {
        provider,
        options: withHashedEmailSubject(options),
      }),
    removeOAuthIdentity: ({ provider, options = null } = {}) =>
      notifyClient('showOAuthRemovePopup', { provider, options }),
    signup: () => notifyClient('signup', {}),
    login: ({ redirectUri } = {}) => notifyClient('login', { redirectUri }),
    logout: () => notifyClient('logout', {}),
    navigate: ({ href, openInNewTab = false } = {}) =>
      notifyClient('navigate', { href, openInNewTab }),
    setupSyncHistory: ({ history, initialPath } = {}) => {
      if (!history) {
        console.error(
          '[SiftSdkWeb] `setupSyncHistory` requires a history object'
        );
        return;
      }
      const syncHistoryPlugin = getPlugin({ id: 'sync-history' });
      if (syncHistoryPlugin) {
        syncHistoryPlugin.setup({ history, initialPath });
      } else {
        console.error(
          '[SiftSdkWeb] To use `syncHistory` please enable the plugin first!'
        );
      }
    },
  };
}

/**
 * The inbound pipeline: origin, then source, then payload shape, then
 * dispatch. Every check is here rather than in either caller, so neither can
 * drift from the other or quietly lose one.
 */
export function createMessageDispatcher({
  policy,
  proxy,
  controller,
  getTarget,
}) {
  return function onWindowMessage(e) {
    if (!isTrustedOrigin(policy.trustedOrigins, e.origin)) {
      return;
    }
    if (!isTrustedSource(proxy, e.source)) {
      return;
    }
    const data = e.data;
    if (!data || typeof data !== 'object' || typeof data.method !== 'string') {
      return;
    }
    const { method, params } = data;
    // The controller's messages are relayed by the client but belong to the
    // view's `controller` observable, not to the dispatch table
    if (method === 'notifyView') {
      if (params && typeof params === 'object') {
        controller.publish(params.topic, params.value);
      }
      return;
    }
    const target = getTarget();
    const fn = resolveDispatchTarget(
      target,
      method,
      NON_DISPATCHABLE_VIEW_METHODS
    );
    if (fn) {
      // Normalize null to undefined so handlers' destructuring defaults apply
      fn.call(target, params == null ? undefined : params);
    } else {
      console.warn('[SiftView]: method not implemented: ', method);
    }
  };
}
