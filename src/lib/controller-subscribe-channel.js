import ObservableSingleton from './observable-singleton.js';
import EmitterSingleton from './emitter-singleton.js';

export default class ControllerSubscribeChannel {
  constructor(siftView) {
    this.siftView = siftView;

    this.observable = new ObservableSingleton();
    this.emitter = new EmitterSingleton();

    this._setup();
  }

  subscribe(topic, handler) {
    this.observable.addObserver(topic, handler);
  }

  unsubscribe(topic, handler) {
    this.observable.removeObserver(topic, handler);
  }

  _setup() {
    let that = this;

    // listens to messages from the controller_worker (which runs the injected frontend/controller.js)
    window.addEventListener('message', function(event) {
      switch (event.data.method) {
        case 'presentView':
          that.siftView.presentView(event.data.params);
          break;
        case 'willPresentView':
          that.siftView.willPresentView(event.data.params);
          break;
        case 'loadDataCallback':
          if (event.data.uuid) {
            that.emitter.emit(event.data.uuid, event.data.params);
          } else {
            console.error('redsift_cb: received loadDataCallback without uuid');
          }
          break;
        case 'notifyView':
          that.observable.notifyObservers(event.data.params.topic, event.data.params.value);
          break;
        default:
          console.error('redsift_cb: unexpected message from origin:', event.origin);
          break;
      }
    }, false);
  }
}
