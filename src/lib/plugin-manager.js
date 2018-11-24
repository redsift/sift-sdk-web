import SiftPlugins from '../plugins';

export default class PluginManager {
  _pluginFactory = SiftPlugins;
  _activePlugins = [];

  init = ({ pluginConfigs = [], contextType, context, global }) => {
    pluginConfigs.forEach(pluginConfig => {
      const Plugin = this._pluginFactory.find(
        Plugin => Plugin.id() === pluginConfig.id
      );

      if (Plugin && Plugin.contexts().includes(contextType)) {
        const plugin = new Plugin();
        if (
          plugin.init &&
          plugin.init({ pluginConfigs, contextType, context, global })
        ) {
          this._activePlugins.push(plugin);
        }
      }
    });
  };

  start = ({ pluginConfigs, contextType, context, global }) => {
    this._activePlugins.forEach(
      activePlugin =>
        activePlugin.start &&
        activePlugin.start({ pluginConfigs, contextType, context, global })
    );
  };

  stop = ({ pluginConfigs, contextType, context, global }) => {
    this._activePlugins.forEach(
      activePlugin =>
        activePlugin.stop &&
        activePlugin.stop({ pluginConfigs, contextType, context, global })
    );
  };

  onMessages = ({ messages }) => {
    console.log('[PluginManager::onMessages] messages:', messages);

    if (!Array.isArray(messages)) {
      throw new Error(
        '[PluginManager::receivePluginMessages] "messages" has to be an array!'
      );
    }

    messages.forEach(message => {
      console.log('[PluginManager::onMessage] message:', message);

      const plugin = this._activePlugins.find(
        plugin => plugin.constructor.id() === message.id
      );

      if (plugin) {
        console.log('[SyncHistory::onMessage] message.data:', message.data);
        plugin.onMessage(message.data);
      }
    });
  };

  getActivePlugins = () => {
    return this._activePlugins;
  };
}
