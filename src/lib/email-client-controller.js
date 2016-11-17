export default class EmailClientController {
  constructor() {
    this._proxy = self;
    this._registerMessageListeners();
  }

  _registerMessageListeners() {
    if(!this._proxy) return;
    this._proxy.onmessage = (e) => {
      // console.log('[SiftController::onmessage]: ', e.data);
      let method = e.data.method;
      if (this['_' + method]) {
        this['_' + method](e.data.params);
      }
      else {
        // console.log('[EmailClientController::onmessage]: method not implemented: ', method);
      }
    };
  }

  _emailStats(stats) {
    if(this.onstats) {
      this.onstats(stats.name, stats.value);
    }
  }

  _getThreadRowDisplayInfo(params) {
    // console.log('[EmailClientController::_getThreadRowDisplayInfo]: ', params);
    var trdis = {};
    params.tris.forEach((thread) => {
      if (thread.value !== undefined && thread.value.list !== undefined && this.loadThreadListView) {
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
