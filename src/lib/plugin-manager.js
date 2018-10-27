import SiftPlugins from '../plugins';

export default class PluginManager {
  _pluginFactory = SiftPlugins;
  _activePlugins = [];

  init = ({ pluginConfigs, params, contextType, context, global }) => {
    pluginConfigs.forEach(pluginConfig => {
      const Plugin = this._pluginFactory.find(
        Plugin => Plugin.id() === pluginConfig.id
      );

      if (Plugin && Plugin.contexts().includes(contextType)) {
        const plugin = new Plugin();
        if (plugin.init(params)) {
          this._activePlugins.push(plugin);
        }
      }
    });
  };

  start = ({ pluginConfigs, params, contextType, context, global }) => {
    this._activePlugins.forEach(activePlugin =>
      activePlugin.start({ pluginConfigs, params })
    );
  };

  stop = ({ pluginConfigs, params, contextType, context, global }) => {
    this._activePlugins.forEach(activePlugin =>
      activePlugin.stop({ pluginConfigs, params })
    );
  };
}
