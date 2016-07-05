import ObservableSingleton from './observable-singleton.js';
import EmitterSingleton from './emitter-singleton.js';
import MessageBus from './message-bus';

export default class SiftController {
    constructor() {
        this._observable = Redsift.Runtime.observable;
        this._emitter = Redsift.Runtime.emitter;
        this.messageBus = MessageBus;
    }

    addEventListener(topic, listener) {
        this._observable.addObserver(topic, listener);
    }

    removeEventListener(topic, listener) {
        this._observable.removeObserver(topic, listener);
    }

    loadData(params) {
        return new Promise((resolve, reject) => {
            const uuid = _emitter.reserveUUID(function(params) {
                this._emitter.removeAllListeners(uuid);
                if (params.error) {
                    reject(params.error);
                } else {
                    resolve(params.result);
                }
            });
            this.messageBus.postMessage({
                method: 'loadData',
                params: params,
                uuid: uuid
            }, '*');
        });
    }
}
