import { resolveApiBase } from "@embeddr/client-typescript";
import type { PluginLoaderAdapter, PluginManifest } from "../plugins/loader";

export const createPluginLoaderAdapter = ({
  backendUrl,
  apiKey,
}: {
  backendUrl: string;
  apiKey?: string;
}): PluginLoaderAdapter => {
  const baseUrl = resolveApiBase(backendUrl, "/api");

  return {
    list: async () => {
      if (!baseUrl) return [];
      const res = await fetch(`${baseUrl}/plugins`, {
        headers: apiKey ? { "X-API-Key": apiKey } : undefined,
        credentials: "include",
      });
      if (!res.ok) return [];
      return (await res.json()) as Array<PluginManifest>;
    },
    resolveScriptUrl: (manifest) => {
      const plugin = manifest as any;
      const url = plugin.url as string | undefined;
      if (!url) return "";
      if (!baseUrl) return url;
      if (url.startsWith("http")) return url;
      const origin = new URL(baseUrl).origin;
      return `${origin}${url}`;
    },
    resolveCssUrl: (manifest) => {
      const plugin = manifest as any;
      const cssUrl = plugin.css_url as string | undefined;
      if (!cssUrl) return null;
      if (!baseUrl) return cssUrl;
      if (cssUrl.startsWith("http")) return cssUrl;
      const origin = new URL(baseUrl).origin;
      return `${origin}${cssUrl}`;
    },
  };
};
