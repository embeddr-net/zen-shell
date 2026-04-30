import { useQuery } from "@tanstack/react-query";
import { useZenClient } from "../../client/zen-client-context";
import { useZenFetch } from "./use-zen-fetch";

export function usePluginLogos() {
  const { backendUrl } = useZenClient();
  const { zenFetch } = useZenFetch();

  // Plugin assets are served at /plugins/*, NOT under /api/
  const origin = backendUrl.replace(/\/api(\/v\d+)?\/?$/, "");

  return useQuery({
    queryKey: ["plugins", "logos"],
    queryFn: async () => {
      const data = await zenFetch<{ logos: Record<string, string | null> }>("/plugins/logos");
      const logos = data?.logos || {};
      const normalized: Record<string, string | null> = {};
      for (const [key, value] of Object.entries(logos)) {
        if (!value) {
          normalized[key] = null;
          continue;
        }
        if (value.startsWith("http://") || value.startsWith("https://")) {
          normalized[key] = value;
        } else if (value.startsWith("/plugins/")) {
          normalized[key] = `${origin}${value}`;
        } else if (value.startsWith("/")) {
          normalized[key] = `${origin}${value}`;
        } else {
          normalized[key] = `${origin}/${value}`;
        }
      }
      return { logos: normalized };
    },
    staleTime: 120_000,
  });
}
