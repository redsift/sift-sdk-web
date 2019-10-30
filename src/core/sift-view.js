import PluginManager from '../lib/plugin-manager';
import Observable from '@redsift/observable';
import sha256 from 'js-sha256';

export default class SiftView {
  constructor() {
    this._resizeHandler = null;
    this._proxy = parent;
    this.controller = new Observable();
    this._registerMessageListeners();
    this._pluginManager = new PluginManager();
  }

  // --------------------------------------------------------------------------
  // Plugin management
  // --------------------------------------------------------------------------

  _initPlugins = ({ pluginConfigs }) => {
    this._pluginManager.init({
      pluginConfigs,
      contextType: 'view',
      context: this,
      global: window,
    });
  };

  _startPlugins = ({ pluginConfigs }) => {
    this._pluginManager.start({
      pluginConfigs,
      contextType: 'view',
      context: this,
      global: window,
    });
  };

  _stopPlugins = ({ pluginConfigs }) => {
    this._pluginManager.stop({
      pluginConfigs,
      contextType: 'view',
      context: this,
      global: window,
    });
  };

  _receivePluginMessages({ messages }) {
    this._pluginManager.onMessages({ messages });
  }

  getPlugin = ({ id }) => {
    return this._pluginManager
      .getActivePlugins()
      // NOTE: see https://stackoverflow.com/questions/28627908/call-static-methods-from-regular-es6-class-methods
      .find(plugin => plugin.constructor.id() === id);
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
      '*'
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
      '*'
    );
  }

  _registerMessageListeners() {
    window.addEventListener(
      'message',
      e => {
        let method = e.data.method;
        let params = e.data.params;
        if (method === 'notifyView') {
          this.controller.publish(params.topic, params.value);
        } else if (this[method]) {
          this[method](params);
        } else {
          console.warn('[SiftView]: method not implemented: ', method);
        }
      },
      false
    );
  }

  // --------------------------------------------------------------------------
  // Message channel to Cloud
  // --------------------------------------------------------------------------

  showOAuthPopup({ provider, options = null }) {
    const topic = 'showOAuthPopup';
    let opt = options;
    // If an email is passed, hash it into a subject
    if (options && typeof options === 'object' && options.email) {
      const { email, ...others } = options;
      const subject = sha256(email).substr(0, 16);
      opt = { subject, ...others };
    }
    const value = { provider, options: opt };
    this.notifyClient(topic, value);
  }

  removeOAuthIdentity({ provider, options = null  }) {
    const topic = 'showOAuthRemovePopup';
    const value = { provider, options };

    this.notifyClient(topic, value);
  }

  signup() {
    const topic = 'signup';
    const value = {};

    this.notifyClient(topic, value);
  }

  login({ redirectUri }) {
    const topic = 'login';
    const value = { redirectUri };

    this.notifyClient(topic, value);
  }

  logout() {
    const topic = 'logout';
    const value = {};

    this.notifyClient(topic, value);
  }

  navigate({ href, openInNewTab = false }) {
    const topic = 'navigate';
    const value = { href, openInNewTab };

    this.notifyClient(topic, value);
  }

  setupSyncHistory({ history, initialPath }) {
    const syncHistoryPlugin = this.getPlugin({ id: 'sync-history' });

    if (syncHistoryPlugin) {
      syncHistoryPlugin.setup({ history, initialPath });
    } else {
      console.log('[SiftSdkWeb] ERROR: To use `syncHistory` please enable the plugin first!');
    }
  }
}
