import EmailClientController from './lib/email-client-controller';
import SiftController from './lib/sift-controller.js';
import SiftStorage from './lib/sift-storage.js';

export { EmailClientController };
export { SiftController };
export { SiftStorage };
export { default as SiftView } from './lib/sift-view.js';

/**
 * SiftView
 */
export function registerSiftView(siftView) {
  console.log('[Redsift::registerSiftView]: registered');
}

export function createSiftView(instanceMethods) {
  return _create('SiftView', instanceMethods);
}

/**
 * SiftController
 */
export function createSiftController(instanceMethods) {
  return _create('SiftController', instanceMethods);
}

export function registerSiftController(siftController) {
  console.log('[Redsift::registerSiftController]: registered');
}

/**
 * EmailClientController
 */
export function createEmailClientController(instanceMethods) {
  return _create('EmailClientController', instanceMethods);
}

export function registerEmailClientController(emailClientController) {
  console.log('[Redsift::registerEmailClientController]: registered');
}

/**
 * Local functions
 */
function _create(type, methods) {
  let Creature = function() {
    Redsift[type].call(this);
  }
  Creature.prototype = Object.create(Redsift[type].prototype);
  Creature.prototype.constructor = Creature;
  Object.keys(methods).forEach((method) => {
    Creature.prototype[name] = method;
  });
  return new Creature();
}
