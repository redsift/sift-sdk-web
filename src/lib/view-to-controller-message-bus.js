import ObservableSingleton from './observable-singleton.js';
import EmitterSingleton from './emitter-singleton.js';

export default class ViewToControllerMessageBus {
  constructor(siftView) {
    this.siftView = siftView;

    this.runtime = this._setupRuntime();
    this.bus = this._setupBus();
  }

  // Publishes a generic message to the Sift Controller.
  publish(data, origin) {
    this.bus.postMessage(data, origin);
  }

  subscribe(topic, listener) {
      this.observable.addObserver(topic, listener);
  }

  unsubscribe(topic, listener) {
      this.observable.removeObserver(topic, listener);
  }

  // Publishes a 'loadData' message to the Controller and returns the data
  // specified in params.
  loadData(params) {
    return new Promise((resolve, reject) => {
      const uuid = this.emitter.reserveUUID((params) => {
        this.emitter.removeAllListeners(uuid);
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

  _setupRuntime() {
    this.observable = new ObservableSingleton();
    this.emitter = new EmitterSingleton();

    /**
     * Register message handlers
     */
    // listens to messages from the controller_worker (which runs the frontend/controller.js)
    window.addEventListener('message', (event) => {
      switch (event.data.method) {
        case 'presentView':
          this.siftView.presentView(event.data.params);
          break;
        case 'willPresentView':
          this.siftView.willPresentView(event.data.params);
          break;
        case 'loadDataCallback':
          if (event.data.uuid) {
            this.emitter.emit(event.data.uuid, event.data.params);
          }
          else {
            console.error('redsift_cb: received loadDataCallback without uuid');
          }
          break;
        case 'notifyView':
          this.observable.notifyObservers(event.data.params.topic, event.data.params.value);
          break;
        default:
          console.error('redsift_cb: unexpected message from origin:', event.origin);
          break;
      }
    }, false);
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
