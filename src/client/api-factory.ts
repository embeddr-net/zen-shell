/**
 * @module api-factory
 *
 * Shared factory for building EmbeddrAPI instances that any distro (Sprout, etc.)
 * can use instead of hand-wiring 400+ lines of stubs.
 *
 * The factory takes a config (backend URL, API key, window store hooks) and
 * returns a fully-formed `EmbeddrAPI` object with sensible defaults for
 * every required method.
 */

import type { EmbeddrAPI } from "@embeddr/react-ui/types";
import {
  createEmbeddrClient,
  createFetchWithAuth,
  resolveApiBase,
  resolveAssetBase,
} from "@embeddr/client-typescript";
import { globalEventBus } from "../events/event-bus";
import { usePluginRegistry } from "../plugins/registry";
import {
  getPluginActionsByLocation,
  getPluginComponentsByLocation,
} from "../plugins/context-actions";

export type EmbeddrAPIConfig = {
  /** Backend URL (e.g. "http://localhost:8003") */
  backendUrl: string;
  /** Optional API key */
  apiKey?: string;
  /** API base path (defaults to "/api") */
  apiBasePath?: "/api" | "/api/v1" | "/api/v2";
  /** Window store callbacks */
  windows?: {
    open: (id: string, title: string, componentId: string, props?: any) => void;
    spawn: (componentId: string, title: string, props?: any) => string;
    getState?: () => any;
    list?: () => Array<any>;
  };
  /** Override toast handlers */
  toast?: {
    success: (message: string) => void;
    error: (message: string) => void;
    info: (message: string) => void;
  };
  /** Optional storage key prefix for settings (defaults to "embeddr") */
  settingsPrefix?: string;
};

const notImplemented = async (): Promise<never> => {
  throw new Error("Not implemented");
};

const readSetting = <T>(key: string, defaultValue?: T): T => {
  if (typeof window === "undefined") return defaultValue as T;
  const raw = window.localStorage.getItem(key);
  if (!raw) return defaultValue as T;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return (raw as T) ?? (defaultValue as T);
  }
};

const writeSetting = (key: string, value: any) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
};

const ABSOLUTE_URL_RE = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//;
const PROTOCOL_RELATIVE_URL_RE = /^\/\//;

const joinUrl = (base: string, path: string) => {
  const cleanBase = String(base || "").replace(/\/+$/, "");
  const cleanPath = String(path || "").replace(/^\/+/, "");
  if (!cleanBase) return cleanPath ? `/${cleanPath}` : "";
  return cleanPath ? `${cleanBase}/${cleanPath}` : cleanBase;
};

const resolvePluginRequestUrl = (
  pluginBase: string,
  assetBase: string,
  path: string,
) => {
  const raw = String(path || "").trim();
  if (!raw) return pluginBase;
  if (ABSOLUTE_URL_RE.test(raw)) return raw;
  if (PROTOCOL_RELATIVE_URL_RE.test(raw)) {
    if (typeof window !== "undefined") {
      return `${window.location.protocol}${raw}`;
    }
    return `https:${raw}`;
  }
  if (raw.startsWith("/api/") || raw.startsWith("/plugins/")) {
    return joinUrl(assetBase, raw);
  }
  return joinUrl(pluginBase, raw);
};

const shouldAddJsonContentType = (init?: RequestInit) => {
  if (!init?.body || typeof init.body !== "string") return false;
  const headers = new Headers(init.headers || {});
  return !headers.has("Content-Type");
};

const signResolvedValue = <T>(
  value: T,
  signUrl: (url: string) => string,
): T => {
  if (!value || typeof value !== "object") return value;

  if (Array.isArray(value)) {
    return value.map((item) => signResolvedValue(item, signUrl)) as T;
  }

  const next = { ...(value as Record<string, any>) };

  if (typeof next.url === "string") next.url = signUrl(next.url);
  if (typeof next.content_url === "string") {
    next.content_url = signUrl(next.content_url);
  }
  if (typeof next.preview_url === "string") {
    next.preview_url = signUrl(next.preview_url);
  }
  if (Array.isArray(next.items)) {
    next.items = next.items.map((item: any) =>
      signResolvedValue(item, signUrl),
    );
  }
  if (next.artifact && typeof next.artifact === "object") {
    next.artifact = signResolvedValue(next.artifact, signUrl);
  }

  return next as T;
};

