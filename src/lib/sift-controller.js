export default class SiftControllerWorker {
    setMessageBus(messageBus) {
      this.messageBus = messageBus;
    }

    subscribe(eventName, handler) {
      Sift.View.addEventListener(eventName, function(value) {
        handler(value);
      });
    }

    notifyListeners(topic, value) {
      console.log('controller_worker: Sift.ControllerWorker.notifyListeners: ', topic, value);
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
