/**
 * Default Finder search implementation.
 *
 * Provides shebang routing, Lotus query, and artifact search.
 * Apps can use this as-is or override with custom search logic.
 */
import type { ZenFinderItem, ZenFinderConfig, ZenFinderShebangConfig } from "./finder-types";

type LotusQueryResult = {
  id: string;
  kind: string;
  title: string;
  description?: string;
  subtitle?: string;
  score?: number;
  data?: Record<string, any>;
};

type LotusQueryResponse = {
  query?: string;
  results?: LotusQueryResult[];
};

interface SearchParams {
  text: string;
  shebang: string | null;
  shebangArgs: string;
  tags: Array<{ key: string; value?: string }>;
  raw: string;
}

function normalizeLotusScore(score?: number) {
  if (typeof score !== "number" || Number.isNaN(score)) return 0;
  return score <= 1 ? Math.round(score * 100) : score;
}

/**
 * Create a default search handler for ZenFinder.
 *
 * Uses the zen-shell client context for API calls.
 * Handles: shebangs → provider routing, plain text → lotus.query.
 */
export function createDefaultFinderSearch(
  backendUrl: string,
  config: Pick<ZenFinderConfig, "shebangs" | "textProvider">,
  apiKey?: string,
) {
  const base = backendUrl.replace(/\/+$/, "");

  const fetchApi = async <T>(path: string, body?: any): Promise<T> => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (apiKey) headers["X-API-Key"] = apiKey;

    const res = await fetch(`${base}${path}`, {
      method: body ? "POST" : "GET",
      headers,
      credentials: "include",
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(`${res.status}`);
    return res.json();
  };

  return async (params: SearchParams): Promise<ZenFinderItem[]> => {
    if (!params.text && !params.shebang) return [];

    // Shebang routing
    if (params.shebang) {
      const shebangKey = params.shebang.split(/[:.]/)[0];
      const rawConfig = config.shebangs?.[shebangKey];
      if (rawConfig) {
        const provider =
          typeof rawConfig === "string"
            ? rawConfig
            : (rawConfig as ZenFinderShebangConfig).provider;

        try {
          const out = await fetchApi<any>(`/lotus/${provider}`, {
            query: params.text || params.shebangArgs,
            limit: 20,
          });
          const items = Array.isArray(out?.items) ? out.items : [];
          return items.map((item: any, i: number) => ({
            id: `shebang:${shebangKey}:${item.id || i}`,
            kind: "resource" as const,
            source: "server" as const,
            title: item.title || item.name || item.id || `Result ${i + 1}`,
            subtitle: item.subtitle || provider,
            description: item.description,
            score: normalizeLotusScore(item.score),
            data: {
              preview_url: item.thumbnail || item.preview_url || item.thumb,
              resource: item,
            },
          }));
        } catch {
          return [];
        }
      }
    }

    // Artifact search via search.text
    const searchProvider = config.textProvider || "search.text";
    const searchQuery = params.text;

    if (searchQuery) {
      try {
        // Try semantic search first
        const searchResult = await fetchApi<{
          items: Array<{ id: string; score: number }>;
          count?: number;
        }>(`/lotus/${searchProvider}`, {
          query: searchQuery,
          limit: 20,
        });

        if (searchResult?.items?.length) {
          // Hydrate artifacts by fetching each one
          const artifacts = await Promise.all(
            searchResult.items.map(async (item) => {
              try {
                const artifact = await fetchApi<any>(
                  `/artifacts/${item.id}`,
                );
                return {
                  ...artifact,
                  _searchScore: item.score,
                };
              } catch {
                return null;
              }
            }),
          );

          return artifacts
            .filter(Boolean)
            .map((artifact: any) => {
              const previewUrl = artifact?.id
                ? `${base}/artifacts/${artifact.id}/preview?variant=thumbnail`
                : undefined;
              const title =
                artifact?.metadata_json?.title ||
                artifact?.metadata_json?.name ||
                artifact?.uri ||
                artifact?.id;

              return {
                id: artifact.id,
                kind: "artifact" as const,
                source: "server" as const,
                title: title || artifact.id,
                subtitle: artifact.type_name || artifact.base_type_name,
                description: artifact.metadata_json?.description || artifact.uri,
                score: normalizeLotusScore(artifact._searchScore),
                data: {
                  artifact_id: artifact.id,
                  preview_url: previewUrl,
                  type_name: artifact.type_name,
                  storage_backend: artifact.storage_backend,
                },
              };
            });
        }
      } catch {
        // Search failed, fall through to lotus query
      }
    }

    // Fallback: Lotus query for commands/nav
    try {
      const queryText = params.text || params.shebang || "";
      if (!queryText) return [];

      const response = await fetchApi<LotusQueryResponse>(
        `/lotus/query?q=${encodeURIComponent(queryText)}&limit=14`,
      );

      return (response.results || []).map((item) => ({
        id: `lotus:${item.id}`,
        kind: (item.kind === "action" ? "lotus-action" : "lotus-nav") as string,
        source: "server" as const,
        title: item.title,
        subtitle: item.subtitle,
        description: item.description,
        score: normalizeLotusScore(item.score),
        data: item.data || {},
      }));
    } catch {
      return [];
    }
  };
}
