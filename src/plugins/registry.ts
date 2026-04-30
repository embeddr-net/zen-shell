import { create } from "zustand";
import type { PluginDefinition } from "@embeddr/react-ui/types";

export interface PluginRegistryState {
  plugins: Record<string, PluginDefinition>;
  activePlugins: Array<string>;
  knownPlugins: Array<string>;
  backendMetadata: Record<string, any>;

  registerPlugin: (plugin: PluginDefinition) => void;
  registerPlugins: (plugins: Array<PluginDefinition>) => void;
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
        knownPlugins: isKnown ? state.knownPlugins : [...state.knownPlugins, plugin.id],
        activePlugins: isActive ? state.activePlugins : [...state.activePlugins, plugin.id],
      };
    });
  },

  registerPlugins: (plugins) => {
    if (!plugins.length) return;

    set((state) => {
      const nextPlugins = { ...state.plugins };
      const known = new Set(state.knownPlugins);
      const active = new Set(state.activePlugins);

      for (const plugin of plugins) {
        const metadata = state.backendMetadata[plugin.id];
        const normalizedPlugin =
          metadata?.intents != null
            ? {
                ...plugin,
                intents: metadata.intents,
              }
            : plugin;

        nextPlugins[plugin.id] = normalizedPlugin;
        known.add(plugin.id);
        active.add(plugin.id);
      }

      return {
        plugins: nextPlugins,
        knownPlugins: Array.from(known),
        activePlugins: Array.from(active),
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

export function registerPlugins(plugins: Array<PluginDefinition>) {
  usePluginRegistry.getState().registerPlugins(plugins);
}

export function unregisterPlugin(pluginId: string) {
  usePluginRegistry.getState().unregisterPlugin(pluginId);
}

export function listPlugins() {
  return Object.values(usePluginRegistry.getState().plugins);
}
