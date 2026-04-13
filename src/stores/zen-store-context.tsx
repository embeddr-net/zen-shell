import React, { createContext, useContext, useMemo } from "react";
import type { StoreApi, UseBoundStore } from "zustand";
import { useZenWindowStore } from "../windows/window-store";
import { useZenGlobalStore, type ZenGlobalState } from "./global-store";
import { useZenPanelStore, type ZenPanelState } from "./panel-store";
import {
  useZenPanelUiStore,
  type ZenPanelUiState,
} from "./panel-ui-store";
import type { WindowStore } from "../windows/window-store";

// Use the interface from the implementation to ensure parity
export type ZenWindowStoreState = WindowStore;

export type ZenStoreBundle = {
  globalStore: UseBoundStore<StoreApi<ZenGlobalState>>;
  panelStore: UseBoundStore<StoreApi<ZenPanelState>>;
  panelUiStore: UseBoundStore<StoreApi<ZenPanelUiState>>;
  windowStore: UseBoundStore<StoreApi<ZenWindowStoreState>>;
};

const defaultStores: ZenStoreBundle = {
  globalStore: useZenGlobalStore,
  panelStore: useZenPanelStore,
  panelUiStore: useZenPanelUiStore,
  windowStore: useZenWindowStore,
};

const ZenStoreContext = createContext<ZenStoreBundle>(defaultStores);

export const ZenStoreProvider: React.FC<{
  children: React.ReactNode;
  overrideStores?: Partial<ZenStoreBundle>;
}> = ({ children, overrideStores }) => {
  const stores = useMemo(
    () => ({ ...defaultStores, ...overrideStores }),
    [overrideStores],
  );

  return (
    <ZenStoreContext.Provider value={stores}>
      {children}
    </ZenStoreContext.Provider>
  );
};

export function useZenStores() {
  return useContext(ZenStoreContext);
}

export function useZenWindowStoreContext<T>(
  selector: (state: ZenWindowStoreState) => T,
): T {
  const { windowStore } = useContext(ZenStoreContext);
  return windowStore(selector);
}

export function useZenPanelStoreContext<T>(
  selector: (state: ZenPanelState) => T,
): T {
  const { panelStore } = useContext(ZenStoreContext);
  return panelStore(selector);
}

export function useZenGlobalStoreContext<T>(
  selector: (state: ZenGlobalState) => T,
): T {
  const { globalStore } = useContext(ZenStoreContext);
  return globalStore(selector);
}

export function useZenPanelUiStoreContext<T>(
  selector: (state: ZenPanelUiState) => T,
): T {
  const { panelUiStore } = useContext(ZenStoreContext);
  return panelUiStore(selector);
}
