export default class SiftControllerWorker {
    constructor(messageBus) {
      this.messageBus = messageBus;
    }

    notifyListeners(topic, value) {
      console.log('controller_worker: Sift.Controller.notifyListeners: ', topic, value);
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
