import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface WindowState {
  id: string;
  title: string;
  componentId: string;
  props?: any;
  isMinimized: boolean;
  isPinned: boolean;
  tabs?: string[];
  activeTabId?: string;
  groupHostId?: string;
  positionMode?: "absolute" | "anchored";
  position?: { x: number; y: number };
  size?: { width: number; height: number };
  openRevision?: number;
  zIndex: number;
}

export interface PanelConstraintInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface PanelConstraints {
  enabled: boolean;
  safeArea: PanelConstraintInsets;
  snapThreshold: number;
}

export interface WindowStore {
  windows: Record<string, WindowState>;
  panelOrder: string[];
  backdropWindowId: string | null;
  mergeHoverTargetId: string | null;
  panelGroupingEnabled: boolean;
  panelConstraints: PanelConstraints;

  openWindow: (wm: {
    id: string;
    title: string;
    componentId: string;
    props?: any;
  }) => void;
  spawnWindow: (componentId: string, title: string, props?: any) => string;
  closeWindow: (id: string) => void;
  minimizeWindow: (id: string) => void;
  restoreWindow: (id: string) => void;
  bringToFront: (id: string) => void;
  togglePin: (id: string) => void;
  updateWindow: (id: string, updates: Partial<WindowState>) => void;
  setBackdrop: (id: string | null) => void;
  closeAll: () => void;
  mergeWindows: (sourceId: string, targetId: string) => void;
  detachTab: (tabId: string) => void;
  moveTab: (hostId: string, tabId: string, targetIndex: number) => void;
  setActiveTab: (hostId: string, tabId: string) => void;
  setMergeHoverTarget: (id: string | null) => void;
  setPanelGroupingEnabled: (enabled: boolean) => void;
  setPanelConstraints: (updates: Partial<PanelConstraints>) => void;
  togglePanelConstraints: (enabled?: boolean) => void;
}

const DEFAULT_PANEL_CONSTRAINTS: PanelConstraints = {
  enabled: false,
  safeArea: {
    top: 8,
    right: 8,
    bottom: 8,
    left: 8,
  },
  snapThreshold: 24,
};

