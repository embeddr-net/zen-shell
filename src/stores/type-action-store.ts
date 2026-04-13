/**
 * Type Action Registry — maps artifact/resource types to default panel handlers.
 *
 * Like OS file associations: plugins seed defaults ("video → media-frame"),
 * operators can override ("video → my-custom-player"). The Finder dispatch
 * calls resolve(type) to determine what opens.
 *
 * Resolution: operator overrides (100) > plugin-registered (0) > defaults (-1)
 */
import { create } from "zustand";

export interface TypeActionEntry {
  /** Type pattern to match: "video", "image", "artifact", "stash:scene", "*" */
  typePattern: string;
  /** Panel entry key to open: "embeddr-core:media-frame" */
  handler: string;
  /** Higher wins. -1 = default, 0 = plugin, 100 = operator */
  priority: number;
  /** Who registered this entry */
  source: "default" | "plugin" | "operator";
}

export interface TypeActionState {
  entries: TypeActionEntry[];

  /** Resolve the best handler for a type. Returns entryKey or null. */
  resolve: (type: string) => string | null;

  /** Register a handler (plugins call this on load) */
  register: (entry: TypeActionEntry) => void;

  /** Bulk-register multiple entries */
  registerMany: (entries: TypeActionEntry[]) => void;

  /** Set operator overrides (replaces all operator entries) */
  setOperatorOverrides: (entries: TypeActionEntry[]) => void;

  /** Get all entries for display/editing */
  getAll: () => TypeActionEntry[];
}

/** Sane defaults — what opens by default when no plugin or operator configures otherwise */
const DEFAULT_ENTRIES: TypeActionEntry[] = [
  { typePattern: "video", handler: "embeddr-core:media-frame", priority: -1, source: "default" },
  { typePattern: "image", handler: "embeddr-core:media-frame", priority: -1, source: "default" },
  { typePattern: "audio", handler: "embeddr-core:media-frame", priority: -1, source: "default" },
  { typePattern: "scenes", handler: "embeddr-core:media-frame", priority: -1, source: "default" },
  { typePattern: "artifact", handler: "embeddr-core:artifact-detail", priority: -1, source: "default" },
  { typePattern: "resource", handler: "embeddr-core:media-frame", priority: -1, source: "default" },
  { typePattern: "document", handler: "embeddr-core:artifact-detail", priority: -1, source: "default" },
];

function resolveType(entries: TypeActionEntry[], type: string): string | null {
  if (!type) return null;
  const normalized = type.toLowerCase();

  // Collect all matching entries
  const matches: TypeActionEntry[] = [];

  for (const entry of entries) {
    const pattern = entry.typePattern.toLowerCase();
    if (pattern === normalized) {
      matches.push(entry);
    } else if (pattern === "*") {
      matches.push(entry);
    } else if (normalized.startsWith(pattern + ":")) {
      // "image" matches "image:comfyui"
      matches.push(entry);
    }
  }

  if (matches.length === 0) return null;

  // Sort by priority descending, pick highest
  matches.sort((a, b) => b.priority - a.priority);
  return matches[0].handler;
}

export const useTypeActionStore = create<TypeActionState>()((set, get) => ({
  entries: [...DEFAULT_ENTRIES],

  resolve: (type: string) => resolveType(get().entries, type),

  register: (entry: TypeActionEntry) => {
    set((state) => {
      // Don't duplicate — replace if same pattern + source
      const filtered = state.entries.filter(
        (e) =>
          !(e.typePattern === entry.typePattern && e.source === entry.source),
      );
      return { entries: [...filtered, entry] };
    });
  },

  registerMany: (newEntries: TypeActionEntry[]) => {
    set((state) => {
      let entries = [...state.entries];
      for (const entry of newEntries) {
        entries = entries.filter(
          (e) =>
            !(
              e.typePattern === entry.typePattern && e.source === entry.source
            ),
        );
        entries.push(entry);
      }
      return { entries };
    });
  },

  setOperatorOverrides: (overrides: TypeActionEntry[]) => {
    set((state) => {
      // Remove all existing operator entries, add new ones
      const nonOperator = state.entries.filter((e) => e.source !== "operator");
      return {
        entries: [
          ...nonOperator,
          ...overrides.map((o) => ({ ...o, source: "operator" as const, priority: 100 })),
        ],
      };
    });
  },

  getAll: () => get().entries,
}));
