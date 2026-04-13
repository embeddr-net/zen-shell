import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useZenFetch } from "./use-zen-fetch";

export interface TypeTreeEntry {
  baseType: string;
  count: number;
  subtypes: Array<{ typeName: string; count: number }>;
}

interface TypeSummaryItem {
  name: string;
  parent_name?: string | null;
  artifact_count: number;
}

export function useArtifactTypeCounts() {
  const { zenFetch } = useZenFetch();

  const { data, isLoading } = useQuery({
    queryKey: ["types", "summary"],
    queryFn: () =>
      zenFetch<{ types: TypeSummaryItem[]; total_artifacts: number }>(
        "/types/summary",
      ),
    staleTime: 60_000,
  });

  const types = data?.types ?? [];
  const totalArtifacts = data?.total_artifacts ?? 0;

  const typeTree = useMemo<TypeTreeEntry[]>(() => {
    const baseTypes = new Map<
      string,
      { count: number; subtypes: Array<{ typeName: string; count: number }> }
    >();

    for (const t of types) {
      if (!t.parent_name || t.parent_name === "artifact") {
        if (t.name === "artifact") continue;
        baseTypes.set(t.name, { count: t.artifact_count, subtypes: [] });
      }
    }

    for (const t of types) {
      if (!t.parent_name || t.parent_name === "artifact" || t.name === "artifact") continue;
      const parent = t.parent_name;
      if (baseTypes.has(parent)) {
        const entry = baseTypes.get(parent)!;
        entry.subtypes.push({ typeName: t.name, count: t.artifact_count });
        entry.count += t.artifact_count;
      } else {
        const parentType = types.find((pt) => pt.name === parent);
        const grandParent = parentType?.parent_name;
        if (grandParent && baseTypes.has(grandParent)) {
          const entry = baseTypes.get(grandParent)!;
          entry.subtypes.push({ typeName: t.name, count: t.artifact_count });
          entry.count += t.artifact_count;
        } else {
          baseTypes.set(t.name, { count: t.artifact_count, subtypes: [] });
        }
      }
    }

    const entries: TypeTreeEntry[] = [];
    for (const [baseType, { count, subtypes }] of baseTypes) {
      if (count === 0 && subtypes.every((s) => s.count === 0)) continue;
      subtypes.sort((a, b) => b.count - a.count);
      entries.push({ baseType, count, subtypes });
    }
    entries.sort((a, b) => b.count - a.count);
    return entries;
  }, [types]);

  return { types, totalArtifacts, typeTree, isLoading };
}
