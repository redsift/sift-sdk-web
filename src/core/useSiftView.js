import { useEffect, useMemo, useRef, useState } from 'react';
import PluginManager from '../lib/plugin-manager';
import Observable from '@redsift/observable';
import {
  isTrustedOrigin,
  isTrustedSource,
  resolveDispatchTarget,
  resolveMessagePolicy,
  NON_DISPATCHABLE_VIEW_METHODS,
} from '../lib/message-security';
import { withHashedEmailSubject } from '../lib/oauth-options';

const useSiftView = (props = {}) => {
  const { willPresentView, clientOrigin } = props;
  const [proxy] = useState(() => parent);
  const [controller] = useState(() => new Observable());
  const [pluginManager] = useState(() => new PluginManager());
  const [messagePolicy] = useState(() =>
    resolveMessagePolicy({ clientOrigin })
  );
  const [params, setParams] = useState(null);

  // Keep the latest consumer callback without re-registering listeners
  const willPresentViewRef = useRef(willPresentView);
  willPresentViewRef.current = willPresentView;

  const siftView = useMemo(() => {
    const notifyClient = (topic, value = {}) => {
      proxy.postMessage(
        { method: 'notifyClient', params: { topic, value } },
        messagePolicy.targetOrigin
      );
    };

    const pluginContext = { notifyClient };

    const getPlugin = ({ id } = {}) => {
      return (
        pluginManager
          .getActivePlugins()
          // NOTE: see https://stackoverflow.com/questions/28627908/call-static-methods-from-regular-es6-class-methods
          .find((plugin) => plugin.constructor.id() === id)
      );
    };

    return {
      resizeHandler: null,
      proxy,
      controller,
      pluginManager,
      _initPlugins: ({ pluginConfigs } = {}) => {
        pluginManager.init({
          pluginConfigs,
          contextType: 'view',
          context: pluginContext,
          global: window,
        });
      },
      _startPlugins: ({ pluginConfigs } = {}) => {
        pluginManager.start({
          pluginConfigs,
          contextType: 'view',
          context: pluginContext,
          global: window,
        });
      },
      _stopPlugins: ({ pluginConfigs } = {}) => {
        pluginManager.stop({
          pluginConfigs,
          contextType: 'view',
          context: pluginContext,
          global: window,
        });
      },
      _receivePluginMessages: (messageParams) => {
        const messages = messageParams && messageParams.messages;
        if (!Array.isArray(messages)) {
          console.warn(
            '[SiftView::_receivePluginMessages]: expected an array of messages'
          );
          return;
        }
        pluginManager.onMessages({ messages });
      },
      getPlugin,
      publish: (topic, value) => {
        proxy.postMessage(
          { method: 'notifyController', params: { topic, value } },
          messagePolicy.targetOrigin
        );
      },
      notifyClient,
      showOAuthPopup: ({ provider, options = null } = {}) => {
        notifyClient('showOAuthPopup', {
          provider,
          options: withHashedEmailSubject(options),
        });
      },
      removeOAuthIdentity: ({ provider, options = null } = {}) => {
        notifyClient('showOAuthRemovePopup', { provider, options });
      },
      signup: () => {
        notifyClient('signup');
      },
      login: ({ redirectUri } = {}) => {
        notifyClient('login', { redirectUri });
      },
      logout: () => {
        notifyClient('logout');
      },
      navigate: ({ href, openInNewTab = false } = {}) => {
        notifyClient('navigate', { href, openInNewTab });
      },
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
      presentView: (viewParams) => {
        setParams(viewParams);
      },
      willPresentView: (viewParams) => {
        if (willPresentViewRef.current) {
          willPresentViewRef.current(viewParams);
        }
      },
    };
  }, [proxy, controller, pluginManager, messagePolicy]);

  const siftViewRef = useRef(siftView);
  siftViewRef.current = siftView;

  useEffect(() => {
    const messageHandler = (e) => {
      if (!isTrustedOrigin(messagePolicy.trustedOrigins, e.origin)) {
        return;
      }
      if (!isTrustedSource(proxy, e.source)) {
        return;
      }
      const data = e.data;
      if (
        !data ||
        typeof data !== 'object' ||
        typeof data.method !== 'string'
      ) {
        return;
      }
      const { method, params: messageParams } = data;
      if (method === 'notifyView') {
        if (messageParams && typeof messageParams === 'object') {
          controller.publish(messageParams.topic, messageParams.value);
        }
        return;
      }
      const fn = resolveDispatchTarget(
        siftViewRef.current,
        method,
        NON_DISPATCHABLE_VIEW_METHODS
      );
      if (fn) {
        // Normalize null to undefined so handlers' destructuring defaults apply
        fn(messageParams == null ? undefined : messageParams);
      } else {
        console.warn(`[SiftView]: method not implemented: ${method}`);
      }
    };
    window.addEventListener('message', messageHandler, false);
    return () => {
      window.removeEventListener('message', messageHandler, false);
      // Plugins hold global listeners (activity tracking, history sync):
      // stop them too, or they outlive the unmounted view
      pluginManager.stop({
        contextType: 'view',
        global: window,
      });
    };
  }, [controller, pluginManager, messagePolicy]);

  return useMemo(() => [params, siftView], [params, siftView]);
};

export default useSiftView;
