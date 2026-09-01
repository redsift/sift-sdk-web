import EmailClient from './email-client';
import PluginManager from '../lib/plugin-manager';
import Observable from '@redsift/observable';
import SiftStorage from './sift-storage';
import { Storage } from '@redsift/rs-storage';

// Internal machinery that must never be invokable through an inbound
// worker message ('registerMessageListeners' would otherwise install a
// duplicate listener per message, 'triggerSiftViewInit'/'...Failed' are
// outbound-only helpers)
const NON_DISPATCHABLE_HANDLERS = [
  '_registerMessageListeners',
  '_triggerSiftViewInit',
  '_triggerSiftViewFailed',
];

export default class SiftController {
  constructor() {
    this._proxy = self;
    this.view = new Observable();
    this.emailclient = new EmailClient(self);
    this._registerMessageListeners();
    this._pluginManager = new PluginManager();
  }

  _initPlugins = ({ pluginConfigs } = {}) => {
    this._pluginManager.init({
      pluginConfigs,
      contextType: 'controller',
      context: this,
      global: self,
    });
  };

  _startPlugins = ({ pluginConfigs } = {}) => {
    this._pluginManager.start({
      pluginConfigs,
      contextType: 'controller',
      context: this,
      global: self,
    });
  };

  _stopPlugins = ({ pluginConfigs } = {}) => {
    this._pluginManager.stop({
      pluginConfigs,
      contextType: 'controller',
      context: this,
      global: self,
    });
  };

  publish(topic, value) {
    this._proxy.postMessage({
      method: 'notifyView',
      params: {
        topic: topic,
        value: value,
      },
    });
  }

  _registerMessageListeners() {
    if (!this._proxy || !this._proxy.addEventListener) return;
    // addEventListener instead of assigning onmessage, so the listener does
    // not clobber (or get clobbered by) other listeners on the worker scope
    this._proxy.addEventListener('message', (e) => {
      const data = e.data;
      if (
        !data ||
        typeof data !== 'object' ||
        typeof data.method !== 'string'
      ) {
        return;
      }
      const handlerName = '_' + data.method;
      const handler = NON_DISPATCHABLE_HANDLERS.includes(handlerName)
        ? null
        : this[handlerName];
      if (typeof handler === 'function') {
        handler.call(this, data.params);
      } else {
        console.warn(
          '[SiftController:onmessage]: method not implemented: ',
          data.method
        );
      }
    });
  }

  _init(params) {
    // console.log('[SiftController::_init]: ', params);
    if (!params || typeof params !== 'object') {
      console.warn('[SiftController::_init]: invalid init params');
      return;
    }
    this.storage = new SiftStorage();
    this.storage.init(
      new Storage({
        type: 'SIFT',
        siftGuid: params.siftGuid,
        accountGuid: params.accountGuid,
        schema: params.dbSchema,
      })
    );
    // Initialise sift details
    this._guid = params.siftGuid;
    this._account = params.accountGuid;
    // Init is done, post a message to the iframe_controller
    this._proxy.postMessage({
      method: 'initCallback',
      result: params,
    });
  }

  _terminate() {
    if (!this._proxy) return;
    // console.log('[SiftController::_terminate]');
    this._proxy.close();
  }

  _triggerSiftViewInit(params, _result) {
    this._proxy.postMessage({
      method: 'loadViewCallback',
      params: {
        user: { guid: this._account },
        sift: { guid: this._guid },
        type: params.type,
        sizeClass: params.sizeClass,
        result: _result,
      },
    });
  }

  _triggerSiftViewFailed(params, error) {
    this._proxy.postMessage({
      method: 'loadViewFailedCallback',
      params: {
        user: { guid: this._account },
        sift: { guid: this._guid },
        type: params.type,
        sizeClass: params.sizeClass,
        error: {
          message: (error && error.message) || String(error),
        },
      },
    });
  }

  _loadView(params) {
    // console.log('[SiftController::_loadView]: ', params);
    if (!params || typeof params !== 'object') {
      console.warn('[SiftController::_loadView]: invalid loadView params');
      return;
    }
    if (!this.loadView) {
      console.error(
        '[SiftController::_loadView]: Sift controller must implement the loadView method'
      );
      return;
    }

    // Invoke loadView method
    let result;
    try {
      result = this.loadView({
        sizeClass: params.sizeClass,
        type: params.type,
        params: params.data,
      });
    } catch (error) {
      console.error('[SiftController::loadView]: threw an exception: ', error);
      this._triggerSiftViewFailed(params, error);
      return;
    }

    if (!result || typeof result !== 'object') {
      console.error(
        '[SiftController::loadView]: must return an object like { html, data }, got: ',
        result
      );
      this._triggerSiftViewFailed(
        params,
        new Error('loadView did not return a result')
      );
      return;
    }

    if (result.data && 'function' === typeof result.data.then) {
      if (result.html) {
        this._triggerSiftViewInit(params, { html: result.html });
      }
      result.data
        .then((data) => {
          this._triggerSiftViewInit(params, { html: result.html, data: data });
        })
        .catch((error) => {
          console.error(
            '[SiftController::loadView]: promise rejected: ',
            error
          );
          this._triggerSiftViewFailed(params, error);
        });
    } else {
      this._triggerSiftViewInit(params, result);
    }
  }

  _storageUpdated(params) {
    // console.log('[SiftController::_storageUpdated]: ', params);
    if (!Array.isArray(params)) {
      console.warn(
        '[SiftController::_storageUpdated]: expected an array of buckets'
      );
      return;
    }
    // Notify the * listeners
    this.storage.publish('*', params);
    params.forEach((b) => {
      // Notify the bucket listeners.
      // TODO: send the list of keys instead of "[b]"
      this.storage.publish(b, [b]);
    });
  }

  _notifyController(params) {
    // console.log('[SiftController::_notifyController]: ', params);
    if (!params || typeof params !== 'object') return;
    this.view.publish(params.topic, params.value);
  }

  _emailComposer(params) {
    // console.log('[SiftController::_emailComposer]: ', params);
    if (!params || typeof params !== 'object') return;
    this.emailclient.publish(params.topic, params.value);
  }
}
