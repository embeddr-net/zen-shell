/**
 * Internal helper — authenticated fetch using ZenClient context.
 * Not exported directly; used by data hooks.
 */
import { useZenClient } from "../../client/zen-client-context";

export function useZenFetch() {
  const { backendUrl, apiKey } = useZenClient();

  const zenFetch = async <T>(path: string, options?: RequestInit): Promise<T> => {
    const url = `${backendUrl}${path}`;
    const headers = new Headers(options?.headers || {});
    if (apiKey) headers.set("X-API-Key", apiKey);

    const res = await fetch(url, {
      ...options,
      headers,
      credentials: options?.credentials ?? "include",
    });
    if (!res.ok) {
      throw new Error(`${res.status} ${res.statusText}`);
    }
    return res.json();
  };

  return { zenFetch, backendUrl, apiKey };
}
