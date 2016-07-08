import SiftStorage from './sift-storage';

export default class SiftController {
    constructor() {
      // Create a 'shallow' storage instance. The storage is initialized via 'initStorage()' by the controller_worker
      // after the worker is initialized. Subscribe handlers can be registered before the storage is initialized. The
      // handlers will be wired up correctly after the observable becomes available in the storage instance.
      const observable = null;
      this.storage = new SiftStorage(observable);

      this.viewSubscriptionWaitingList = [];
    }

    initMessageBus(messageBus) {
      this.messageBus = messageBus;
    }

    setView(siftView) {
      this.view = siftView;
      this.viewSubscriptionWaitingList.forEach((item) => {
        this.view.addEventListener(item.eventName, item.handler);
      });
      this.viewSubscriptionWaitingList = [];
    };

    initStorage(observable) {
      this.storage.setObservable(observable);
    }

    setStorageAPIInstance(treo) {
      this.storage.setAPIInstance(treo) ;
    }

    subscribe(eventName, handler) {
      if (!this.view) {
        this.viewSubscriptionWaitingList.push({ eventName: eventName, handler: handler });
      } else {
        this.view.addEventListener(eventName, function(value) {
            handler(value);
        });
      }
    }

    publish(topic, value) {
      console.log('[SiftController::publish] ', topic, value);
      if (!this.messageBus) {
        throw new Error('[SiftControllerWorker] no message bus defined. Messages will NOT be forwarded to the Sift view!');
      }

      this.messageBus.postMessage({
        method: 'notifyView',
        params: {
          topic: topic,
          value: value
        }
      });
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