/**
 * Build a fully-formed EmbeddrAPI from a simple configuration.
 * All methods have sensible defaults; distros can override specific slices.
 */
export function createEmbeddrAPI(config: EmbeddrAPIConfig): EmbeddrAPI {
  const {
    backendUrl,
    apiKey,
    apiBasePath = "/api",
    settingsPrefix = "embeddr",
  } = config;

  const client = createEmbeddrClient({ backendUrl, apiKey, apiBasePath });
  const apiBase = client.apiBase || resolveApiBase(backendUrl, apiBasePath);
  const pluginApiBase = resolveApiBase(backendUrl, "/api");
  const assetBase = client.assetBase || resolveAssetBase(backendUrl);

  const authFetch = createFetchWithAuth({
    getToken: () => apiKey || null,
  });

  const signProtectedUrl = (url: string) => {
    if (!url || !apiKey) return url;
    try {
      const baseUrl =
        assetBase ||
        backendUrl ||
        (typeof window !== "undefined"
          ? window.location.origin
          : "http://localhost");
      const parsed = new URL(url, baseUrl);
      const assetOrigin = new URL(baseUrl).origin;
      const windowOrigin =
        typeof window !== "undefined" ? window.location.origin : assetOrigin;
      const isInternal =
        parsed.origin === assetOrigin || parsed.origin === windowOrigin;
      const isProtectedPath =
        parsed.pathname.startsWith("/api/") ||
        parsed.pathname.startsWith("/plugins/");
      if (!isInternal || !isProtectedPath) return parsed.toString();
      parsed.searchParams.set("api_key", apiKey);
      return parsed.toString();
    } catch {
      return url;
    }
  };

  const securityBase = resolveSecurityBase(assetBase);

  const requestJson = async <T>(
    url: string,
    init: RequestInit = {},
  ): Promise<T> => {
    const res = await authFetch(url, {
      ...init,
      headers: init.body
        ? { "Content-Type": "application/json", ...(init.headers || {}) }
        : init.headers,
      credentials: init.credentials ?? "include",
    });
    if (!res.ok) {
      throw new Error(await res.text());
    }
    return (await res.json()) as T;
  };

  const windowsApi = config.windows ?? {
    open: () => {},
    spawn: () => "",
    getState: () => undefined,
    list: () => [],
  };


  const noop = () => {};
  const toastApi = config.toast ?? {
    success: noop as (msg: string) => void,
    error: noop as (msg: string) => void,
    info: noop as (msg: string) => void,
  };

  const registry = usePluginRegistry;

  const api: EmbeddrAPI = {
    stores: {
      global: {
        selectedImage: null,
        selectImage: () => {},
      },
    },
    ui: {
      activePanelId: null,
      isPanelActive: () => false,
    },
    workspaces: {
      getState: () => ({}),
      subscribe: () => () => {},
      list: () => [],
      getActiveId: () => null,
      ensureDefault: () => {},
      create: () => "default",
      save: () => {},
      saveActive: () => {},
      apply: () => {},
      rename: () => {},
      clone: () => null,
      remove: () => {},
      setTemplate: () => {},
    },
    settings: {
      get: <T>(key: string, defaultValue?: T): T =>
        readSetting(key, defaultValue),
      set: (key: string, value: any) => writeSetting(key, value),
      getPlugin: <T>(pluginId: string, key: string, defaultValue?: T): T =>
        readSetting(
          `${settingsPrefix}:plugin:${pluginId}:${key}`,
          defaultValue,
        ),
      setPlugin: (pluginId: string, key: string, value: any) =>
        writeSetting(`${settingsPrefix}:plugin:${pluginId}:${key}`, value),
    },
    toast: toastApi,
    security: {
      overview: async () => {
        if (!securityBase) return null;
        const res = await authFetch(`${securityBase}/security/overview`);
        if (!res.ok) throw new Error(await res.text());
        return res.json();
      },
      operatorProfile: async () => {
        if (!securityBase) return null;
        const res = await authFetch(`${securityBase}/security/operator`);
        if (!res.ok) throw new Error(await res.text());
        return res.json();
      },
      login: async (payload: { username: string; password: string }) => {
        if (!securityBase) throw new Error("No security base URL");
        const res = await fetch(`${securityBase}/security/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          credentials: "include",
        });
        if (!res.ok) {
          const body = await res
            .json()
            .catch(() => ({ detail: res.statusText }));
          return { ok: false, detail: body.detail || res.statusText };
        }
        return res.json();
      },
      logout: async () => {
        if (!securityBase) return { ok: false, message: "No security base" };
        const res = await authFetch(`${securityBase}/security/logout`, {
          method: "POST",
          credentials: "include",
        });
        if (!res.ok) throw new Error(await res.text());
        return res.json();
      },
    },
    utils: {
      backendUrl: assetBase,
      getApiKey: () => apiKey || null,
      uploadImage: notImplemented,
      getPluginUrl: (path: string) => {
        const clean = path.replace(/^\//, "");
        return signProtectedUrl(
          assetBase ? `${assetBase}/${clean}` : `/${clean}`,
        );
      },
    },
    artifacts: {
      list: (input) => {
        const search = new URLSearchParams();
        if (input?.limit !== undefined)
          search.set("limit", String(input.limit));
        if (input?.offset !== undefined)
          search.set("offset", String(input.offset));
        if (input?.q) search.set("q", input.q);
        if (input?.access_scope) search.set("access_scope", input.access_scope);
        if (input?.type_name) search.set("type_name", input.type_name);
        if (input?.media_type) search.set("media_type", input.media_type);
        if (input?.visibility && input.visibility !== "all") {
          search.set("visibility", input.visibility);
        }
        if (input?.sort) search.set("sort", input.sort);
        if (input?.ids?.length) {
          input.ids.forEach((id) => search.append("ids", id));
        }
        const qs = search.toString();
        return requestJson<{ items: Array<any>; count?: number }>(
          `${apiBase}/artifacts/${qs ? `?${qs}` : ""}`,
        );
      },
      get: (id, input) => {
        const search = new URLSearchParams();
        if (input?.include_owner_profiles) {
          search.set("include_owner_profiles", "true");
        }
        const qs = search.toString();
        return requestJson<any>(
          `${apiBase}/artifacts/${encodeURIComponent(id)}${qs ? `?${qs}` : ""}`,
        );
      },
      queryGraph: (input) =>
        requestJson(`${apiBase}/artifacts/graph/query`, {
          method: "POST",
          body: JSON.stringify(input),
        }),
      getGraphTaxonomy: () =>
        requestJson(`${apiBase}/artifacts/graph/taxonomy`),
      resolve: async (input) =>
        signResolvedValue(
          await requestJson<any>(
            `${apiBase}/artifacts/${encodeURIComponent(input.id)}/resolve${
              input.variant
                ? `?variant=${encodeURIComponent(input.variant)}`
                : ""
            }`,
          ),
          signProtectedUrl,
        ),
      create: (input) =>
        requestJson(`${apiBase}/lotus/embeddr-core.artifact.create`, {
          method: "POST",
          body: JSON.stringify(input),
        }),
      update: async (id, input) => {
        const res = await authFetch(
          `${apiBase}/artifacts/${encodeURIComponent(id)}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(input),
          },
        );
        if (!res.ok)
          throw new Error((await res.text()) || "Failed to update artifact");
        return res.json();
      },
      delete: async (id) => {
        const res = await authFetch(
          `${apiBase}/artifacts/${encodeURIComponent(id)}`,
          {
            method: "DELETE",
          },
        );
        if (!res.ok)
          throw new Error((await res.text()) || "Failed to delete artifact");
        return res.json();
      },
      uploadInit: (input) =>
        requestJson(`${apiBase}/lotus/embeddr-core.artifact.upload.init`, {
          method: "POST",
          body: JSON.stringify(input),
        }),
      uploadComplete: (input) =>
        requestJson(`${apiBase}/lotus/embeddr-core.artifact.upload.complete`, {
          method: "POST",
          body: JSON.stringify(input),
        }),
      uploadFile: async (input) => {
        const init = await requestJson<any>(
          `${apiBase}/lotus/embeddr-core.artifact.upload.init`,
          {
            method: "POST",
            body: JSON.stringify({
              artifact_id: input.artifact_id,
              filename: input.file.name,
              content_type: input.file.type,
              size: input.file.size,
              confirm: true,
            }),
          },
        );

        const uploadPath = String(init?.upload_path || "").trim();
        if (!uploadPath) {
          throw new Error("Upload init did not return an upload path");
        }

        const formData = new FormData();
        formData.append("file", input.file);

        const uploadUrl = ABSOLUTE_URL_RE.test(uploadPath)
          ? uploadPath
          : joinUrl(assetBase, uploadPath);

        const uploadRes = await authFetch(uploadUrl, {
          method: "POST",
          body: formData,
        });
        if (!uploadRes.ok) {
          throw new Error((await uploadRes.text()) || "Upload failed");
        }

        const uploaded = await uploadRes.json();
        const complete = await requestJson<any>(
          `${apiBase}/lotus/embeddr-core.artifact.upload.complete`,
          {
            method: "POST",
            body: JSON.stringify({
              upload_id: init.upload_id,
              confirm: true,
            }),
          },
        );

        return { init, uploaded, complete };
      },
      getContentUrl: (id: string) =>
        signProtectedUrl(client.getArtifactContentUrl(id)),
    },
    resources: {
      resolve: async (input) => {
        if (
          input.artifactPayload?.content_url &&
          input.artifactPayload?.preview_url
        ) {
          return signResolvedValue(
            {
              ...input.artifactPayload,
              id: input.artifactPayload.id ?? input.artifactId,
              type: input.artifactPayload.type ?? input.hintType,
              content_url: input.artifactPayload.content_url,
              preview_url: input.artifactPayload.preview_url,
              url: input.artifactPayload.url ?? input.url,
            },
            signProtectedUrl,
          );
        }

        if (input.artifactId && !input.url) {
          return {
            id: input.artifactId,
            type: input.hintType || "image",
            content_url: signProtectedUrl(
              client.getArtifactContentUrl(input.artifactId),
            ),
            preview_url: signProtectedUrl(
              `${apiBase}/artifacts/${encodeURIComponent(input.artifactId)}/preview`,
            ),
          };
        }

        const resolved = await requestJson<any>(
          `${apiBase}/resources/resolve`,
          {
            method: "POST",
            body: JSON.stringify({
              artifact_id: input.artifactId,
              url: input.url,
              hint_type: input.hintType,
              adapter_id: input.adapterId,
            }),
          },
        );

        if (resolved) {
          return signResolvedValue(resolved, signProtectedUrl);
        }

        if (input.url) {
          return {
            id: input.artifactId,
            type: input.hintType || "image",
            content_url: input.url,
            preview_url: input.url,
            url: input.url,
          };
        }

        return {
          id: input.artifactId,
          type: input.hintType || "image",
        };
      },
    },
    client: {
      plugins: {
        call: async <T>(
          pluginId: string,
          path: string,
          method = "GET",
          body?: any,
        ): Promise<T> => {
          const cleanPath = path.startsWith("/") ? path.slice(1) : path;
          const url = `${pluginApiBase}/plugins/${pluginId}/${cleanPath}`;
          const res = await authFetch(url, {
            method,
            headers: body ? { "Content-Type": "application/json" } : undefined,
            body: body ? JSON.stringify(body) : undefined,
            credentials: "include",
          });
          if (!res.ok) throw new Error(await res.text());
          return (await res.json()) as T;
        },
      },
    },
    plugin: {
      fetch: async () => new Response("Not implemented", { status: 501 }),
      request: notImplemented,
    },
    plugins: {
      list: async () => Object.values(registry.getState().plugins || {}),
      listLogos: async () => {
        if (!apiBase) return {};
        const res = await authFetch(`${apiBase}/plugins/logos`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        const logos = (data?.logos || {}) as Record<string, string | null>;
        const origin = assetBase.replace(/\/api(?:\/(v1|v2))?\/?$/, "");
        const signIfProtected = (value: string | null) =>
          value ? signProtectedUrl(value) : value;
        const normalize = (value: string | null, pluginName?: string) => {
          if (!value) return null;
          if (value.startsWith("http://") || value.startsWith("https://"))
            return signIfProtected(value);
          if (value.startsWith("//"))
            return signIfProtected(`${window.location.protocol}${value}`);
          if (value.startsWith("/api/"))
            return signIfProtected(`${origin}${value}`);
          if (value.startsWith("/plugins/"))
            return signIfProtected(`${origin}${value}`);
          if (pluginName && value.startsWith(`/${pluginName}/static/`))
            return signIfProtected(`${origin}/plugins${value}`);
          if (value.startsWith("/"))
            return signIfProtected(`${origin}${value}`);
          return signIfProtected(`${origin}/${value}`);
        };
        return Object.fromEntries(
          Object.entries(logos).map(([key, value]) => [
            key,
            normalize(value, key),
          ]),
        );
      },
      getActions: (location: string) => getPluginActionsByLocation(location),
      getComponents: (location: string) =>
        getPluginComponentsByLocation(location),
      getApi: (requestedPluginId?: string): EmbeddrAPI =>
        requestedPluginId
          ? createPluginScopedAPI(api, requestedPluginId, {
              backendUrl,
              apiKey,
            })
          : api,
    },
    events: {
      on: (event, listener) => globalEventBus.on(event as string, listener),
      off: (event, listener) => globalEventBus.off(event as string, listener),
      emit: (event, payload) => globalEventBus.emit(event as string, payload),
    },
    executions: {
      create: (input: {
        plugin_name: string;
        job_type?: string;
        inputs?: Record<string, unknown>;
        action_id?: string;
        parameters?: Record<string, unknown>;
        primary_artifact_id?: string;
      }) => {
        const payload = {
          plugin_name: input.plugin_name,
          job_type: input.job_type || input.action_id,
          inputs: input.inputs || input.parameters || {},
          ...(input.primary_artifact_id
            ? { primary_artifact_id: input.primary_artifact_id }
            : {}),
        };
        return requestJson(`${apiBase}/executions`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
      },
      get: (executionId: string) =>
        requestJson(`${apiBase}/executions/${encodeURIComponent(executionId)}`),
      list: (params?: {
        plugin_name?: string;
        status?: string;
        type?: string;
        created_after?: string;
        created_before?: string;
        q?: string;
        limit?: number;
        offset?: number;
      }) => {
        const search = new URLSearchParams();
        if (params?.plugin_name) search.set("plugin_name", params.plugin_name);
        if (params?.status) search.set("status", params.status);
        if (params?.type) search.set("type", params.type);
        if (params?.created_after)
          search.set("created_after", params.created_after);
        if (params?.created_before)
          search.set("created_before", params.created_before);
        if (params?.q) search.set("q", params.q);
        if (params?.limit !== undefined)
          search.set("limit", String(params.limit));
        if (params?.offset !== undefined)
          search.set("offset", String(params.offset));
        const qs = search.toString();
        return requestJson<any[]>(`${apiBase}/executions${qs ? `?${qs}` : ""}`);
      },
      cancel: (executionId: string) =>
        requestJson(
          `${apiBase}/executions/${encodeURIComponent(executionId)}/cancel`,
          {
            method: "POST",
          },
        ),
      nudge: (
        executionId: string,
        input:
          | string
          | {
              message: string;
              mode?: "steer" | "goal_replace";
              goal?: string;
            },
      ) => {
        const payload = typeof input === "string" ? { message: input } : input;
        return requestJson(
          `${apiBase}/executions/${encodeURIComponent(executionId)}/nudge`,
          {
            method: "POST",
            body: JSON.stringify(payload),
          },
        );
      },
    },
    lotus: {
      invoke: (capId, input) => client.invokeLotus(capId, input),
      query: (q: string, limit?: number) => {
        const search = new URLSearchParams();
        search.set("q", q);
        if (limit !== undefined) search.set("limit", String(limit));
        return requestJson(`${apiBase}/lotus/query?${search.toString()}`);
      },
      list: (input) => client.listLotusCapabilities(input),
    },
    windows: {
      open: (id, title, componentId, props) =>
        windowsApi.open(id, title, componentId, props),
      spawn: (componentId, title, props) =>
        windowsApi.spawn(componentId, title, props),
      register: () => {},
      getState: windowsApi.getState,
      list: windowsApi.list ?? (() => []),
    },
  };

  (api as any).utils.allowMediaQueryAuthFallback = true;
  (api as any).utils.withApiKey = signProtectedUrl;

  return api;
}

/**
 * Create a plugin-scoped variant of an EmbeddrAPI.
 * Overrides `plugin.fetch`, `plugin.request`, and `utils.getPluginUrl`
 * to scope requests to the given plugin's backend routes.
 */
export function createPluginScopedAPI(
  baseApi: EmbeddrAPI,
  pluginId: string,
  config: { backendUrl: string; apiKey?: string },
): EmbeddrAPI {
  const apiBase = resolveApiBase(config.backendUrl, "/api");
  const assetBase = resolveAssetBase(config.backendUrl);
  const pluginBase = `${apiBase}/plugins/${pluginId}`;
  const authFetch = createFetchWithAuth({
    getToken: () => config.apiKey || null,
  });

  const signProtectedUrl = (url: string) => {
    if (!url || !config.apiKey) return url;
    try {
      const baseUrl =
        assetBase ||
        config.backendUrl ||
        (typeof window !== "undefined"
          ? window.location.origin
          : "http://localhost");
      const parsed = new URL(url, baseUrl);
      const assetOrigin = new URL(baseUrl).origin;
      const windowOrigin =
        typeof window !== "undefined" ? window.location.origin : assetOrigin;
      const isInternal =
        parsed.origin === assetOrigin || parsed.origin === windowOrigin;
      const isProtectedPath =
        parsed.pathname.startsWith("/api/") ||
        parsed.pathname.startsWith("/plugins/");
      if (!isInternal || !isProtectedPath) return parsed.toString();
      parsed.searchParams.set("api_key", config.apiKey);
      return parsed.toString();
    } catch {
      return url;
    }
  };

  const request = async <T>(path: string, init?: RequestInit) => {
    const res = await authFetch(
      resolvePluginRequestUrl(pluginBase, assetBase, path),
      {
        ...init,
        headers: shouldAddJsonContentType(init)
          ? { "Content-Type": "application/json", ...(init?.headers || {}) }
          : init?.headers,
        credentials: init?.credentials ?? "include",
      },
    );
    if (!res.ok) throw new Error(await res.text());
    return (await res.json()) as T;
  };

  return {
    ...baseApi,
    utils: {
      ...baseApi.utils,
      getPluginUrl: (path: string) => {
        const clean = path.replace(/^\//, "");
        return signProtectedUrl(
          assetBase
            ? `${assetBase}/plugins/${pluginId}/${clean}`
            : `/plugins/${pluginId}/${clean}`,
        );
      },
    },
    plugin: {
      fetch: (path, init) =>
        authFetch(resolvePluginRequestUrl(pluginBase, assetBase, path), {
          ...init,
          headers: shouldAddJsonContentType(init)
            ? { "Content-Type": "application/json", ...(init?.headers || {}) }
            : init?.headers,
          credentials: init?.credentials ?? "include",
        }),
      request,
    },
  };
}

// Internal helper
function resolveSecurityBase(baseUrl: string): string {
  const clean = baseUrl.replace(/\/+$/, "");
  if (!clean) return "";
  if (clean.endsWith("/api")) return clean;
  if (/\/api\/v\d+$/.test(clean)) return clean.replace(/\/api\/v\d+$/, "/api");
  return `${clean}/api`;
}
