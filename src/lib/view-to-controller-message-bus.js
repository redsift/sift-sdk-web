export default class ViewToControllerMessageBus {
  constructor(emitter, observable) {
    this.bus = this._setupBus();
    this._emitter = emitter;
    this._observable = observable;
  }

  // Publishes a generic message to the Sift Controller.
  publish(data, origin) {
    this.bus.postMessage(data, origin);
  }

  subscribe(topic, listener) {
      this._observable.addObserver(topic, listener);
  }

  unsubscribe(topic, listener) {
      this._observable.removeObserver(topic, listener);
  }

  // Publishes a 'loadData' message to the Controller and returns the data
  // specified in params.
  loadData(params) {
    return new Promise((resolve, reject) => {
      const uuid = this._emitter.reserveUUID((params) => {
        this._emitter.removeAllListeners(uuid);
        if (params.error) {
          reject(params.error);
        } else {
          resolve(params.result);
        }
      });
      this.viewToControllerMessageBus.publish({
        method: 'loadData',
        params: params,
        uuid: uuid
      }, '*');
    });
  }

  _setupBus() {
    // For a Sift running in an IFrame the 'parentWindow' is the
    // IFrame, which is available as 'parent'
    var parentWindow = (typeof parent !== 'undefined') ? parent : null;

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

    return parentWindow;
  }
}
