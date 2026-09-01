import PluginManager from '../lib/plugin-manager';
import Observable from '@redsift/observable';
import {
  isTrustedOrigin,
  resolveDispatchTarget,
  resolveMessagePolicy,
  NON_DISPATCHABLE_VIEW_METHODS,
} from '../lib/message-security';
import { withHashedEmailSubject } from '../lib/oauth-options';

export default class SiftView {
  constructor({ clientOrigin } = {}) {
    this._resizeHandler = null;
    this._proxy = parent;
    const { trustedOrigins, targetOrigin } = resolveMessagePolicy({
      clientOrigin,
    });
    this._trustedOrigins = trustedOrigins;
    this._targetOrigin = targetOrigin;
    this._messageHandler = this._onWindowMessage.bind(this);
    this.controller = new Observable();
    this._registerMessageListeners();
    this._pluginManager = new PluginManager();
  }

  // --------------------------------------------------------------------------
  // Plugin management
  // --------------------------------------------------------------------------

  _initPlugins = ({ pluginConfigs } = {}) => {
    this._pluginManager.init({
      pluginConfigs,
      contextType: 'view',
      context: this,
      global: window,
    });
  };

  _startPlugins = ({ pluginConfigs } = {}) => {
    this._pluginManager.start({
      pluginConfigs,
      contextType: 'view',
      context: this,
      global: window,
    });
  };

  _stopPlugins = ({ pluginConfigs } = {}) => {
    this._pluginManager.stop({
      pluginConfigs,
      contextType: 'view',
      context: this,
      global: window,
    });
  };

  _receivePluginMessages(params) {
    const messages = params && params.messages;
    if (!Array.isArray(messages)) {
      console.warn(
        '[SiftView::_receivePluginMessages]: expected an array of messages'
      );
      return;
    }
    this._pluginManager.onMessages({ messages });
  }

  getPlugin = ({ id } = {}) => {
    return (
      this._pluginManager
        .getActivePlugins()
        // NOTE: see https://stackoverflow.com/questions/28627908/call-static-methods-from-regular-es6-class-methods
        .find((plugin) => plugin.constructor.id() === id)
    );
  };

  // --------------------------------------------------------------------------
  // Pub/sub management
  // --------------------------------------------------------------------------

  publish(topic, value) {
    this._proxy.postMessage(
      {
        method: 'notifyController',
        params: {
          topic: topic,
          value: value,
        },
      },
      this._targetOrigin
    );
  }

  notifyClient(topic, value) {
    this._proxy.postMessage(
      {
        method: 'notifyClient',
        params: {
          topic: topic,
          value: value,
        },
      },
      this._targetOrigin
    );
  }

  _registerMessageListeners() {
    window.addEventListener('message', this._messageHandler, false);
  }

  _onWindowMessage(e) {
    if (!isTrustedOrigin(this._trustedOrigins, e.origin)) {
      return;
    }
    const data = e.data;
    if (!data || typeof data !== 'object' || typeof data.method !== 'string') {
      return;
    }
    const { method, params } = data;
    if (method === 'notifyView') {
      if (params && typeof params === 'object') {
        this.controller.publish(params.topic, params.value);
      }
      return;
    }
    const fn = resolveDispatchTarget(
      this,
      method,
      NON_DISPATCHABLE_VIEW_METHODS
    );
    if (fn) {
      // Normalize null to undefined so handlers' destructuring defaults apply
      fn.call(this, params == null ? undefined : params);
    } else {
      console.warn('[SiftView]: method not implemented: ', method);
    }
  }

  // Tears the view down, e.g. in tests or single-page-app navigation:
  // unregisters the window message listener and stops any active plugins
  destroy() {
    window.removeEventListener('message', this._messageHandler, false);
    this._pluginManager.stop({
      contextType: 'view',
      context: this,
      global: window,
    });
  }

  // --------------------------------------------------------------------------
  // Message channel to Cloud
  // --------------------------------------------------------------------------

  showOAuthPopup({ provider, options = null } = {}) {
    const topic = 'showOAuthPopup';
    const value = { provider, options: withHashedEmailSubject(options) };
    this.notifyClient(topic, value);
  }

  removeOAuthIdentity({ provider, options = null } = {}) {
    const topic = 'showOAuthRemovePopup';
    const value = { provider, options };

    this.notifyClient(topic, value);
  }

  signup() {
    const topic = 'signup';
    const value = {};

    this.notifyClient(topic, value);
  }

  login({ redirectUri } = {}) {
    const topic = 'login';
    const value = { redirectUri };

    this.notifyClient(topic, value);
  }

  logout() {
    const topic = 'logout';
    const value = {};

    this.notifyClient(topic, value);
  }

  navigate({ href, openInNewTab = false } = {}) {
    const topic = 'navigate';
    const value = { href, openInNewTab };

    this.notifyClient(topic, value);
  }

  setupSyncHistory({ history, initialPath } = {}) {
    if (!history) {
      console.error(
        '[SiftSdkWeb] `setupSyncHistory` requires a history object'
      );
      return;
    }
    const syncHistoryPlugin = this.getPlugin({ id: 'sync-history' });

    if (syncHistoryPlugin) {
      syncHistoryPlugin.setup({ history, initialPath });
    } else {
      console.error(
        '[SiftSdkWeb] To use `syncHistory` please enable the plugin first!'
      );
    }
  }
}
