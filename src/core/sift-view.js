
import PluginManager from '../lib/plugin-manager';
import Observable from '@redsift/observable';

export default class SiftView {
  constructor() {
    this._resizeHandler = null;
    this._proxy = parent;
    this.controller = new Observable();
    this._registerMessageListeners();
    this._pluginManager = new PluginManager();
  }

  _initPlugins = ({ pluginConfigs }) => {
    this._pluginManager.init({
      pluginConfigs,
      contextType: 'view',
      context: this,
      global: window,
    });
  }

  _startPlugins = ({ pluginConfigs }) => {
    this._pluginManager.start({
      pluginConfigs,
      contextType: 'view',
      context: this,
      global: window,
    });
  }

  _stopPlugins = ({ pluginConfigs }) => {
    this._pluginManager.stop({
      pluginConfigs,
      contextType: 'view',
      context: this,
      global: window,
    });
  }
  
  publish(topic, value) {
   this._proxy.postMessage({
      method: 'notifyController',
      params: {
        topic: topic,
        value: value } },
      '*');
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

  showOAuthPopup({ provider, options = null }) {
    const topic = 'showOAuthPopup';
    const value = { provider, options };

    this.notifyClient(topic, value);
  }

  removeOAuthIdentity({ provider }) {
    const topic = 'showOAuthRemovePopup';
    const value = { provider };

    this.notifyClient(topic, value);
  }

  signup() {
    const topic = 'signup';
    const value = {};

    this.notifyClient(topic, value);
  }

  login() {
    const topic = 'login';
    const value = {};

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

  _registerMessageListeners() {
    window.addEventListener('message', (e) => {
      let method = e.data.method;
      let params = e.data.params;
      if(method === 'notifyView') {
        this.controller.publish(params.topic, params.value);
      }
      else if(this[method]) {
        this[method](params);
      }
      else {
        console.warn('[SiftView]: method not implemented: ', method);
      }
    }, false);
  }
}
