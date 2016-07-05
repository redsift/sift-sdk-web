import SiftController from './lib/sift-controller.js';
import SiftControllerWorker from './lib/sift-controller-worker.js';
import SiftStorage from './lib/sift-storage.js';
import SiftView from './lib/sift-view.js';
// import ObservableSingleton from './lib/observable-singleton';
// import EmitterSingleton from './lib/emitter-singleton';
import MessageBus from './lib/message-bus';

export { SiftController };
export { SiftControllerWorker };
export { SiftStorage };
export { SiftView };
// export { ObservableSingleton };
// export { EmitterSingleton };
export { MessageBus };

// FIXXME: using the global namespace to register a Sift is not optimal
export function registerSiftView(siftView) {
  window.Redsift = window.Redsift || {};
  window.Redsift.siftView = siftView;
}

// FIXXME: using the global namespace to register a Sift is not optimal
export function registerSiftController(siftController) {
  window.Redsift = window.Redsift || {};
  window.Redsift.siftController = siftController;
}

/**
 * Redsift's webview polyfill
 *
//  * Copyright (c) 2015 Redsift Limited. All rights reserved.
//  p*/
// (function (window) {
//   'use strict';
//
//   let _observable = new ObservableSingleton;
//   let _emitter = new EmitterSingleton;
//
//   /**
//    * Controller
//    */
//   function Controller() { }
//   Controller.prototype.addEventListener = function (topic, listener) {
//     _observable.addObserver(topic, listener);
//   }
//   Controller.prototype.removeEventListener = function (topic, listener) {
//     _observable.removeObserver(topic, listener);
//   }
//   /**
//    * Controller functions
//    */
//   // Loads the required data from the controller
//   Controller.prototype.loadData = function (params) {
//     return new Promise(function (resolve, reject) {
//       var uuid = _emitter.reserveUUID(function (params) {
//         _emitter.removeAllListeners(uuid);
//         if (params.error) {
//           reject(params.error);
//         }
//         else {
//           resolve(params.result);
//         }
//       });
//       messageBus.postMessage({ method: 'loadData', params: params, uuid: uuid }, '*');
//     });
//   };
//
//   // /**
//   //  * View object setup
//   //  */
//   // function View() {
//   //   /**
//   //   * Popup config
//   //   */
//   //   if (window.self !== window.top) {
//   //     // in frame
//   //     this.popupAllowed = true;
//   //   }
//   //   else {
//   //     // not in frame
//   //     this.popupAllowed = false;
//   //   }
//   // }
//   // View.prototype.notifyListeners = function (topic, value) {
//   //   parentWindow.postMessage({ method: 'notifyController', params: { topic: topic, value: value } }, '*');
//   // };
//
//   // /**
//   //  * iOS-specific initialisation (for Webkit)
//   //  */
//   // var parentWindow = parent;
//   // if (parentWindow === window) { // assume iOS here since we should never be run as a standalone page
//   //   parentWindow = {};
//   //   parentWindow.postMessage = function (data, origin) {
//   //     try {
//   //       webkit.messageHandlers.handler.postMessage(data);
//   //     }
//   //     catch (err) {
//   //       console.error('redsift_cb: could not post message to iOS', err);
//   //       // Reject the request
//   //       _emitter.emit(data.uuid, { error: 'Could not post message to iOS' });
//   //     }
//   //   };
//   // }
//
//   // Export to window
//   window.Sift = window.Sift || {};
//   // window.Sift.View = new View();
//   window.Sift.Controller = new Controller();
// })(window);
