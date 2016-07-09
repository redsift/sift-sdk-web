import ViewToControllerMessageBus from './view-to-controller-message-bus';

export default class ControllerMessageBus {
    constructor() {
        this.viewToControllerMessageBus = new ViewToControllerMessageBus();
        this._observable = Redsift.Runtime.observable;
    }

    subscribe(topic, listener) {
        this._observable.addObserver(topic, listener);
    }

    unsubscribe(topic, listener) {
        this._observable.removeObserver(topic, listener);
    }
}
