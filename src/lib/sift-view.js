import ControllerViewPostMessageBus from './controller-message-bus';
import ViewToControllerMessageBus from './view-to-controller-message-bus';
import { isTouchDevice } from './utils'

export default class SiftView {
  constructor(parentWindow) {
    this.viewToControllerMessageBus = new ViewToControllerMessageBus();
    this.controllerSubscribeBus = new ControllerViewPostMessageBus();

    this.popupAllowed = this._isPopupAllowed(this.viewToControllerMessageBus);
    this.resizeHandler = null;
  }

  subscribe(eventName, handler) {
    window.addEventListener('load', () => {
      this.controllerSubscribeBus.addEventListener(eventName, handler);
    });
  }

  publish(topic, value) {
    this.viewToControllerMessageBus.publish({ method: 'notifyController', params: { topic: topic, value: value } }, '*');
  }

  loadData(params) {
    return this.viewToControllerMessageBus.loadData(params);
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
