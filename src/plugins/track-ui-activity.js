export default class TrackUiActivity {
  static id = () => 'track-ui-activity';
  static contexts = () => ['view'];

  init = ({ pluginConfigs, contextType, context, global }) => {
    console.log('[TrackUiActivity::init()] called | contextType:', contextType);

    // NOTE: return true to start the plugin:
    return true;
  };

  start = ({ pluginConfigs, contextType, context, global }) => {
    console.log('[TrackUiActivity::start()] called | contextType:', contextType);

    // NOTE: see https://stackoverflow.com/questions/23866902/how-to-detect-onscroll-event-on-an-iframe-the-iframes-source-is-of-the-same-do
    global.onload = () => { this._sendEventToCloud({ view: context })};
    global.onmousemove = () => { this._sendEventToCloud({ view: context })};
    global.onmousedown = () => { this._sendEventToCloud({ view: context })}; // catches touchscreen presses as well
    global.ontouchstart = () => { this._sendEventToCloud({ view: context })}; // catches touchscreen swipes as well
    global.onclick = () => { this._sendEventToCloud({ view: context })}; // catches touchpad clicks as well
    global.onkeypress = () => { this._sendEventToCloud({ view: context })};
    global.addEventListener('scroll', () => { this._sendEventToCloud({ view: context })}, true);
  };

  stop = ({ pluginConfigs, contextType, context, global }) => {
    console.log('[TrackUiActivity::stop()] called | contextType:', contextType);

    global.onload = null;
    global.onmousemove = null;
    global.onmousedown = null; // catches touchscreen presses as well
    global.ontouchstart = null; // catches touchscreen swipes as well
    global.onclick = null; // catches touchpad clicks as well
    global.onkeypress = null;
    global.addEventListener('scroll', null, true);
  };

  _sendEventToCloud({ view, value = {} }) {
    const topic = TrackUiActivity.id();

    view.notifyClient(topic, value);
  }
}
