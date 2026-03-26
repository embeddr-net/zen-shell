import { create } from "zustand";
import type { PluginDefinition } from "@embeddr/react-ui/types";

export interface PluginRegistryState {
  plugins: Record<string, PluginDefinition>;
  activePlugins: string[];
  knownPlugins: string[];
  backendMetadata: Record<string, any>;

  registerPlugin: (plugin: PluginDefinition) => void;
  unregisterPlugin: (pluginId: string) => void;
  activatePlugin: (pluginId: string) => void;
  deactivatePlugin: (pluginId: string) => void;
  setBackendMetadata: (metadata: Record<string, any>) => void;
}

export const usePluginRegistry = create<PluginRegistryState>((set, get) => ({
  plugins: {},
  activePlugins: [],
  knownPlugins: [],
  backendMetadata: {},

  setBackendMetadata: (metadata) => set({ backendMetadata: metadata }),

  registerPlugin: (plugin) => {
    const metadata = get().backendMetadata[plugin.id];
    if (metadata?.intents) {
      plugin.intents = metadata.intents;
    }

    set((state) => {
      if (state.plugins[plugin.id]) {
        return { plugins: { ...state.plugins, [plugin.id]: plugin } };
      }

      const isKnown = state.knownPlugins.includes(plugin.id);
      const isActive = state.activePlugins.includes(plugin.id);

      return {
        plugins: { ...state.plugins, [plugin.id]: plugin },
        knownPlugins: isKnown
          ? state.knownPlugins
          : [...state.knownPlugins, plugin.id],
        activePlugins: isActive
          ? state.activePlugins
          : [...state.activePlugins, plugin.id],
      };
    });
  },

  unregisterPlugin: (pluginId) =>
    set((state) => {
      const { [pluginId]: _, ...rest } = state.plugins;
      return {
        plugins: rest,
        activePlugins: state.activePlugins.filter((id) => id !== pluginId),
        knownPlugins: state.knownPlugins.filter((id) => id !== pluginId),
      };
    }),

  activatePlugin: (pluginId) =>
    set((state) => ({
      activePlugins: state.activePlugins.includes(pluginId)
        ? state.activePlugins
        : [...state.activePlugins, pluginId],
    })),

  deactivatePlugin: (pluginId) =>
    set((state) => ({
      activePlugins: state.activePlugins.filter((id) => id !== pluginId),
    })),
}));

export function registerPlugin(plugin: PluginDefinition) {
  usePluginRegistry.getState().registerPlugin(plugin);
}

export function unregisterPlugin(pluginId: string) {
  usePluginRegistry.getState().unregisterPlugin(pluginId);
}

export function listPlugins() {
  return Object.values(usePluginRegistry.getState().plugins);
}
