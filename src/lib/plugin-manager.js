import SiftPlugins from '../plugins';

export default class PluginManager {
  _pluginFactory = SiftPlugins;
  _activePlugins = [];

  init = ({ pluginConfigs = [], contextType, context, global } = {}) => {
    if (!Array.isArray(pluginConfigs)) {
      return;
    }
    pluginConfigs.forEach((pluginConfig) => {
      if (!pluginConfig || typeof pluginConfig !== 'object') {
        return;
      }
      const Plugin = this._pluginFactory.find(
        (Plugin) => Plugin.id() === pluginConfig.id
      );

      if (!Plugin || !Plugin.contexts().includes(contextType)) {
        return;
      }
      // Guard against double initialisation (e.g. a replayed init message)
      if (
        this._activePlugins.some(
          (activePlugin) => activePlugin.constructor.id() === pluginConfig.id
        )
      ) {
        return;
      }
      const plugin = new Plugin();
      if (
        plugin.init &&
        plugin.init({ pluginConfigs, contextType, context, global })
      ) {
        this._activePlugins.push(plugin);
      }
    });
  };

  start = ({ pluginConfigs, contextType, context, global } = {}) => {
    this._activePlugins.forEach(
      (activePlugin) =>
        activePlugin.start &&
        activePlugin.start({ pluginConfigs, contextType, context, global })
    );
  };

  stop = ({ pluginConfigs, contextType, context, global } = {}) => {
    this._activePlugins.forEach(
      (activePlugin) =>
        activePlugin.stop &&
        activePlugin.stop({ pluginConfigs, contextType, context, global })
    );
    // Stopped plugins are gone; a new init/start cycle re-creates them
    this._activePlugins = [];
  };

  onMessages = ({ messages }) => {
    if (!Array.isArray(messages)) {
      throw new Error(
        '[PluginManager::onMessages] "messages" has to be an array!'
      );
    }

    messages.forEach((message) => {
      if (!message || typeof message !== 'object') {
        return;
      }
      const plugin = this._activePlugins.find(
        (plugin) => plugin.constructor.id() === message.id
      );

      if (plugin && typeof plugin.onMessage === 'function') {
        plugin.onMessage(message.data);
      }
    });
  };

  getActivePlugins = () => {
    return this._activePlugins;
  };
}
