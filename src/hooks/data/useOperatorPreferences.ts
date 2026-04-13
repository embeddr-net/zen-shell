/**
 * useOperatorPreferences — read/write operator-scoped preferences via the server.
 *
 * Uses the existing plugin_state API: GET/PUT /api/v1/state/embeddr-core/{key}
 * Operator ID is resolved from the auth context server-side.
 *
 * Works in any app with ZenClientProvider. Falls back to defaultValue
 * when the server is unreachable or no preference is stored.
 */
import { useCallback } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useZenFetch } from "./use-zen-fetch";

const PLUGIN_NAME = "embeddr-core";

export function useOperatorPreferences<T>(key: string, defaultValue: T) {
  const { zenFetch } = useZenFetch();
  const queryClient = useQueryClient();
  const queryKey = ["operator-preferences", key];

  const { data, isLoading, error } = useQuery({
    queryKey,
    queryFn: async (): Promise<T> => {
      try {
        const result = await zenFetch<{ value_json: string }>(
          `/state/${PLUGIN_NAME}/${encodeURIComponent(key)}`,
        );
        // The state API returns { plugin_name, key, operator_id, value_json, updated_at }
        // value_json is a JSON string
        const raw = result?.value_json;
        if (!raw || raw === "{}") return defaultValue;
        const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
        return parsed as T;
      } catch {
        return defaultValue;
      }
    },
    staleTime: 30_000,
    retry: 1,
  });

  const mutation = useMutation({
    mutationFn: async (value: T) => {
      await zenFetch(`/state/${PLUGIN_NAME}/${encodeURIComponent(key)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: value }),
      });
    },
    onSuccess: (_data, value) => {
      queryClient.setQueryData(queryKey, value);
    },
  });

  const save = useCallback(
    (value: T) => mutation.mutateAsync(value),
    [mutation],
  );

  return {
    data: data ?? defaultValue,
    isLoading,
    error,
    save,
    isSaving: mutation.isPending,
  };
}
