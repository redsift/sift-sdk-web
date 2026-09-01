import PluginManager from '../lib/plugin-manager';
import Observable from '@redsift/observable';
import { resolveMessagePolicy } from '../lib/message-security';
import {
  createClientActions,
  createMessageDispatcher,
  createOutbound,
  createPluginSurface,
} from '../lib/view-core';

/**
 * A sift's view, as a class. `useSiftView` is the same protocol as a hook;
 * both are thin wiring over ../lib/view-core, which holds the logic they must
 * agree on.
 *
 * The members below stay split between own properties and prototype methods
 * exactly as they were, so a sift that overrides one of them from
 * `createSiftView({ ... })` still shadows it.
 */
export default class SiftView {
  constructor({ clientOrigin } = {}) {
    this._resizeHandler = null;
    this._proxy = parent;
    // Throws when no origin can be resolved: see resolveMessagePolicy
    const policy = resolveMessagePolicy({ clientOrigin });
    this._trustedOrigins = policy.trustedOrigins;
    this._targetOrigin = policy.targetOrigin;
    this.controller = new Observable();
    this._pluginManager = new PluginManager();

    const outbound = createOutbound({
      proxy: this._proxy,
      targetOrigin: policy.targetOrigin,
    });
    const plugins = createPluginSurface({
      pluginManager: this._pluginManager,
      notifyClient: outbound.notifyClient,
      global: window,
    });
    this._core = {
      ...outbound,
      ...plugins,
      ...createClientActions({
        notifyClient: outbound.notifyClient,
        getPlugin: plugins.getPlugin,
      }),
    };

    // Own properties, as before: the plugin lifecycle the client drives, and
    // the plugin lookup a sift calls
    this._initPlugins = plugins._initPlugins;
    this._startPlugins = plugins._startPlugins;
    this._stopPlugins = plugins._stopPlugins;
    this.getPlugin = plugins.getPlugin;

    this._messageHandler = createMessageDispatcher({
      policy,
      proxy: this._proxy,
      controller: this.controller,
      getTarget: () => this,
    });
    this._registerMessageListeners();
  }

  // --------------------------------------------------------------------------
  // Plugin management
  // --------------------------------------------------------------------------

  _receivePluginMessages(params) {
    return this._core._receivePluginMessages(params);
  }

  // --------------------------------------------------------------------------
  // Pub/sub management
  // --------------------------------------------------------------------------

  publish(topic, value) {
    return this._core.publish(topic, value);
  }

  notifyClient(topic, value) {
    return this._core.notifyClient(topic, value);
  }

  _registerMessageListeners() {
    window.addEventListener('message', this._messageHandler, false);
  }

  // Tears the view down, e.g. in tests or single-page-app navigation:
  // unregisters the window message listener and stops any active plugins
  destroy() {
    window.removeEventListener('message', this._messageHandler, false);
    this._core.stopPlugins();
  }

  // --------------------------------------------------------------------------
  // Message channel to Cloud
  // --------------------------------------------------------------------------

  showOAuthPopup(request) {
    return this._core.showOAuthPopup(request);
  }

  removeOAuthIdentity(request) {
    return this._core.removeOAuthIdentity(request);
  }

  signup() {
    return this._core.signup();
  }

  login(request) {
    return this._core.login(request);
  }

  logout() {
    return this._core.logout();
  }

  navigate(request) {
    return this._core.navigate(request);
  }

  setupSyncHistory(request) {
    return this._core.setupSyncHistory(request);
  }
}
