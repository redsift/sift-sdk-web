import Observable from './observable';
import SiftController from './sift-controller';

export default class SiftView {
  constructor() {
    this._resizeHandler = null;
    this._proxy = parent;
    this.controller = new Observable();
    this._registerMessageListeners();
  }

  publish(topic, value) {
   this._proxy.postMessage({
      method: 'notifyController',
      params: {
        topic: topic,
        value: value } },
      '*');
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
