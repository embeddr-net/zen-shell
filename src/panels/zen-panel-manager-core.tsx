import React from "react";

export type ZenWindowStateLike = {
  id: string;
  title?: string;
  componentId: string;
  props?: any;
  openRevision?: number;
  isMinimized?: boolean;
  isPinned?: boolean;
  tabs?: string[];
  activeTabId?: string;
  groupHostId?: string;
  position?: { x: number; y: number };
  size?: { width: number; height: number };
};

export type ZenWindowRendererProps = {
  id: string;
  windowState: ZenWindowStateLike;
  panelOrder: string[];
  zIndex: number;
  isBackdrop: boolean;
  isActive: boolean;
};

export type ZenPanelManagerCoreProps = {
  useWindowStore: <T>(selector: (state: any) => T) => T;
  WindowRenderer: React.ComponentType<ZenWindowRendererProps>;
};

/**
 * Individual window host – uses TARGETED selectors so it only re-renders
 * when THIS window's derived state actually changes (not on every panelOrder mutation).
 */
const ZenWindowRendererHost = React.memo(
  ({
    id,
    useWindowStore,
    WindowRenderer,
  }: {
    id: string;
    useWindowStore: <T>(selector: (state: any) => T) => T;
    WindowRenderer: React.ComponentType<ZenWindowRendererProps>;
  }) => {
    const windowState = useWindowStore((s) => s.windows[id]) as
      | ZenWindowStateLike
      | undefined;

    // Targeted: only re-render when THIS window's zIndex or active status changes
    const orderIndex = useWindowStore((s) =>
      (s.panelOrder as string[]).indexOf(id),
    ) as number;
    const isLastInOrder = useWindowStore(
      (s) =>
        (s.panelOrder as string[])[(s.panelOrder as string[]).length - 1] ===
        id,
    ) as boolean;
    const backdropWindowId = useWindowStore((s) => s.backdropWindowId) as
      | string
      | null;

    // Still need full panelOrder for the WindowRenderer prop (legacy compat)
    const panelOrder = useWindowStore((s) => s.panelOrder) as string[];

    if (!windowState || windowState.isMinimized) {
      return null;
    }

    const baseOrder = orderIndex === -1 ? 0 : orderIndex;
    const isBackdrop = windowState.id === backdropWindowId;
    const zIndex = isBackdrop
      ? 0
      : windowState.isPinned
        ? 1000 + baseOrder
        : 20 + baseOrder;
    const isActive = isLastInOrder;

    return (
      <WindowRenderer
        id={id}
        windowState={windowState}
        panelOrder={panelOrder}
        zIndex={zIndex}
        isBackdrop={isBackdrop}
        isActive={isActive}
      />
    );
  },
  (prev, next) =>
    prev.id === next.id &&
    prev.useWindowStore === next.useWindowStore &&
    prev.WindowRenderer === next.WindowRenderer,
);

export function ZenPanelManagerCore({
  useWindowStore,
  WindowRenderer,
}: ZenPanelManagerCoreProps) {
  // Only subscribe to the list of open, non-minimized, non-grouped window IDs
  const openWindowIds = useWindowStore(
    React.useCallback(
      (s: any) =>
        Object.values(s.windows as Record<string, ZenWindowStateLike>)
          .filter((win) => !win.isMinimized && !win.groupHostId)
          .map((win) => win.id)
          .sort()
          .join(","),
      [],
    ),
  ) as string;

  const idList = React.useMemo(
    () => (openWindowIds ? openWindowIds.split(",") : []),
    [openWindowIds],
  );

  return (
    <>
      {idList.map((id) => (
        <ZenWindowRendererHost
          key={id}
          id={id}
          useWindowStore={useWindowStore}
          WindowRenderer={WindowRenderer}
        />
      ))}
    </>
  );
}
