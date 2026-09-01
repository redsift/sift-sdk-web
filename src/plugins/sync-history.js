// Maps a navigation action from the client onto a history method. A POP
// (back/forward already performed by the client) is mirrored with `replace`
// so it does not create a new history entry inside the view.
const NAVIGATION_ACTIONS = {
  push: 'push',
  replace: 'replace',
  pop: 'replace',
};

export default class SyncHistory {
  static id = () => 'sync-history';
  static contexts = () => ['view'];

  _onNavigationHandlerFn = null;
  _view = null;
  _cloudNavigationInProgress = false;

  init = ({ context }) => {
    this._view = context;

    // NOTE: return true to start the plugin:
    return true;
  };

  setup({ history, initialPath = null }) {
    // NOTE: react-router v3 sends the `action` as part of the `navigationOp`,
    // react-router v4 sends it as a separate parameter and the history v5
    // package bundles both as `{ location, action }`:
    history.listen((navigationOp, action = null) => {
      // NOTE: prevent recursion when the back/next button is pressed in Cloud:
      if (this._cloudNavigationInProgress) {
        this._cloudNavigationInProgress = false;
        return;
      }
      let op = navigationOp;
      if (op && op.location && typeof op.location === 'object') {
        op = { ...op.location, action: op.action || action };
      } else if (op && !op.action) {
        op = { ...op, action };
      }
      this.navigate(op);
    });

    this.onNavigation(({ location, action }) => {
      if (!location || typeof location.pathname !== 'string') {
        console.warn('[SyncHistory::onNavigation] invalid location:', location);
        return;
      }
      const op =
        NAVIGATION_ACTIONS[String(action || 'push').toLowerCase()] || 'push';
      if (typeof history[op] !== 'function') {
        console.warn(
          `[SyncHistory::onNavigation] history does not implement "${op}"`
        );
        return;
      }
      this._cloudNavigationInProgress = true;
      history[op](location.pathname + (location.search || ''));
    });

    if (initialPath) {
      history.push(initialPath);
    }
  }

  navigate(navigationOp) {
    this._sendEventToCloud({ view: this._view, value: navigationOp });
  }

  onNavigation(handlerFn) {
    this._onNavigationHandlerFn = handlerFn;
  }

  onMessage(data) {
    if (!data || typeof data !== 'object') {
      console.warn('[SyncHistory::onMessage] invalid message data:', data);
      return;
    }
    const { location, action } = data;

    this._onNavigationHandlerFn &&
      this._onNavigationHandlerFn({ location, action });
  }

  _sendEventToCloud({ view, value = {} }) {
    const topic = SyncHistory.id();

    view.notifyClient(topic, value);
  }
}
