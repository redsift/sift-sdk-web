import Observable from './observable';

export default class EmailClient {
  constructor() {
    this._observable = new Observable();
  }

  subscribe(topic, handler) {
    this._observable.addObserver(t, handler);
  }

  unsubscribe(topic, handler) {
    this._observable.removeObserver(topic, handler);
  }

  publish(topic, value) {
    this._observable.notifyObservers(topic, value);
  }
}
