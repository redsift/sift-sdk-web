/* eslint-disable no-unused-vars */
import EmailClientController from './core/email-client-controller';
import SiftView from './core/sift-view';
import SiftController from './core/sift-controller';
import SiftStorage from './core/sift-storage';

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

export function createSiftView(instanceMethods, options) {
  return _create(SiftView, instanceMethods, options);
}

/**
 * SiftController
 */
export function createSiftController(instanceMethods, options) {
  return _create(SiftController, instanceMethods, options);
}

export function registerSiftController(siftController) {
  console.log('[Redsift::registerSiftController]: registered');
}

/**
 * EmailClientController
 */
export function createEmailClientController(instanceMethods, options) {
  return _create(EmailClientController, instanceMethods, options);
}

export function registerEmailClientController(emailClientController) {
  console.log('[Redsift::registerEmailClientController]: registered');
}

/**
 * Local functions
 */
function _create(Base, methods, options) {
  class Creature extends Base {
    constructor() {
      super(options);
      if (typeof this.init === 'function') {
        this.init();
      }
    }
  }
  Object.keys(methods || {}).forEach((method) => {
    Creature.prototype[method] = methods[method];
  });
  return new Creature();
}
