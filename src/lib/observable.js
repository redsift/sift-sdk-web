/**
 * Observable pattern implementation.
 * Supports topics as String or Array.
 */
export default class Observable {
  constructor() {
    this.observers = [];
  }

  subscribe(topic, observer) {
    this._op('_sub', topic, observer);
  }

  unsubscribe(topic, observer) {
    this._op('_unsub', topic, observer);
  }

  unsubscribeAll(topic) {
    if (!this.observers[topic]) {
      return;
    }
    delete this.observers[topic];
  }

  publish(topic, message) {
    this._op('_pub', topic, message);
  }

  _op(op, topic, value) {
    if(Array.isArray(topic)) {
      topic.forEach((t) => {
        this[op](t, value);
      });
    }
    else {
      this[op](topic, value);
    }
  }

  _sub(topic, observer) {
    this.observers[topic] || (this.observers[topic] = []);
    this.observers[topic].push(observer);
  }

  _unsub(topic, observer) {
    if (!this.observers[topic]) {
      return;
    }
    var index = this.observers[topic].indexOf(observer);
    if (~index) {
      this.observers[topic].splice(index, 1);
    }
  }

  _pub(topic, message) {
    if (!this.observers[topic]) {
      return;
    }
    for (var i = this.observers[topic].length - 1; i >= 0; i--) {
      this.observers[topic][i](message)
    }
  }
}
