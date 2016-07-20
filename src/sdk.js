import EmailClientController from './lib/email-client-controller';
import SiftController from './lib/sift-controller.js';
import SiftStorage from './lib/sift-storage.js';

export { EmailClientController };
export { SiftController };
export { SiftStorage };
export { default as SiftView } from './lib/sift-view.js';

// FIXXME: using the global namespace to register a Sift is not optimal
export function registerSiftView(siftView) {
  window.Redsift = window.Redsift || {};
  window.Redsift.siftView = siftView;
}

export function createSiftView(instanceMethods) {
  let Sift = function() {
    Redsift.SiftView.call(this);
    if (this.init) {
      this.init();
    }
  }

  Sift.prototype = Object.create(Redsift.SiftView.prototype);
  Sift.prototype.constructor = Sift;

  let methodNames = Object.keys(instanceMethods);
  for (var idx = 0; idx < methodNames.length; idx++) {
    var name = methodNames[idx];
    var method = instanceMethods[name];
    Sift.prototype[name] = method;
  }

  window.Redsift = window.Redsift || {};
  window.Redsift.siftView = new Sift;

  return window.Redsift.siftView;
}

export function createSiftController(instanceMethods) {
  let Sift = function() {
    Redsift.SiftController.call(this);
    if (this.init) {
      this.init();
    }
  }

  Sift.prototype = Object.create(Redsift.SiftController.prototype);
  Sift.prototype.constructor = Sift;

  let methodNames = Object.keys(instanceMethods);
  for (var idx = 0; idx < methodNames.length; idx++) {
    var name = methodNames[idx];
    var method = instanceMethods[name];
    Sift.prototype[name] = method;
  }

  window.Redsift = window.Redsift || {};
  window.Redsift.siftController = new Sift;

  return window.Redsift.siftController;
}

export function registerSiftController(siftController) {
  console.log('controller registered dummy');
}
