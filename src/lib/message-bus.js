/**
 * iOS-specific initialisation (for Webkit)
 */
var parentWindow = parent;
if (parentWindow === window) { // assume iOS here since we should never be run as a standalone page
  parentWindow = {};
  parentWindow.postMessage = function (data, origin) {
    try {
      webkit.messageHandlers.handler.postMessage(data);
    }
    catch (err) {
      console.error('redsift_cb: could not post message to iOS', err);
      // Reject the request
      _emitter.emit(data.uuid, { error: 'Could not post message to iOS' });
    }
  };
}

export default parentWindow;
