import { create } from "zustand";

export type ZenPanelState = {
  activePanelId: string | null;
  setActivePanel: (id: string | null) => void;
  panelOrder: Array<string>;
  bringToFront: (id: string) => void;
};

export const useZenPanelStore = create<ZenPanelState>((set) => ({
  activePanelId: null,
  panelOrder: [],
  setActivePanel: (id) => set({ activePanelId: id }),
  bringToFront: (id) =>
    set((state) => {
      const newOrder = state.panelOrder.filter((panelId) => panelId !== id);
      newOrder.push(id);
      return { activePanelId: id, panelOrder: newOrder };
    }),
}));
