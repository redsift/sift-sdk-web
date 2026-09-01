import { useEffect, useMemo, useRef, useState } from 'react';
import PluginManager from '../lib/plugin-manager';
import Observable from '@redsift/observable';
import {
  isTrustedOrigin,
  resolveDispatchTarget,
  resolveMessagePolicy,
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

    const getPlugin = ({ id }) => {
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
      _initPlugins: ({ pluginConfigs }) => {
        pluginManager.init({
          pluginConfigs,
          contextType: 'view',
          context: pluginContext,
          global: window,
        });
      },
      _startPlugins: ({ pluginConfigs }) => {
        pluginManager.start({
          pluginConfigs,
          contextType: 'view',
          context: pluginContext,
          global: window,
        });
      },
      _stopPlugins: ({ pluginConfigs }) => {
        pluginManager.stop({
          pluginConfigs,
          contextType: 'view',
          context: pluginContext,
          global: window,
        });
      },
      _receivePluginMessages: ({ messages }) => {
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
      showOAuthPopup: ({ provider, options = null }) => {
        notifyClient('showOAuthPopup', {
          provider,
          options: withHashedEmailSubject(options),
        });
      },
      removeOAuthIdentity: ({ provider, options = null }) => {
        notifyClient('showOAuthRemovePopup', { provider, options });
      },
      signup: () => {
        notifyClient('signup');
      },
      login: ({ redirectUri }) => {
        notifyClient('login', { redirectUri });
      },
      logout: () => {
        notifyClient('logout');
      },
      navigate: ({ href, openInNewTab = false }) => {
        notifyClient('navigate', { href, openInNewTab });
      },
      setupSyncHistory: ({ history, initialPath }) => {
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
      const fn = resolveDispatchTarget(siftViewRef.current, method);
      if (fn) {
        fn(messageParams);
      } else {
        console.warn(`[SiftView]: method not implemented: ${method}`);
      }
    };
    window.addEventListener('message', messageHandler, false);
    return () => {
      window.removeEventListener('message', messageHandler, false);
    };
  }, [controller, messagePolicy]);

  return useMemo(() => [params, siftView], [params, siftView]);
};

export default useSiftView;
