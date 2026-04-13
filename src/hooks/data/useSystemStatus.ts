import { useQuery } from "@tanstack/react-query";
import { useZenFetch } from "./use-zen-fetch";

export interface SystemHealth {
  status: string;
  petals_connected?: number;
  degraded_plugins?: string[] | null;
}

export function useSystemHealth() {
  const { zenFetch } = useZenFetch();

  return useQuery({
    queryKey: ["system", "health"],
    queryFn: () => zenFetch<SystemHealth>("/health"),
    staleTime: 10_000,
    retry: 1,
  });
}
