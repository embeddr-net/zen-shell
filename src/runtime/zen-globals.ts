type ZenGlobalMap = Record<string, unknown>;

declare global {
  interface Window {
    EmbeddrGlobals?: ZenGlobalMap;
  }
}

export const registerZenGlobals = (globals?: ZenGlobalMap) => {
  if (typeof window === "undefined") return;
  const target = window as unknown as ZenGlobalMap & Window;
  const source = globals || window.EmbeddrGlobals;
  if (!source) return;

  Object.entries(source).forEach(([key, value]) => {
    if (!target[key] && value !== undefined) {
      target[key] = value;
    }
  });
};
