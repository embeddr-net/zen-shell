import { usePluginRegistry } from "./registry";

type LocationMatch = { pluginId: string; def: any };

function getActivePluginIds() {
  const state = usePluginRegistry.getState();
  return state.activePlugins || [];
}

function getPluginMap() {
  return usePluginRegistry.getState().plugins || {};
}

export function getPluginComponentsByLocation(location: string): LocationMatch[] {
  const plugins = getPluginMap();
  const activePluginIds = getActivePluginIds();
  const out: LocationMatch[] = [];

  for (const pluginId of activePluginIds) {
    const plugin = plugins[pluginId];
    if (!plugin?.components?.length) continue;
    for (const comp of plugin.components) {
      if (comp.location === location) {
        out.push({ pluginId, def: comp });
      }
    }
  }

  return out;
}

export function getPluginActionsByLocation(location: string): LocationMatch[] {
  const plugins = getPluginMap();
  const activePluginIds = getActivePluginIds();
  const out: LocationMatch[] = [];

  for (const pluginId of activePluginIds) {
    const plugin = plugins[pluginId];
    if (!plugin?.actions?.length) continue;
    for (const action of plugin.actions) {
      if (action.location === location) {
        out.push({ pluginId, def: action });
      }
    }
  }

  return out;
}