export const useZenWindowStore = create<WindowStore>()(
  persist(
    (set, get) => ({
      windows: {},
      panelOrder: [],
      backdropWindowId: null,
      mergeHoverTargetId: null,
      panelGroupingEnabled: false,
      panelConstraints: DEFAULT_PANEL_CONSTRAINTS,

      setBackdrop: (id) => set({ backdropWindowId: id }),

      openWindow: ({ id, title, componentId, props }) =>
        set((state) => {
          const safeTitle = title?.trim() || "Untitled Panel";
          const defaultPosition = props?.defaultPosition as
            | { x: number; y: number }
            | undefined;
          const defaultSize = props?.defaultSize as
            | { width: number; height: number }
            | undefined;
          if (state.windows[id]) {
            const newOrder = state.panelOrder.filter((p) => p !== id);
            newOrder.push(id);
            return {
              windows: {
                ...state.windows,
                [id]: {
                  ...state.windows[id],
                  isMinimized: false,
                  title: safeTitle,
                  props: { ...state.windows[id].props, ...props },
                  position: state.windows[id].position ?? defaultPosition,
                  size: state.windows[id].size ?? defaultSize,
                  openRevision: (state.windows[id].openRevision ?? 0) + 1,
                },
              },
              panelOrder: newOrder,
            };
          }

          const newOrder = [...state.panelOrder, id];
          return {
            windows: {
              ...state.windows,
              [id]: {
                id,
                title: safeTitle,
                componentId,
                props,
                isMinimized: false,
                isPinned: false,
                zIndex: newOrder.length,
                position: defaultPosition,
                size: defaultSize,
                openRevision: 1,
              },
            },
            panelOrder: newOrder,
          };
        }),

      spawnWindow: (componentId, title, props) => {
        const id = `${componentId}-${Math.random().toString(36).substring(2, 9)}`;
        const existingCount = Object.keys(get().windows).length;
        const offset = (existingCount % 10) * 25;
        const finalProps = {
          ...props,
          defaultPosition: props?.defaultPosition
            ? {
                x: props.defaultPosition.x + offset,
                y: props.defaultPosition.y + offset,
              }
            : { x: 50 + offset, y: 50 + offset },
        };
        get().openWindow({
          id,
          title: title?.trim() || "Untitled Panel",
          componentId,
          props: finalProps,
        });
        return id;
      },

      closeWindow: (id) =>
        set((state) => {
          const current = state.windows[id];
          if (!current) return {};

          const nextWindows = { ...state.windows };

          // Case 1: Window is a member of a tab group (has groupHostId)
          if (current.groupHostId) {
            const host = nextWindows[current.groupHostId];
            if (host?.tabs) {
              const remainingTabs = host.tabs.filter((t) => t !== id);
              if (remainingTabs.length <= 1) {
                // Dissolve the group
                const lastId = remainingTabs[0];
                if (lastId && nextWindows[lastId]) {
                  nextWindows[lastId] = {
                    ...nextWindows[lastId],
                    groupHostId: undefined,
                    isMinimized: false,
                    tabs: undefined,
                    activeTabId: undefined,
                  };
                }
                nextWindows[current.groupHostId] = {
                  ...host,
                  tabs: undefined,
                  activeTabId: undefined,
                };
              } else {
                nextWindows[current.groupHostId] = {
                  ...host,
                  tabs: remainingTabs,
                  activeTabId:
                    host.activeTabId === id
                      ? remainingTabs[0]
                      : host.activeTabId,
                };
              }
            }
            delete nextWindows[id];
            return {
              windows: nextWindows,
              panelOrder: state.panelOrder.filter((p) => p !== id),
            };
          }

          // Case 2: Window IS a tab group host (has tabs array)
          if (current.tabs && current.tabs.length > 0) {
            const remainingTabs = current.tabs.filter((t) => t !== id);
            if (remainingTabs.length > 0) {
              // Promote first remaining tab as new host
              const newHostId = remainingTabs[0];
              const newHost = nextWindows[newHostId];
              if (newHost) {
                nextWindows[newHostId] = {
                  ...newHost,
                  tabs: remainingTabs.length > 1 ? remainingTabs : undefined,
                  activeTabId:
                    remainingTabs.length > 1
                      ? current.activeTabId !== id
                        ? current.activeTabId
                        : newHostId
                      : undefined,
                  groupHostId: undefined,
                  isMinimized: false,
                  position: current.position,
                  size: current.size,
                };
                for (const tabId of remainingTabs) {
                  if (tabId === newHostId) continue;
                  const tab = nextWindows[tabId];
                  if (tab) {
                    nextWindows[tabId] = {
                      ...tab,
                      groupHostId: newHostId,
                    };
                  }
                }
              }
            }
            delete nextWindows[id];
            const newOrder = state.panelOrder.filter((p) => p !== id);
            if (
              remainingTabs.length > 0 &&
              !newOrder.includes(remainingTabs[0])
            ) {
              newOrder.push(remainingTabs[0]);
            }
            return { windows: nextWindows, panelOrder: newOrder };
          }

          // Case 3: Standalone window — just remove it
          delete nextWindows[id];
          return {
            windows: nextWindows,
            panelOrder: state.panelOrder.filter((p) => p !== id),
          };
        }),

      minimizeWindow: (id) =>
        set((state) => ({
          windows: {
            ...state.windows,
            [id]: { ...state.windows[id], isMinimized: true },
          },
        })),

      restoreWindow: (id) =>
        set((state) => {
          const newOrder = state.panelOrder.filter((p) => p !== id);
          newOrder.push(id);
          return {
            windows: {
              ...state.windows,
              [id]: { ...state.windows[id], isMinimized: false },
            },
            panelOrder: newOrder,
          };
        }),

      bringToFront: (id) =>
        set((state) => {
          if (state.panelOrder[state.panelOrder.length - 1] === id) return {};
          const newOrder = state.panelOrder.filter((p) => p !== id);
          newOrder.push(id);
          return { panelOrder: newOrder };
        }),

      togglePin: (id) =>
        set((state) => {
          const window = state.windows[id] || {
            id,
            title: id,
            componentId: "unknown",
            isPinned: false,
            isMinimized: false,
            zIndex: 20,
          };
          return {
            windows: {
              ...state.windows,
              [id]: {
                ...window,
                isPinned: !window.isPinned,
              },
            },
          };
        }),

      updateWindow: (id, updates) =>
        set((state) => {
          const win = state.windows[id];
          if (!win) return {};
          if (updates.position || updates.size) {
          }
          const normalizedUpdates = {
            ...updates,
            title:
              updates.title !== undefined
                ? updates.title?.trim() || "Untitled Panel"
                : win.title,
          };
          const hasChanges = Object.entries(updates).some(([key, value]) => {
            const uKey = key as keyof WindowState;
            return JSON.stringify(win[uKey]) !== JSON.stringify(value);
          });
          if (!hasChanges) return {};
          return {
            windows: {
              ...state.windows,
              [id]: { ...win, ...normalizedUpdates },
            },
          };
        }),

      closeAll: () => set({ windows: {}, panelOrder: [] }),

      setMergeHoverTarget: (id) => set({ mergeHoverTargetId: id }),

      setPanelGroupingEnabled: (enabled) =>
        set((state) => {
          if (state.panelGroupingEnabled === enabled) return {};

          if (enabled) {
            return { panelGroupingEnabled: true };
          }

          const groupedWindowIds = new Set<string>();
          for (const win of Object.values(state.windows)) {
            if (win.groupHostId) {
              groupedWindowIds.add(win.id);
            }
            if (win.tabs && win.tabs.length > 1) {
              groupedWindowIds.add(win.id);
              for (const tabId of win.tabs) {
                groupedWindowIds.add(tabId);
              }
            }
          }

          if (groupedWindowIds.size === 0) {
            return {
              panelGroupingEnabled: false,
              mergeHoverTargetId: null,
            };
          }

          const nextWindows = { ...state.windows };
          for (const id of groupedWindowIds) {
            const win = nextWindows[id];
            if (!win) continue;
            const wasGroupedMember = Boolean(win.groupHostId);
            nextWindows[id] = {
              ...win,
              groupHostId: undefined,
              tabs: undefined,
              activeTabId: undefined,
              isMinimized: wasGroupedMember ? false : win.isMinimized,
            };
          }

          const nextOrder = [...state.panelOrder];
          for (const id of groupedWindowIds) {
            if (!nextOrder.includes(id)) {
              nextOrder.push(id);
            }
          }

          return {
            panelGroupingEnabled: false,
            mergeHoverTargetId: null,
            windows: nextWindows,
            panelOrder: nextOrder,
          };
        }),

      setPanelConstraints: (updates) =>
        set((state) => {
          const nextSafeArea = updates.safeArea
            ? {
                ...state.panelConstraints.safeArea,
                ...updates.safeArea,
              }
            : state.panelConstraints.safeArea;

          return {
            panelConstraints: {
              ...state.panelConstraints,
              ...updates,
              safeArea: nextSafeArea,
            },
          };
        }),

      togglePanelConstraints: (enabled) =>
        set((state) => ({
          panelConstraints: {
            ...state.panelConstraints,
            enabled:
              typeof enabled === "boolean"
                ? enabled
                : !state.panelConstraints.enabled,
          },
        })),

      setActiveTab: (hostId, tabId) =>
        set((state) => {
          const host = state.windows[hostId];
          if (!host?.tabs || !host.tabs.includes(tabId)) return {};
          return {
            windows: {
              ...state.windows,
              [hostId]: { ...host, activeTabId: tabId },
            },
          };
        }),

      mergeWindows: (sourceId, targetId) =>
        set((state) => {
          if (!state.panelGroupingEnabled) return {};
          if (sourceId === targetId) return {};
          const source = state.windows[sourceId];
          const target = state.windows[targetId];
          if (!source || !target) return {};

          const targetTabs = target.tabs ?? [targetId];
          const sourceTabs = source.tabs ?? [sourceId];
          const mergedTabs = Array.from(
            new Set([...targetTabs, ...sourceTabs]),
          );

          const nextWindows = { ...state.windows };
          nextWindows[targetId] = {
            ...target,
            tabs: mergedTabs,
            activeTabId: source.activeTabId || sourceId,
          };

          for (const tabId of mergedTabs) {
            if (tabId === targetId) continue;
            const tab = nextWindows[tabId];
            if (!tab) continue;
            nextWindows[tabId] = {
              ...tab,
              groupHostId: targetId,
              isMinimized: true,
            };
          }

          const filteredOrder = state.panelOrder.filter(
            (p) => !mergedTabs.includes(p) || p === targetId,
          );
          const newOrder = filteredOrder.filter((p) => p !== targetId);
          newOrder.push(targetId);

          return {
            windows: nextWindows,
            panelOrder: newOrder,
          };
        }),

      detachTab: (tabId) =>
        set((state) => {
          const tab = state.windows[tabId];
          if (!tab) return {};
          const hostId = tab.groupHostId ?? (tab.tabs ? tabId : null);
          if (!hostId) return {};
          const host = state.windows[hostId];
          if (!host?.tabs) return {};

          const remainingTabs = host.tabs.filter((id) => id !== tabId);
          const nextWindows = { ...state.windows };

          if (tabId === hostId && remainingTabs.length > 0) {
            const newHostId = remainingTabs[0];
            const newTabs = remainingTabs;
            const newHost = nextWindows[newHostId];
            if (!newHost) return {};
            nextWindows[newHostId] = {
              ...newHost,
              tabs: newTabs,
              activeTabId:
                host.activeTabId && host.activeTabId !== hostId
                  ? host.activeTabId
                  : newHostId,
              groupHostId: undefined,
              isMinimized: false,
              position: host.position,
              size: host.size,
            };
            for (const id of newTabs) {
              if (id === newHostId) continue;
              const child = nextWindows[id];
              if (!child) continue;
              nextWindows[id] = {
                ...child,
                groupHostId: newHostId,
                isMinimized: true,
              };
            }
            nextWindows[hostId] = {
              ...host,
              tabs: undefined,
              activeTabId: undefined,
              groupHostId: undefined,
              isMinimized: false,
            };

            const newOrder = state.panelOrder.filter((p) => p !== hostId);
            if (!newOrder.includes(newHostId)) newOrder.push(newHostId);
            return { windows: nextWindows, panelOrder: newOrder };
          }

          nextWindows[hostId] = {
            ...host,
            tabs: remainingTabs.length > 1 ? remainingTabs : undefined,
            activeTabId:
              host.activeTabId === tabId ? remainingTabs[0] : host.activeTabId,
          };
          nextWindows[tabId] = {
            ...tab,
            groupHostId: undefined,
            isMinimized: false,
          };

          if (remainingTabs.length <= 1) {
            const onlyId = remainingTabs[0];
            if (onlyId) {
              nextWindows[onlyId] = {
                ...nextWindows[onlyId],
                groupHostId: undefined,
                isMinimized: false,
                tabs: undefined,
                activeTabId: undefined,
              };
            }
          }

          const newOrder = state.panelOrder.filter((p) => p !== tabId);
          newOrder.push(tabId);
          return { windows: nextWindows, panelOrder: newOrder };
        }),

      moveTab: (hostId, tabId, targetIndex) =>
        set((state) => {
          const host = state.windows[hostId];
          if (!host?.tabs || !host.tabs.includes(tabId)) return {};
          const currentIndex = host.tabs.indexOf(tabId);
          const nextTabs = host.tabs.filter((id) => id !== tabId);
          const adjustedIndex =
            targetIndex > currentIndex ? targetIndex - 1 : targetIndex;
          const clampedIndex = Math.max(
            0,
            Math.min(adjustedIndex, nextTabs.length),
          );
          nextTabs.splice(clampedIndex, 0, tabId);
          return {
            windows: {
              ...state.windows,
              [hostId]: {
                ...host,
                tabs: nextTabs,
              },
            },
          };
        }),
    }),
    {
      name: "embeddr-zen-windows",
    },
  ),
);
