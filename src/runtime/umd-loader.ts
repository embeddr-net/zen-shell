const loadedStyles = new Set<string>();
const loadedScripts = new Map<string, Promise<void>>();

export function ensureStylesheet(href: string) {
  if (!href || loadedStyles.has(href)) return;
  loadedStyles.add(href);
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  document.head.appendChild(link);
}

export function ensureScript(src: string) {
  if (!src) return Promise.reject(new Error("Missing script src"));
  const existing = loadedScripts.get(src);
  if (existing) return existing;
  const promise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      loadedScripts.delete(src);
      script.remove();
      reject(new Error(`Failed to load ${src}`));
    };
    document.body.appendChild(script);
  });
  loadedScripts.set(src, promise);
  return promise;
}

export function ensureUmdBundle({
  scriptUrl,
  cssUrl,
}: {
  scriptUrl: string | null;
  cssUrl?: string | null;
}) {
  if (cssUrl) ensureStylesheet(cssUrl);
  if (!scriptUrl) return Promise.reject(new Error("Missing script URL"));
  return ensureScript(scriptUrl);
}

export function resolvePluginGlobal(pluginId: string) {
  const libName = pluginId.replace(/[^a-zA-Z0-9]/g, "_") + "Plugin";
  return (window as any)[libName] ?? null;
}
