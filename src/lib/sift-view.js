import SiftController from './sift-controller';
import Observable from './observable';

export default class SiftView {
  constructor(controller) {
    this._observable = new Observable();
    console.log('[SiftView::constructor]: ', controller);
    if(controller !== undefined) {
      this._resizeHandler = null;
      this._proxy = parent;
      this.controller = new SiftController();
      this._registerMessageListeners();
    }
  }

  // Used only in the controller context
  subscribe(topic, handler) {
    this._observable.addObserver(topic, handler);
  }

  // Used only in the controller context
  unsubscribe(topic, handler) {
    this._observable.removeObserver(topic, handler);
  }

  publish(topic, value) {
    if(this._proxy) {
      this._proxy.postMessage({
        method: 'notifyController',
        params: {
          topic: topic,
          value: value } },
        '*');
    }
    else {
      this._observable.notifyObservers(topic, value);
    }
  }

  registerOnLoadHandler(handler) {
    window.addEventListener('load', handler);
  }

  // TODO: should we really limit resize events to every 1 second?
  registerOnResizeHandler(handler, resizeTimeout = 1000) {
    window.addEventListener('resize', () => {
      if (!this.resizeHandler) {
        this.resizeHandler = setTimeout(() => {
          this.resizeHandler = null;
          handler();
        }, resizeTimeout);
      }
    });
  }

  _registerMessageListeners() {
    window.addEventListener('message', (e) => {
      let method = e.data.method;
      let params = e.data.params;
      if(method === 'notifyView') {
        this._observable.notifyObservers(params.topic, params.value);
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
