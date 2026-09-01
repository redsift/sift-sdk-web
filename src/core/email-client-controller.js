export default class EmailClientController {
  constructor() {
    this._proxy = self;
    this._registerMessageListeners();
  }

  _registerMessageListeners() {
    if (!this._proxy || !this._proxy.addEventListener) return;
    // addEventListener instead of assigning onmessage, so the listener does
    // not clobber (or get clobbered by) other listeners on the worker scope
    this._proxy.addEventListener('message', (e) => {
      const data = e.data;
      if (
        !data ||
        typeof data !== 'object' ||
        typeof data.method !== 'string'
      ) {
        return;
      }
      const handler = this['_' + data.method];
      if (typeof handler === 'function') {
        handler.call(this, data.params);
      }
      // NOTE: unimplemented methods are silently ignored, the message may be
      // intended for another controller sharing the worker scope
    });
  }

  _emailStats(stats) {
    if (this.onstats) {
      this.onstats(stats.name, stats.value);
    }
  }

  _getThreadRowDisplayInfo(params) {
    // console.log('[EmailClientController::_getThreadRowDisplayInfo]: ', params);
    var trdis = {};
    params.tris.forEach((thread) => {
      if (
        thread.value !== undefined &&
        thread.value.list !== undefined &&
        this.loadThreadListView
      ) {
        trdis[thread.key] = this.loadThreadListView(
          thread.value.list,
          params.supportedTemplates
        );
      }
    });
    // Notify the client
    this._proxy.postMessage({
      method: 'getThreadRowDisplayInfoCallback',
      params: trdis,
    });
  }
}
