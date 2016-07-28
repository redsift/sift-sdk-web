import EmailClientController from './lib/email-client-controller';
import SiftView from './lib/sift-view.js';
import SiftController from './lib/sift-controller.js';
import SiftStorage from './lib/sift-storage.js';

export { EmailClientController };
export { SiftController };
export { SiftStorage };
export { SiftView };

/**
 * SiftView
 */
export function registerSiftView(siftView) {
  console.log('[Redsift::registerSiftView]: registered');
}

export function createSiftView(instanceMethods) {
  return _create(SiftView, instanceMethods);
}

/**
 * SiftController
 */
export function createSiftController(instanceMethods) {
  return _create(SiftController, instanceMethods);
}

export function registerSiftController(siftController) {
  console.log('[Redsift::registerSiftController]: registered');
}

/**
 * EmailClientController
 */
export function createEmailClientController(instanceMethods) {
  return _create(EmailClientController, instanceMethods);
}

export function registerEmailClientController(emailClientController) {
  console.log('[Redsift::registerEmailClientController]: registered');
}

/**
 * Local functions
 */
function _create(Base, methods) {
  let Creature = function() {
    Base.call(this);
    if(this.init && typeof this.init === 'function') {
      this.init();
    }
  };
  Creature.prototype = Object.create(Base.prototype);
  Creature.constructor = Creature;
  Object.keys(methods).forEach((method) => {
    Creature.prototype[method] = methods[method];
  });
  return new Creature();
}
