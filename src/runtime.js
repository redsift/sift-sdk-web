import ObservableSingleton from './lib/observable-singleton.js';
import EmitterSingleton from './lib/emitter-singleton.js';

let Redsift = window.Redsift || {};

function getRegisteredSiftView() {
  return window.Redsift.siftView;
}

Redsift.Runtime = {
  observable: new ObservableSingleton(),
  emitter: new EmitterSingleton(),
  siftView: getRegisteredSiftView()
};

console.log('[sift-runtime] Initialized sift runtime');

/**
 * Register message handlers
 */
// listens to messages from the controller_worker (which runs the frontend/controller.js)
window.addEventListener('message', function (event) {
  if (!Redsift.Runtime.siftView) {
    Redsift.Runtime.siftView = getRegisteredSiftView();
  }

  if (!Redsift.Runtime.siftView) {
    throw new Error('[sift-runtime] No siftView available. This is an error!');
  }

  switch (event.data.method) {
    case 'presentView':
      Redsift.Runtime.siftView.presentView(event.data.params);
      break;
    case 'willPresentView':
      Redsift.Runtime.siftView.willPresentView(event.data.params);
      break;
    case 'loadDataCallback':
      if (event.data.uuid) {
        Redsift.Runtime.emitter.emit(event.data.uuid, event.data.params);
      }
      else {
        console.error('redsift_cb: received loadDataCallback without uuid');
      }
      break;
    case 'notifyView':
      Redsift.Runtime.observable.notifyObservers(event.data.params.topic, event.data.params.value);
      break;
    default:
      console.error('redsift_cb: unexpected message from origin:', event.origin);
      break;
  }
}, false);
