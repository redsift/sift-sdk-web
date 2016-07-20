import EmailClient from './email-client'
import SiftStorage from './sift-storage';
import SiftView from './sift-view';
import TreoStorage from './treo-storage';

export default class SiftController {
  constructor(view) {
    this._observable = new Observable();
    // If no view provided then it has been instantiated as a worker
    if(!view) {
      this._proxy = self;
      this.storage = new SiftStorage();
      this.view = new SiftView();
      this.emailclient = new EmailClient();
      this._registerMessageListeners();
    }
  }

  // Used only in the view context
  subscribe(topic, handler) {
    this._observable.addObserver(topic, handler);
  }

  // Used only in the view context
  unsubscribe(topic, handler) {
    this._observable.removeObserver(topic, handler);
  }

  publish(topic, value) {
    if(this._proxy) {
      this._proxy.postMessage({
        method: 'notifyView',
        params: {
          topic: topic,
          value: value
        }
      });
    }
    else {
      this._observable.notifyObservers(topic, value);
    }
  }

  _registerMessageListeners() {
    if(!this._proxy) return;
    this._proxy.onmessage = (e) => {
      console.log('[SiftController::onmessage]: ', e.data);
      let method = e.data.method;
      if (this['_' + method]) {
        this[method](e.data.params);
      }
      else {
        console.log('[SiftController:onmessage]: method not implemented: ', method);
      }
    };
  }

  _init(params) {
    console.log('[SiftController::_init]: ', params);
    this.storage.init(
      TreoStorage({
        type: 'SIFT',
        siftGuid: params.siftGuid,
        accountGuid: params.accountGuid,
        schema: params.dbSchema
      },
        false)
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
    if(!this._proxy) return;
    console.log('[SiftController::_terminate]');
    this._proxy.close();
  }

  _postCallback(params, _result) {
    controllerWorkerMessageBus.postMessage({
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
    console.log('[SiftController::_loadView]: ', params);
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
    console.log('[SiftController::_loadView] loadView result: ', result);
    if (result.data && 'function' === typeof result.data.then) {
      if (result.html) {
        _postCallback(params, { html: result.html });
      }
      result.data.then(function (data) {
        _postCallback(params, { html: result.html, data: data });
      }).catch(function (error) {
        console.error('[SiftController::loadView]: promise rejected: ', error);
      });
    }
    else {
      _postCallback(params, result);
    }
  }

  _storageUpdated(params) {
    console.log('[SiftController::_storageUpdated]: ', params);
    // Notify the * listeners
    this.storage.publish('*', params);
    params.forEach(function (b) {
      // Notify the bucket listeners.
      // TODO: send the list of keys instead of "[b]"
      this.storage.publish(b, [b]);
    });
  }

  _notifyController(params) {
    console.log('[SiftController::_notifyController]: ', params);
    this._observable.notifyObservers(params.topic, params.value);
  }

  _emailComposer(params) {
    console.log('[SiftController::_emailComposer]: ', params);
    this.emailclient.publish(params.topic, params.value);
  }
}
