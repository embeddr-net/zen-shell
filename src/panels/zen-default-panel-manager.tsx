import React from "react";
import { useZenWindowStoreContext } from "../stores";
import { ZenDraggablePanel } from "./zen-draggable-panel";
import { ZenPanelManagerCore } from "./zen-panel-manager-core";
import type { ZenWindowRendererProps, ZenWindowStateLike } from "./zen-panel-manager-core";

export type ZenPanelManagerProps = {
  renderContent?: (windowState: ZenWindowStateLike) => React.ReactNode;
};

const DefaultWindowRenderer = ({
  windowState,
  zIndex,
  isActive,
  renderContent,
}: ZenWindowRendererProps & {
  renderContent?: (windowState: ZenWindowStateLike) => React.ReactNode;
}) => {
  const closeWindow = useZenWindowStoreContext((s) => s.closeWindow);
  const minimizeWindow = useZenWindowStoreContext((s) => s.minimizeWindow);
  const togglePin = useZenWindowStoreContext((s) => s.togglePin);
  const bringToFront = useZenWindowStoreContext((s) => s.bringToFront);

  return (
    <ZenDraggablePanel
      id={windowState.id}
      title={windowState.title || "Zen Panel"}
      isOpen={!windowState.isMinimized}
      onClose={() => closeWindow(windowState.id)}
      onMinimize={() => minimizeWindow(windowState.id)}
      onPinChange={() => togglePin(windowState.id)}
      onMouseDown={() => bringToFront(windowState.id)}
      defaultPosition={windowState.props?.defaultPosition}
      defaultSize={windowState.props?.defaultSize}
      pinned={windowState.isPinned}
      zIndex={zIndex}
      isActive={isActive}
    >
      {renderContent ? (
        renderContent(windowState)
      ) : (
        <div className="h-full w-full p-4 text-sm">
          <div className="font-semibold">Zen Panel</div>
          <div className="text-xs text-muted-foreground mt-1">
            componentId: {windowState.componentId}
          </div>
        </div>
      )}
    </ZenDraggablePanel>
  );
};

export const ZenPanelManager = ({ renderContent }: ZenPanelManagerProps) => {
  const WindowRenderer = React.useCallback(
    (props: ZenWindowRendererProps) => (
      <DefaultWindowRenderer {...props} renderContent={renderContent} />
    ),
    [renderContent],
  );

  return (
    <ZenPanelManagerCore
      useWindowStore={useZenWindowStoreContext}
      WindowRenderer={WindowRenderer}
    />
  );
};
