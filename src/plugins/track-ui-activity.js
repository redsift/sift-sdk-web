export default class TrackUiActivity {
  static id = () => 'track-ui-activity';
  static contexts = () => ['view'];

  init = ({ pluginConfigs, params, contextType, context, global }) => {
    console.log('[TrackUiActivity::init()] called');

    // NOTE: return true to start plugin:
    return true;
  };

  start = ({ pluginConfigs, params, contextType, context, global }) => {
    console.log('[TrackUiActivity::start()] called');
  };

  stop = ({ pluginConfigs, params, contextType, context, global }) => {
    console.log('[TrackUiActivity::stop()] called');
  };
}
