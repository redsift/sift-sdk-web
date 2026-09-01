// Events that count as "the user is active in the view"
const ACTIVITY_EVENTS = [
  'mousemove',
  'mousedown', // catches touchscreen presses as well
  'touchstart', // catches touchscreen swipes as well
  'click', // catches touchpad clicks as well
  'keydown',
];

// Activity is an on/off signal, so one event per window is plenty — without
// this every mousemove/scroll would cross the iframe boundary as a message
const ACTIVITY_THROTTLE_MS = 5000;

export default class TrackUiActivity {
  static id = () => 'track-ui-activity';
  static contexts = () => ['view'];

  _global = null;
  _view = null;
  _activityHandler = null;
  _lastSentAt = 0;

  init = () => {
    // NOTE: return true to start the plugin:
    return true;
  };

  start = ({ context, global }) => {
    if (this._activityHandler) {
      return;
    }
    this._global = global;
    this._view = context;
    this._activityHandler = () => this._reportActivity();
    ACTIVITY_EVENTS.forEach((type) =>
      global.addEventListener(type, this._activityHandler, { passive: true })
    );
    // NOTE: see https://stackoverflow.com/questions/23866902/how-to-detect-onscroll-event-on-an-iframe-the-iframes-source-is-of-the-same-do
    global.addEventListener('scroll', this._activityHandler, {
      capture: true,
      passive: true,
    });
    // The view having just started is itself activity
    this._reportActivity();
  };

  stop = () => {
    if (!this._activityHandler || !this._global) {
      return;
    }
    ACTIVITY_EVENTS.forEach((type) =>
      this._global.removeEventListener(type, this._activityHandler)
    );
    this._global.removeEventListener('scroll', this._activityHandler, {
      capture: true,
    });
    this._activityHandler = null;
    this._global = null;
    this._view = null;
  };

  _reportActivity() {
    const now = Date.now();
    if (now - this._lastSentAt < ACTIVITY_THROTTLE_MS) {
      return;
    }
    this._lastSentAt = now;
    this._sendEventToCloud({ view: this._view });
  }

  _sendEventToCloud({ view, value = {} }) {
    const topic = TrackUiActivity.id();

    view.notifyClient(topic, value);
  }
}
