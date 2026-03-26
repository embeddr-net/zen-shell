export type PluginRuntime = Record<string, unknown>;

export type PluginComponentEntry = {
  key: string;
  component: React.ComponentType<any>;
};

export function getPluginGlobalName(pluginId: string) {
  const base = pluginId.replace(/[^a-zA-Z0-9]/g, "_");
  return `${base}Plugin`;
}

export function resolvePluginRuntime(pluginId: string): PluginRuntime | null {
  if (typeof window === "undefined") return null;
  const base = pluginId.replace(/[^a-zA-Z0-9]/g, "_");
  const candidates = [`${base}Plugin`, `${base}plugin`, base, pluginId];

  for (const name of candidates) {
    const runtime = (window as any)[name];
    if (runtime) return runtime as PluginRuntime;
  }

  return null;
}

export function listPluginPanels(runtime: PluginRuntime | null) {
  if (!runtime) return [] as PluginComponentEntry[];

  const entries = Object.entries(runtime).filter(
    ([, value]) => typeof value === "function",
  );

  const matches = entries.filter(([key]) => /Panel$|Effect$/.test(String(key)));

  const defaultExport = entries.find(([key]) => key === "default");

  const combined = [
    ...matches,
    ...(defaultExport && !matches.includes(defaultExport)
      ? [defaultExport]
      : []),
  ];

  return combined.map(([key, value]) => ({
    key,
    component: value as React.ComponentType<any>,
  }));
}
