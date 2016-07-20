import Observable from './observable';

export default class SiftStorage {
  constructor() {
    this._observable = new Observable();
  }

  init(treo) {
    Object.keys(treo).forEach((method) => {
      this[method] = treo[method];
    });
  }

  // Used only in the controller context
  subscribe(topic, handler) {
    this._observable.addObserver(topic, handler);
  }

  // Used only in the controller context
  unsubscribe(topic, handler) {
    this._observable.removeObserver(topic, handler);
  }

  // Used only in the controller context
  publish(topic, value) {
    this._observable.notifyObservers(topic, value);
  }
}
