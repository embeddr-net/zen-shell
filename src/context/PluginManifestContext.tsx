import React from "react";
import {
  fetchPluginManifest,
  loadPluginBundle,
  resolvePluginManifestUrl,
} from "../runtime/plugin-manifest";
import type { PluginManifestConfig, PluginManifestItem } from "../runtime/plugin-manifest";

const PluginManifestContext = React.createContext({
  isReady: false,
  isLoading: false,
  isError: false,
  errorMessage: null as string | null,
  manifestUrl: null as string | null,
  plugins: [] as Array<PluginManifestItem>,
});

export function PluginManifestProvider({
  children,
  manifestUrl,
  publicUrl,
  autoLoad = true,
}: React.PropsWithChildren<
  PluginManifestConfig & {
    autoLoad?: boolean;
  }
>) {
  const [state, setState] = React.useState(() => ({
    isReady: false,
    isLoading: false,
    isError: false,
    errorMessage: null as string | null,
    manifestUrl: resolvePluginManifestUrl({ manifestUrl, publicUrl }) ?? null,
    plugins: [] as Array<PluginManifestItem>,
  }));

  React.useEffect(() => {
    const resolved = resolvePluginManifestUrl({ manifestUrl, publicUrl }) ?? null;
    setState((prev) => ({ ...prev, manifestUrl: resolved }));
  }, [manifestUrl, publicUrl]);

  React.useEffect(() => {
    if (!autoLoad) return;
    if (!state.manifestUrl) return;

    let active = true;
    setState((prev) => ({ ...prev, isLoading: true, isError: false }));

    fetchPluginManifest(state.manifestUrl)
      .then((manifest) => {
        if (!manifest || !active) return;
        setState((prev) => ({
          ...prev,
          plugins: manifest.plugins,
          isLoading: false,
          isReady: true,
        }));
        manifest.plugins.forEach((plugin) => {
          loadPluginBundle(plugin.bundle).catch((err) => {
            console.error("Failed to load plugin bundle", plugin.bundle, err);
          });
        });
      })
      .catch((err) => {
        if (!active) return;
        setState((prev) => ({
          ...prev,
          isLoading: false,
          isError: true,
          errorMessage: err ? String(err) : "Failed to load manifest",
        }));
      });

    return () => {
      active = false;
    };
  }, [autoLoad, state.manifestUrl]);

  return <PluginManifestContext.Provider value={state}>{children}</PluginManifestContext.Provider>;
}

export function usePluginManifestContext() {
  return React.useContext(PluginManifestContext);
}
