// Internal machinery that must never be invokable through an inbound
// worker message ('registerMessageListeners' would otherwise install a
// duplicate listener per message)
const NON_DISPATCHABLE_HANDLERS = ['_registerMessageListeners'];

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
      const handlerName = '_' + data.method;
      const handler = NON_DISPATCHABLE_HANDLERS.includes(handlerName)
        ? null
        : this[handlerName];
      if (typeof handler === 'function') {
        handler.call(this, data.params);
      }
      // NOTE: unimplemented methods are silently ignored, the message may be
      // intended for another controller sharing the worker scope
    });
  }

  _emailStats(stats) {
    if (!stats || typeof stats !== 'object') {
      return;
    }
    if (this.onstats) {
      this.onstats(stats.name, stats.value);
    }
  }

  _getThreadRowDisplayInfo(params) {
    // console.log('[EmailClientController::_getThreadRowDisplayInfo]: ', params);
    if (!params || !Array.isArray(params.tris)) {
      return;
    }
    var trdis = {};
    params.tris.forEach((thread) => {
      if (
        thread &&
        thread.value != null &&
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
