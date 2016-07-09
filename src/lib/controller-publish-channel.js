import ObservableSingleton from './observable-singleton.js';
import EmitterSingleton from './emitter-singleton.js';

export default class ControllerPublishChannel {
  constructor() {
    // For a Sift running in an IFrame the 'parentWindow' is the
    // IFrame, which is available as 'parent'
    let parentWindow = (typeof parent !== 'undefined') ? parent : null;

    // iOS-specific initialisation (for Webkit):
    // assume iOS here since we should never be run as a standalone page
    if (typeof window !== 'undefined' && parentWindow === window) {
      parentWindow = {};
      parentWindow.postMessage = (data, origin) => {
        try {
          webkit.messageHandlers.handler.postMessage(data);
        } catch (err) {
          console.error('redsift_cb: could not post message to iOS', err);
          // Reject the request
          this._emitter.emit(data.uuid, {
            error: 'Could not post message to iOS'
          });
        }
      };
    }

    this.bus = parentWindow;
  }

  publish(data, origin) {
    this.bus.postMessage(data, origin);
  }
}
