import React from "react";
import { ThemeProvider } from "../providers/theme-provider";
import { ZenStoreProvider, useZenWindowStoreContext } from "../stores";
import { ZenPanelManager } from "../panels/zen-default-panel-manager";
import { registerZenGlobals } from "../runtime/zen-globals";
import { useScreenSafeArea } from "../hooks/use-screen-safe-area";
import type { ZenStoreBundle } from "../stores";

type PanelSafeAreaInput =
  | number
  | Partial<{ top: number; right: number; bottom: number; left: number }>;

type ZenShellWindowBehaviorProps = {
  containPanelsToViewport?: boolean;
  panelSafeArea?: PanelSafeAreaInput;
  panelSnapThreshold?: number;
  enablePanelGrouping?: boolean;
  autoPanelSafeArea?: boolean;
  safeAreaElementId?: string;
  safeAreaEdgePadding?: number;
  safeAreaOverlayCollapsedThresholdPx?: number;
};

export type ZenShellProps = {
  children?: React.ReactNode;
  stores?: Partial<ZenStoreBundle>;
  themeStorageKey?: string;
  renderPanels?: boolean;
  useThemeProvider?: boolean;
  globals?: Record<string, unknown>;
} & ZenShellWindowBehaviorProps;

const normalizeSafeArea = (
  input: PanelSafeAreaInput | undefined,
): { top: number; right: number; bottom: number; left: number } | undefined => {
  if (typeof input === "number") {
    const value = Math.max(0, input);
    return {
      top: value,
      right: value,
      bottom: value,
      left: value,
    };
  }
  if (!input) return undefined;
  return {
    top: Math.max(0, input.top ?? 0),
    right: Math.max(0, input.right ?? 0),
    bottom: Math.max(0, input.bottom ?? 0),
    left: Math.max(0, input.left ?? 0),
  };
};

const ZenWindowBehaviorSync = ({
  containPanelsToViewport,
  panelSafeArea,
  panelSnapThreshold,
  enablePanelGrouping = false,
  autoPanelSafeArea = true,
  safeAreaElementId = "embeddr-command-bar",
  safeAreaEdgePadding = 8,
  safeAreaOverlayCollapsedThresholdPx = 10,
}: ZenShellWindowBehaviorProps) => {
  const setPanelConstraints = useZenWindowStoreContext((state) => state.setPanelConstraints);
  const setPanelGroupingEnabled = useZenWindowStoreContext(
    (state) => state.setPanelGroupingEnabled,
  );

  const normalizedSafeArea = React.useMemo(() => normalizeSafeArea(panelSafeArea), [panelSafeArea]);
  const measuredSafeArea = useScreenSafeArea({
    enabled: autoPanelSafeArea,
    commandBarElementId: safeAreaElementId,
    edgePadding: safeAreaEdgePadding,
    overlayCollapsedThresholdPx: safeAreaOverlayCollapsedThresholdPx,
  });
  const effectiveSafeArea = React.useMemo(
    () =>
      normalizedSafeArea ??
      (autoPanelSafeArea
        ? {
            top: measuredSafeArea.top,
            right: measuredSafeArea.right,
            bottom: measuredSafeArea.bottom,
            left: measuredSafeArea.left,
          }
        : undefined),
    [
      autoPanelSafeArea,
      measuredSafeArea.bottom,
      measuredSafeArea.left,
      measuredSafeArea.right,
      measuredSafeArea.top,
      normalizedSafeArea,
    ],
  );

  React.useEffect(() => {
    setPanelConstraints({
      enabled: Boolean(containPanelsToViewport),
      ...(effectiveSafeArea ? { safeArea: effectiveSafeArea } : {}),
      ...(typeof panelSnapThreshold === "number"
        ? { snapThreshold: Math.max(0, panelSnapThreshold) }
        : {}),
    });
  }, [
    autoPanelSafeArea,
    containPanelsToViewport,
    effectiveSafeArea,
    panelSnapThreshold,
    safeAreaEdgePadding,
    safeAreaElementId,
    safeAreaOverlayCollapsedThresholdPx,
    setPanelConstraints,
  ]);

  React.useEffect(() => {
    setPanelGroupingEnabled(Boolean(enablePanelGrouping));
  }, [enablePanelGrouping, setPanelGroupingEnabled]);

  return null;
};

export const ZenShell = ({
  children,
  stores,
  themeStorageKey = "embeddr-zen-theme",
  renderPanels = true,
  useThemeProvider = true,
  globals,
  containPanelsToViewport = false,
  panelSafeArea,
  panelSnapThreshold,
  enablePanelGrouping = false,
  autoPanelSafeArea = true,
  safeAreaElementId,
  safeAreaEdgePadding,
  safeAreaOverlayCollapsedThresholdPx,
}: ZenShellProps) => {
  React.useEffect(() => {
    registerZenGlobals(globals);
  }, [globals]);

  const body = (
    <ZenStoreProvider overrideStores={stores}>
      <ZenWindowBehaviorSync
        containPanelsToViewport={containPanelsToViewport}
        panelSafeArea={panelSafeArea}
        panelSnapThreshold={panelSnapThreshold}
        enablePanelGrouping={enablePanelGrouping}
        autoPanelSafeArea={autoPanelSafeArea}
        safeAreaElementId={safeAreaElementId}
        safeAreaEdgePadding={safeAreaEdgePadding}
        safeAreaOverlayCollapsedThresholdPx={safeAreaOverlayCollapsedThresholdPx}
      />
      {children}
      {renderPanels ? <ZenPanelManager /> : null}
    </ZenStoreProvider>
  );

  if (!useThemeProvider) return body;

  return <ThemeProvider storageKey={themeStorageKey}>{body}</ThemeProvider>;
};
