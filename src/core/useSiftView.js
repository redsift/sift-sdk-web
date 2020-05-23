import { useState, useEffect } from 'react';
import PluginManager from '../lib/plugin-manager';
import Observable from '@redsift/observable';
import sha256 from 'js-sha256';

const useSiftView = ({ presentView: present, willPresentView }) => {
  const [resizeHandler] = useState(null);
  const [proxy] = useState(parent);
  const [controller] = useState(new Observable());
  const [pluginManager] = useState(new PluginManager());

  const notifyClient = (topic, value = {}) => {
    proxy.postMessage(
      { method: 'notifyClient', params: { topic, value } },
      '*'
    );
  };

  const _initPlugins = ({ pluginConfigs }) => {
    pluginManager.init({
      pluginConfigs,
      contextType: 'view',
      context: { notifyClient },
      global: window,
    });
  };

  const _startPlugins = ({ pluginConfigs }) => {
    pluginManager.start({
      pluginConfigs,
      contextType: 'view',
      context: { notifyClient },
      global: window,
    });
  };

  const _stopPlugins = ({ pluginConfigs }) => {
    pluginManager.stop({
      pluginConfigs,
      contextType: 'view',
      context: { notifyClient },
      global: window,
    });
  };

  const _receivePluginMessages = ({ messages }) => {
    pluginManager.onMessages({ messages });
  };

  const getPlugin = ({ id }) => {
    return (
      pluginManager
        .getActivePlugins()
        // NOTE: see https://stackoverflow.com/questions/28627908/call-static-methods-from-regular-es6-class-methods
        .find((plugin) => plugin.constructor.id() === id)
    );
  };

  const publish = (topic, value) => {
    proxy.postMessage(
      { method: 'notifyController', params: { topic, value } },
      '*'
    );
  };

  const showOAuthPopup = ({ provider, options = null }) => {
    let opt = options;
    // If an email is passed, hash it into a subject
    if (options && typeof options === 'object' && options.email) {
      const { email, ...others } = options;
      const subject = sha256(email).substr(0, 16);
      opt = { subject, ...others };
    }
    notifyClient('showOAuthPopup', { provider, options: opt });
  };

  const removeOAuthIdentity = ({ provider, options = null }) => {
    notifyClient('showOAuthRemovePopup', { provider, options });
  };

  const signup = () => {
    notifyClient('signup');
  };

  const login = ({ redirectUri }) => {
    notifyClient('login', { redirectUri });
  };

  const logout = () => {
    notifyClient('logout');
  };

  const navigate = ({ href, openInNewTab = false }) => {
    notifyClient('navigate', { href, openInNewTab });
  };

  const setupSyncHistory = ({ history, initialPath }) => {
    const syncHistoryPlugin = getPlugin({ id: 'sync-history' });
    if (syncHistoryPlugin) {
      syncHistoryPlugin.setup({ history, initialPath });
    } else {
      console.log(
        '[SiftSdkWeb] ERROR: To use `syncHistory` please enable the plugin first!'
      );
    }
  };

  const siftView = {
    resizeHandler,
    proxy,
    controller,
    pluginManager,
    _initPlugins,
    _startPlugins,
    _stopPlugins,
    _receivePluginMessages,
    getPlugin,
    publish,
    notifyClient,
    showOAuthPopup,
    removeOAuthIdentity,
    signup,
    login,
    logout,
    navigate,
    setupSyncHistory,
    presentView,
    willPresentView,
  };

  const presentView = (props) => {
    present(props, siftView);
  };

  siftView['presentView'] = presentView;

  useEffect(() => {
    const _registerMessageListeners = () => {
      window.addEventListener(
        'message',
        ({ data: { method, params } }) => {
          console.log('method', method, 'params', params);
          if (method === 'notifyView') {
            controller.publish(params.topic, params.value);
          } else if (siftView[method]) {
            siftView[method](params);
          } else {
            console.warn(`[SiftView]: method not implemented: ${method}`);
          }
        },
        false
      );
    };
    _registerMessageListeners();
  }, []);

  return siftView;
};

export default useSiftView;
