import type { PluginDefinition } from "@embeddr/react-ui/types";

type PluginComponentDefLike = NonNullable<PluginDefinition["components"]>[number] & {
  exportName?: string;
  props?: Record<string, unknown>;
  location?: string;
};

export type PluginComponentEntry = {
  pluginId: string;
  def: PluginComponentDefLike;
};

export type ResolvedPluginComponent = {
  pluginId: string;
  componentName: string;
  def?: PluginComponentDefLike;
};

export const getEntryKey = (entry: PluginComponentEntry) => `${entry.pluginId}:${entry.def.id}`;

function isWindowLocation(location?: string | null) {
  const normalized = String(location || "").toLowerCase();
  return normalized === "window" || normalized === "zen-overlay" || normalized === "page";
}

function normalizeKey(value?: string | null) {
  return String(value || "")
    .replace(/[-_]/g, "")
    .toLowerCase();
}

export function collectPluginComponents(
  plugins: Record<string, PluginDefinition | unknown>,
): Array<PluginComponentEntry> {
  const all: Array<PluginComponentEntry> = [];

  Object.values(plugins || {}).forEach((plugin) => {
    const typedPlugin = plugin as PluginDefinition;

    (typedPlugin.components || []).forEach((def) => {
      const typedDef = def as PluginComponentDefLike;
      if (!typedPlugin.id || !typedDef?.id || !isWindowLocation(typedDef.location)) {
        return;
      }
      all.push({ pluginId: typedPlugin.id, def: typedDef });
    });
  });

  return all;
}

export function resolvePluginComponent(
  componentId: string,
  plugins: Record<string, PluginDefinition | unknown>,
): ResolvedPluginComponent | null {
  const pluginIds = Object.keys(plugins || {});
  let bestMatch: string | null = null;

  for (const pluginId of pluginIds) {
    const prefix = `${pluginId}-`;
    if (componentId.startsWith(prefix)) {
      if (!bestMatch || pluginId.length > bestMatch.length) {
        bestMatch = pluginId;
      }
    }
  }

  if (!bestMatch) return null;

  const defId = componentId.slice(bestMatch.length + 1);
  const defNorm = normalizeKey(defId);
  const plugin = plugins[bestMatch] as PluginDefinition | undefined;
  const components = (plugin?.components || []) as Array<PluginComponentDefLike>;
  const def =
    components.find((component) => {
      const typedComponent = component;
      return (
        typedComponent?.id === defId ||
        typedComponent?.exportName === defId ||
        (typedComponent as any)?.name === defId
      );
    }) ||
    components.find((component) => {
      const typedComponent = component;
      return (
        normalizeKey(typedComponent?.id) === defNorm ||
        normalizeKey((typedComponent as any)?.name) === defNorm ||
        normalizeKey(typedComponent?.exportName) === defNorm ||
        normalizeKey((typedComponent as any)?.component) === defNorm
      );
    });

  const componentName = def?.exportName || def?.id || defId;

  return { pluginId: bestMatch, componentName, def };
}
