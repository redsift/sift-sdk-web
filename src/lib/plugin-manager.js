import SiftPlugins from '../plugins';

export default class PluginManager {
  _pluginFactory = SiftPlugins;
  _activePlugins = [];

  init = ({ pluginConfigs, contextType, context, global }) => {
    pluginConfigs.forEach(pluginConfig => {
      const Plugin = this._pluginFactory.find(
        Plugin => Plugin.id() === pluginConfig.id
      );

      if (Plugin && Plugin.contexts().includes(contextType)) {
        const plugin = new Plugin();
        if (plugin.init({ pluginConfigs, contextType, context, global })) {
          this._activePlugins.push(plugin);
        }
      }
    });
  };

  start = ({ pluginConfigs, contextType, context, global }) => {
    this._activePlugins.forEach(activePlugin =>
      activePlugin.start({ pluginConfigs, contextType, context, global })
    );
  };

  stop = ({ pluginConfigs, contextType, context, global }) => {
    this._activePlugins.forEach(activePlugin =>
      activePlugin.stop({ pluginConfigs, contextType, context, global })
    );
  };
}
