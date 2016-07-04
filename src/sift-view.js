export default class SiftView {
  constructor(window) {
    this.popupAllowed = this._isPopupAllowed(window);
  }

  _isPopupAllowed(window) {
    let popupAllowed = null;

    if (window.self !== window.top) { // in frame
      popupAllowed = true;
    } else { // not in frame
      popupAllowed = false;
    }

    return popupAllowed;
  }

  toString() {
    console.log(`[SiftView] popup allowed: ${this.popupAllowed}`);
  }
}
