import { useEffect, useState } from 'react';
import EmailClient from './email-client';
import PluginManager from '../lib/plugin-manager';
import Observable from '@redsift/observable';
import SiftStorage from './sift-storage';
import { Storage } from '@redsift/rs-storage';

const useSiftController = ({ loadView }) => {
  const [proxy] = useState(self);
  const [view] = useState(new Observable());
  const [emailclient] = useState(new EmailClient(self));
  const [pluginManager] = useState(new PluginManager());
  const [storage, setStorage] = useState(null);
  const [account, setAccount] = useState(null);
  const [guid, setGuid] = useState(null);

  const _initPlugins = ({ pluginConfigs }) => {
    pluginManager.init({
      pluginConfigs,
      contextType: 'controller',
      context: {},
      global: self,
    });
  };

  const _startPlugins = ({ pluginConfigs }) => {
    pluginManager.start({
      pluginConfigs,
      contextType: 'controller',
      context: {},
      global: self,
    });
  };

  const _stopPlugins = ({ pluginConfigs }) => {
    pluginManager.stop({
      pluginConfigs,
      contextType: 'controller',
      context: {},
      global: self,
    });
  };

  const publish = (topic, value) => {
    proxy.postMessage({ method: 'notifyView', params: { topic, value } });
  };

  const _init = (params) => {
    const { dbSchema, accountGuid, siftGuid } = params;
    setStorage(new SiftStorage());
    storage.init(
      new Storage({
        type: 'SIFT',
        siftGuid,
        accountGuid,
        schema: dbSchema,
      })
    );
    // Initialise sift details
    setGuid(siftGuid);
    setAccount(accountGuid);
    // Init is done, post a message to the iframe_controller
    proxy.postMessage({
      method: 'initCallback',
      result: params,
    });
  };

  const _triggerSiftViewInit = ({ sizeClass, type }, result) => {
    proxy.postMessage({
      method: 'loadViewCallback',
      params: {
        user: { guid: account },
        sift: { guid: guid },
        type,
        sizeClass,
        result,
      },
    });
  };

  const _terminate = () => {
    if (!proxy) {
      return;
    }
    proxy.close();
  };

  const _loadView = async (params) => {
    if (!loadView) {
      console.error(
        '[SiftController::_loadView]: Sift controller must implement the loadView method'
      );
      return;
    }
    const { sizeClass, type } = params;

    // Invoke loadView method
    const result = loadView({ sizeClass, type, params: params.data });
    const { html } = result;
    // console.log('[SiftController::_loadView] loadView result: ', result);
    if (result.data && 'function' === typeof result.data.then) {
      if (html) {
        _triggerSiftViewInit(params, { html });
      }
      try {
        const data = await result.data();
        _triggerSiftViewInit(params, { html, data });
      } catch (error) {
        console.error('[SiftController::loadView]: promise rejected: ', error);
      }
    } else {
      _triggerSiftViewInit(params, result);
    }
  };

  const _storageUpdated = (params) => {
    // Notify the * listeners
    storage.publish('*', params);
    params.forEach((b) => {
      // Notify the bucket listeners.
      // TODO: send the list of keys instead of "[b]"
      storage.publish(b, [b]);
    });
  };

  const _notifyController = ({ topic, value }) => {
    view.publish(topic, value);
  };

  const _emailComposer = ({ topic, value }) => {
    emailclient.publish(topic, value);
  };

  const siftController = {
    _emailComposer,
    _notifyController,
    _storageUpdated,
    _loadView,
    _terminate,
    _triggerSiftViewInit,
    _init,
    publish,
    _stopPlugins,
    _startPlugins,
    _initPlugins,
    loadView,
  };

  useEffect(() => {
    const _registerMessageListeners = () => {
      if (!proxy) {
        return;
      }
      proxy.onmessage = ({ data: { method, params } }) => {
        if (siftController['_' + method]) {
          siftController['_' + method](params);
        } else {
          console.log(
            '[SiftController:onmessage]: method not implemented: ',
            method
          );
        }
      };
    };
    _registerMessageListeners();
  }, []);

  return siftController;
};
export default useSiftController;
