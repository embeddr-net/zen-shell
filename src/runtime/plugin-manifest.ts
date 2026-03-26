export type PluginManifestItem = {
  id: string;
  name: string;
  bundle: string;
};

export type PluginManifest = {
  plugins: PluginManifestItem[];
};

export type PluginManifestConfig = {
  publicUrl?: string;
  manifestUrl?: string;
};

export function resolvePluginManifestUrl(config?: PluginManifestConfig) {
  if (config?.manifestUrl) return config.manifestUrl;
  if (config?.publicUrl) {
    return `${config.publicUrl.replace(/\/$/, "")}/plugins/index.json`;
  }
  if (typeof window !== "undefined") {
    const runtimeManifest = (window as any).__EMBEDDR_PLUGIN_MANIFEST__ as
      | string
      | undefined;
    if (runtimeManifest) return runtimeManifest;
    const runtimePublic = (window as any).__EMBEDDR_PUBLIC_URL__ as
      | string
      | undefined;
    if (runtimePublic) {
      return `${runtimePublic.replace(/\/$/, "")}/plugins/index.json`;
    }
    if (window.location?.origin) {
      return `${window.location.origin}/plugins/index.json`;
    }
  }
  return undefined;
}

export async function fetchPluginManifest(manifestUrl?: string) {
  if (!manifestUrl) return null;
  const res = await fetch(manifestUrl);
  if (!res.ok) throw new Error("Failed to load plugin manifest");
  return (await res.json()) as PluginManifest;
}

export async function loadPluginBundle(bundleUrl: string) {
  return new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = bundleUrl;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${bundleUrl}`));
    document.head.appendChild(script);
  });
}
