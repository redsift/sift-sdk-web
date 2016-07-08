import ControllerMessageBus from './controller-message-bus';
import MessageBus from './message-bus';
import { isTouchDevice } from './utils'

export default class SiftView {
  constructor(parentWindow) {
    // FIXXME: unify controllerPublishBus and controllerSubscribeBus!
    this.controllerPublishBus = MessageBus;
    this.controllerSubscribeBus = new ControllerMessageBus();

    this.resizeHandler = null;
    // this.popupAllowed = this._isPopupAllowed(parentWindow);
  }

  subscribe(eventName, handler) {
    // Set up communication with the SiftController:
    window.addEventListener('load', () => {
      this.controllerSubscribeBus.addEventListener(eventName, handler);
    });
  }

  publish(topic, value) {
    this.controllerPublishBus.postMessage({ method: 'notifyController', params: { topic: topic, value: value } }, '*');
  }

  loadData(params) {
    return this.controllerSubscribeBus.loadData(params);
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
