import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ZenPanelUiEntry = {
  showTitle: boolean;
  titlePosition: "top" | "bottom";
  isFolded: boolean;
};

export type ZenPanelUiState = {
  panels: Record<string, ZenPanelUiEntry>;
  ensurePanelUi: (id: string, defaults?: Partial<ZenPanelUiEntry>) => ZenPanelUiEntry;
  setPanelUi: (id: string, updates: Partial<ZenPanelUiEntry>) => void;
  clearPanelUi: (id: string) => void;
};

const DEFAULT_PANEL_UI: ZenPanelUiEntry = {
  showTitle: true,
  titlePosition: "top",
  isFolded: false,
};

function readLegacyValue<T>(key: string): T | undefined {
  if (typeof window === "undefined") return undefined;

  try {
    const raw = window.localStorage.getItem(key);
    if (raw == null) return undefined;
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

function resolvePanelUiEntry(
  id: string,
  current?: Partial<ZenPanelUiEntry>,
  defaults?: Partial<ZenPanelUiEntry>,
): ZenPanelUiEntry {
  const base = { ...DEFAULT_PANEL_UI, ...defaults };
  const rawLegacyTitlePosition = readLegacyValue<"top" | "bottom">(`panel-${id}-title-position`);
  const legacyTitlePosition =
    rawLegacyTitlePosition === "bottom" || rawLegacyTitlePosition === "top"
      ? rawLegacyTitlePosition
      : undefined;

  return {
    showTitle:
      current?.showTitle ?? readLegacyValue<boolean>(`panel-${id}-show-title`) ?? base.showTitle,
    titlePosition: current?.titlePosition ?? legacyTitlePosition ?? base.titlePosition,
    isFolded: current?.isFolded ?? readLegacyValue<boolean>(`panel-${id}-folded`) ?? base.isFolded,
  };
}

function entriesEqual(a: ZenPanelUiEntry, b: ZenPanelUiEntry) {
  return (
    a.showTitle === b.showTitle && a.titlePosition === b.titlePosition && a.isFolded === b.isFolded
  );
}

export const useZenPanelUiStore = create<ZenPanelUiState>()(
  persist(
    (set, get) => ({
      panels: {},

      ensurePanelUi: (id, defaults) => {
        const current = get().panels[id];
        const resolved = resolvePanelUiEntry(id, current, defaults);

        if (!current || !entriesEqual(current, resolved)) {
          set((state) => ({
            panels: {
              ...state.panels,
              [id]: resolved,
            },
          }));
        }

        return resolved;
      },

      setPanelUi: (id, updates) =>
        set((state) => {
          const current = resolvePanelUiEntry(id, state.panels[id]);
          const next = { ...current, ...updates };
          if (entriesEqual(current, next)) {
            return state;
          }
          return {
            panels: {
              ...state.panels,
              [id]: next,
            },
          };
        }),

      clearPanelUi: (id) =>
        set((state) => {
          if (!state.panels[id]) return state;
          const nextPanels = { ...state.panels };
          delete nextPanels[id];
          return { panels: nextPanels };
        }),
    }),
    {
      name: "embeddr-zen-panel-ui-store",
      version: 1,
      partialize: (state) => ({ panels: state.panels }),
    },
  ),
);
