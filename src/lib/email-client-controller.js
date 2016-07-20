import Observable from './observable';

export default class EmailClientController {
  constructor() {
    this._proxy = self;
    this._observable = new Observable();
  }

  on(topic, handler) {
    this._observable.addObserver(topic, handler);
  }

  _registerMessageListeners() {
    if(!this._proxy) return;
    this._proxy.onmessage = (e) => {
      console.log('[SiftController::onmessage]: ', e.data);
      let method = e.data.method;
      if (this['_' + method]) {
        this[method](e.data.params);
      }
      else {
        console.log('[EmailClientController::onmessage]: method not implemented: ', method);
      }
    };
  }

  _emailStats(stats) {
    this._observable.notifyObservers(stats.name, stats.value);
  }

  _getThreadRowDisplayInfo(params) {
    rslog.trace('[EmailClientController::_getThreadRowDisplayInfo]: ', params);
    var trdis = {};
    params.tris.forEach((thread) => {
      if (this.loadThreadListView) {
        trdis[thread.key] = this.loadThreadListView(thread.value.list, params.supportedTemplates);
      }
    });
    // Notify the client
    this._proxy.postMessage({
      method: 'getThreadRowDisplayInfoCallback',
      params: trdis
    });
  }
}