export default class SyncHistory {
  static id = () => 'sync-history';
  static contexts = () => ['view'];

  _onNavigationHandlerFn = null;

  init = ({ pluginConfigs, contextType, context, global }) => {
    console.log('[SyncHistory::init()] called | contextType:', contextType);

    this._view = context;

    // NOTE: return true to start the plugin:
    return true;
  };

  setup({ history, initialPath = null }) {
    history.listen(navigationOp => {
      console.log('[SyncHistory] history change event::', JSON.stringify(navigationOp));

      this.navigate(navigationOp);
    });

    this.onNavigation(({ location, action }) => {
      console.log(`[sift-dmarc-insight] onNavigation | pathname: ${location.pathname} | action: ${action}`);
      history[action.toLowerCase()](location.pathname);
    });

    console.log('[SyncHistory::setup] initialPath:', initialPath);

    if (initialPath) {
      history.push(initialPath);
    }
  }

  navigate(navigationOp) {
    console.log(
      '[SyncHistory::sendEvent] location | navigationOp:',
      navigationOp
    );

    this._sendEventToCloud({ view: this._view, value: navigationOp });
  }

  onNavigation(handlerFn) {
    this._onNavigationHandlerFn = handlerFn;
  }

  onMessage(data) {
    console.log('[SyncHistory::onMessage] data:', data);

    const { location, action } = data;

    this._onNavigationHandlerFn({ location, action })    
  }

  _sendEventToCloud({ view, value = {} }) {
    const topic = SyncHistory.id();

    view.notifyClient(topic, value);
  }
}
