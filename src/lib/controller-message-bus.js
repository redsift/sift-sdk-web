import ViewToControllerMessageBus from './view-to-controller-message-bus';

export default class ControllerMessageBus {
    constructor() {
        this.viewToControllerMessageBus = new ViewToControllerMessageBus();
        this._observable = Redsift.Runtime.observable;
    }

    addEventListener(topic, listener) {
        this._observable.addObserver(topic, listener);
    }

    removeEventListener(topic, listener) {
        this._observable.removeObserver(topic, listener);
    }
}
