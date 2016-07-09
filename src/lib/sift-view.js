import ViewToControllerEventBus from './view-to-controller-event-bus';
import { isTouchDevice } from './utils'

export default class SiftView {
  constructor() {
    this.ViewToControllerEventBus = new ViewToControllerEventBus(this);

    this.popupAllowed = this._isPopupAllowed(this.ViewToControllerEventBus);
    this.resizeHandler = null;
  }

  subscribe(eventName, handler) {
    window.addEventListener('load', () => {
      this.ViewToControllerEventBus.subscribe(eventName, handler);
    });
  }

  publish(topic, value) {
    this.ViewToControllerEventBus.publish({ method: 'notifyController', params: { topic: topic, value: value } }, '*');
  }

  loadData(params) {
    return this.ViewToControllerEventBus.loadData(params);
  }

  registerOnLoadHandler(handler) {
    window.addEventListener('load', handler);
  }

  registerOnResizeHandler(handler, resizeTimeout = 1000) {
    window.addEventListener('resize', () => {
      if (isTouchDevice()) {
        return;
      }

      if (!this.resizeHandler) {
        this.resizeHandler = setTimeout(() => {
          this.resizeHandler = null;
          handler();
        }, resizeTimeout);
      }
    });
  }

  _isPopupAllowed(parentWindow) {
    let popupAllowed = false;

    if (parentWindow.self !== parentWindow.top) { // in frame
      popupAllowed = true;
    } else { // not in frame
      popupAllowed = false;
    }

    return popupAllowed;
  }
}
