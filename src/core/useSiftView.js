import { useEffect, useMemo, useRef, useState } from 'react';
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
 * The hook form of `SiftView`: same protocol, same origin and dispatch
 * policy — both are wiring over ../lib/view-core — but the client's
 * `presentView` params arrive as state so a React tree re-renders on them.
 */
const useSiftView = (props = {}) => {
  const { willPresentView, clientOrigin } = props;
  const [proxy] = useState(() => parent);
  const [controller] = useState(() => new Observable());
  const [pluginManager] = useState(() => new PluginManager());
  // Throws when no origin can be resolved: see resolveMessagePolicy. A throw
  // here surfaces through React's nearest error boundary, which is the point
  // — an unresolvable client origin is a broken deployment, not a fallback.
  const [messagePolicy] = useState(() =>
    resolveMessagePolicy({ clientOrigin })
  );
  const [params, setParams] = useState(null);

  // Keep the latest consumer callback reachable from the listener without
  // re-registering it. The ref is written in an effect below rather than
  // during render: a render-phase ref write is impure and misbehaves under
  // concurrent rendering.
  const willPresentViewRef = useRef(willPresentView);

  const siftView = useMemo(() => {
    const outbound = createOutbound({
      proxy,
      targetOrigin: messagePolicy.targetOrigin,
    });
    const plugins = createPluginSurface({
      pluginManager,
      notifyClient: outbound.notifyClient,
      global: window,
    });

    return {
      resizeHandler: null,
      proxy,
      controller,
      pluginManager,
      ...outbound,
      _initPlugins: plugins._initPlugins,
      _startPlugins: plugins._startPlugins,
      _stopPlugins: plugins._stopPlugins,
      _receivePluginMessages: plugins._receivePluginMessages,
      getPlugin: plugins.getPlugin,
      ...createClientActions({
        notifyClient: outbound.notifyClient,
        getPlugin: plugins.getPlugin,
      }),
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

  // Publish the latest values for the listener after each commit
  useEffect(() => {
    willPresentViewRef.current = willPresentView;
    siftViewRef.current = siftView;
  });

  useEffect(() => {
    const messageHandler = createMessageDispatcher({
      policy: messagePolicy,
      proxy,
      controller,
      getTarget: () => siftViewRef.current,
    });
    window.addEventListener('message', messageHandler, false);
    return () => {
      window.removeEventListener('message', messageHandler, false);
      // Plugins hold global listeners (activity tracking, history sync):
      // stop them too, or they outlive the unmounted view
      pluginManager.stop({ contextType: 'view', global: window });
    };
  }, [controller, pluginManager, messagePolicy, proxy]);

  return useMemo(() => [params, siftView], [params, siftView]);
};

export default useSiftView;
