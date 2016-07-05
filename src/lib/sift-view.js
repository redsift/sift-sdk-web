import MessageBus from './message-bus';

export default class SiftView {
  constructor(parentWindow) {
    this.messageBus = MessageBus;
    // this.popupAllowed = this._isPopupAllowed(parentWindow);
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

  notifyListeners(topic, value) {
    this.messageBus.postMessage({ method: 'notifyController', params: { topic: topic, value: value } }, '*');
  };
}
