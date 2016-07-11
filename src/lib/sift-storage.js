import Logger from './logger';

export default class SiftStorage extends Logger {
    constructor(log) {
        super(log);

        // NOTE: The observable datastructure is provided by our runtime and correctly wired up to provide the subscribe/unsubscribe functionality.
        // all storage messages (i.e. updates).
        this.observable = null;

        // NOTE: 'treo' is an API for accessing the browser's IndexedDB. It is provided by our runtime and is correctly setup
        // to access the IndexedDB for the current Sift.
        this.treo = null;

        // When subscribing to the storage before the observable is available the handlers are kept in a waiting list and applied when
        // the observable is available.
        this.observableWaitingList = [];
    }

    subscribe(topic, handler) {
        this.logger.trace('[SiftStorage] subsribe: ', topic);
        // Some more info about the isArray check: http://web.mit.edu/jwalden/www/isArray.html
        if (Array.isArray(topic)) {
            topic.forEach((t) => {
                if (!this.observable) {
                  this.observableWaitingList.push({topic: t, handler: handler});
                } else {
                  this.observable.addObserver(t, handler);
                }
            });
        } else {
          if (!this.observable) {
            this.observableWaitingList.push({topic: topic, handler: handler});
          } else {
            this.observable.addObserver(t, handler);
          }
        }
    }

    unsubscribe(topic, handler) {
        this.logger.trace('[SiftStorage] unsubsribe: ', topic);
        this.observable.removeObserver(topic, handler);
    }

    // NOTE: kept only for legacy code in Sifts and controller_worker.js
    addUpdateListener(topic, handler) {
        this.subscribe(topic, handler)
    }

    // NOTE: kept only for legacy code in Sifts and controller_worker.js
    removeUpdateListener(topic, handler) {
        this.unsubscribe(topic, handler)
    }

    setObservable(observable) {
        this.observable = observable;
        this.observableWaitingList.forEach((item) => {
          this.observable.addObserver(item.topic, item.handler);
        });
        this.observableWaitingList = [];
    }

    setAPIInstance(treo) {
      this.treo = treo;
    }

    delUser(params) {
      return this.treo.delUser(params);
    }

    get(params) {
      return this.treo.get(params);
    }

    getAll(params) {
      return this.treo.getAll(params);
    }

    getAllKeys(params) {
      return this.treo.getAllKeys(params);
    }

    getIndex(params) {
      return this.treo.getIndex(params);
    }

    getIndexKeys(params) {
      return this.treo.getIndexKeys(params);
    }

    getUser(params) {
      return this.treo.getUser(params);
    }

    getWithIndex(params) {
      return this.treo.getWithIndex(params);
    }

    putUser(params) {
      return this.treo.putUser(params);
    }
}
