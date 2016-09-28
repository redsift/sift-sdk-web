import EmailClient from './email-client';
import Observable from '@redsift/observable';
import SiftStorage from './sift-storage';
import { Storage } from '@redsift/rs-storage';

export default class SiftController {
  constructor() {
    this._proxy = self;
    this.view = new Observable();
    this.emailclient = new EmailClient(self);
    this._registerMessageListeners();
  }

  publish(topic, value) {
    this._proxy.postMessage({
      method: 'notifyView',
      params: {
        topic: topic,
        value: value
      }
    });
  }

  _registerMessageListeners() {
    if (!this._proxy) return;
    this._proxy.onmessage = (e) => {
      // console.log('[SiftController::onmessage]: ', e.data);
      let method = e.data.method;
      if (this['_' + method]) {
        this['_' + method](e.data.params);
      }
      else {
        // console.log('[SiftController:onmessage]: method not implemented: ', method);
      }
    };
  }

  _init(params) {
    // console.log('[SiftController::_init]: ', params);
    this.storage = new SiftStorage();
    this.storage.init(
      new Storage({
        type: 'SIFT',
        siftGuid: params.siftGuid,
        accountGuid: params.accountGuid,
        schema: params.dbSchema
      })
    );
    // Initialise sift details
    this._guid = params.siftGuid;
    this._account = params.accountGuid;
    // Init is done, post a message to the iframe_controller
    this._proxy.postMessage({
      method: 'initCallback',
      result: params
    });
  }

  _terminate() {
    if (!this._proxy) return;
    // console.log('[SiftController::_terminate]');
    this._proxy.close();
  }

  _postCallback(params, _result) {
    this._proxy.postMessage({
      method: 'loadViewCallback',
      params: {
        user: { guid: this._account },
        sift: { guid: this._guid },
        type: params.type,
        sizeClass: params.sizeClass,
        result: _result
      }
    });
  }

  _loadView(params) {
    // console.log('[SiftController::_loadView]: ', params);
    if (!this.loadView) {
      console.error('[SiftController::_loadView]: Sift controller must implement the loadView method');
      return;
    }
    // Invoke loadView method
    let result = this.loadView({
      sizeClass: params.sizeClass,
      type: params.type,
      params: params.data
    });
    // console.log('[SiftController::_loadView] loadView result: ', result);
    if (result.data && 'function' === typeof result.data.then) {
      if (result.html) {
        this._postCallback(params, { html: result.html });
      }
      result.data.then((data) => {
        this._postCallback(params, { html: result.html, data: data });
      }).catch((error) => {
        console.error('[SiftController::loadView]: promise rejected: ', error);
      });
    }
    else {
      this._postCallback(params, result);
    }
  }

  _storageUpdated(params) {
    // console.log('[SiftController::_storageUpdated]: ', params);
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
    this.view.publish(params.topic, params.value);
  }

  _emailComposer(params) {
    // console.log('[SiftController::_emailComposer]: ', params);
    this.emailclient.publish(params.topic, params.value);
  }
}
