let instance = null;

export default class EmitterSingleton {
  constructor() {
    if (!instance) {
      instance = this;
    }

    this.listeners = {};
    this.uuid = 0;

    return instance;
  }

  on(event, listener) {
    if (event) {
      this.listeners[event] = listener;
    }
  }

  removeAllListeners(event) {
    if (event) {
      delete this.listeners[event];
    }
  }

  emit(event, params) {
    var listener = this.listeners[event];
    if (listener) {
      listener(params);
      return true;
    }
    return false;
  }

  reserveUUID(listener) {
    this.uuid = this.uuid + 1;
    this.on(this.uuid, listener);
    return '' + this.uuid;
  }
}
