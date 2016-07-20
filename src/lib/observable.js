/**
 * Observable pattern implementation
 */
export default class Observable {
  constructor() {
    this.observers = [];
  }

  subscribe(topic, observer) {
    this.observers[topic] || (this.observers[topic] = []);
    this.observers[topic].push(observer);
  }

  unsubscribe(topic, observer) {
    if (!this.observers[topic]) {
      return;
    }
    var index = this.observers[topic].indexOf(observer);
    if (~index) {
      this.observers[topic].splice(index, 1);
    }
  }

  publish(topic, message) {
    if (!this.observers[topic]) {
      return;
    }
    for (var i = this.observers[topic].length - 1; i >= 0; i--) {
      this.observers[topic][i](message)
    }
  }
}
