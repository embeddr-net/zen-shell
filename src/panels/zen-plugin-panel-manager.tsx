import React from "react";
import * as Lucide from "lucide-react";
import { DynamicPluginComponent } from "../plugins/dynamic-loader";
import { PluginErrorBoundary } from "../plugins/plugin-error-boundary";
import { usePluginRegistry } from "../plugins/registry";
import { useZenGlobalStoreContext, useZenWindowStoreContext } from "../stores";
import { ZenDraggablePanel } from "./zen-draggable-panel";
import { ZenPanelManagerCore } from "./zen-panel-manager-core";
import { resolvePluginComponent } from "./plugin-components";
import type { ResolvedPluginComponent } from "./plugin-components";
import type { ZenWindowRendererProps, ZenWindowStateLike } from "./zen-panel-manager-core";
import type { EmbeddrAPI, PluginDefinition } from "@embeddr/react-ui/types";

const ZenPluginPanelManagerContext = React.createContext<ZenPluginPanelManagerProps | null>(null);

function useZenPluginPanelManagerProps() {
  const value = React.useContext(ZenPluginPanelManagerContext);
  if (!value) {
    throw new Error(
      "ZenPluginPanelManagerContext is missing. Wrap renderers with ZenPluginPanelManager.",
    );
  }
  return value;
}

type PluginContext = {
  artifactId?: string | number;
  imageUrl?: string;
};

type PluginPanelChromeState = {
  showTitle: boolean;
  isHeaderHidden: boolean;
  headerHeight: number;
  hideHeader: boolean;
};

type PluginComponentDefLike = NonNullable<PluginDefinition["components"]>[number] & {
  exportName?: string;
  props?: Record<string, unknown>;
  location?: string;
};

export type ZenPluginPanelManagerAdditionalSettingsArgs = {
  windowState: ZenWindowStateLike;
  activeWindow: ZenWindowStateLike;
  resolved: ResolvedPluginComponent;
  isActive: boolean;
  zIndex: number;
};

export type ZenPluginPanelManagerContextArgs = {
  windowState: ZenWindowStateLike;
  activeWindow: ZenWindowStateLike;
  resolved: ResolvedPluginComponent;
  selectedImage: any | null;
  defaultContext: PluginContext;
};

export type ZenPluginPanelManagerProps = {
  api: EmbeddrAPI;
  logos?: Record<string, string | null>;
  getPluginApi?: (pluginId: string) => EmbeddrAPI;
  getWindowContext?: (args: ZenPluginPanelManagerContextArgs) => PluginContext | undefined;
  getAdditionalSettingsItems?: (
    args: ZenPluginPanelManagerAdditionalSettingsArgs,
  ) => React.ReactNode;
  renderUnknown?: (windowState: ZenWindowStateLike) => React.ReactNode;
};

function resolveTitle(windowState: ZenWindowStateLike, def?: PluginComponentDefLike | null) {
  return (
    windowState.title?.trim() ||
    def?.label ||
    def?.id ||
    windowState.componentId ||
    "Untitled Panel"
  );
}

function resolveTitleIcon(def: PluginComponentDefLike | null | undefined, logoUrl?: string | null) {
  if (logoUrl) {
    return <img src={logoUrl} alt="panel logo" className="h-4 w-4 rounded-sm object-contain" />;
  }

  const icon = def?.icon as React.ComponentType<{ className?: string }> | string | undefined;
  if (!icon) return undefined;

  if (typeof icon === "string") {
    const Icon = (Lucide as unknown as Record<string, React.ComponentType<{ className?: string }>>)[
      icon
    ];
    return Icon ? <Icon className="h-4 w-4" /> : undefined;
  }

  const Icon = icon;
  return <Icon className="h-4 w-4" />;
}

const PluginPanelContent = React.memo(
  ({
    resolved,
    api,
    activeWindow,
    isActive,
    context,
    chromeState,
  }: {
    resolved: ResolvedPluginComponent;
    api: EmbeddrAPI;
    activeWindow: ZenWindowStateLike;
    isActive: boolean;
    context: PluginContext;
    chromeState: PluginPanelChromeState;
  }) => {
    const panelProps = {
      id: activeWindow.id,
      defaultPosition: activeWindow.props?.defaultPosition,
      isActive,
      showTitle: chromeState.showTitle,
      isHeaderHidden: chromeState.isHeaderHidden,
      headerHeight: chromeState.headerHeight,
      hideHeader: chromeState.hideHeader,
    };

    const sharedProps = {
      ...(resolved.def?.props || {}),
      ...(activeWindow.props || {}),
      id: activeWindow.id,
      windowId: activeWindow.id,
      openRevision: activeWindow.openRevision,
      panel: panelProps,
      context,
      showTitle: chromeState.showTitle,
      isHeaderHidden: chromeState.isHeaderHidden,
      headerHeight: chromeState.headerHeight,
      hideHeader: chromeState.hideHeader,
      api,
    };

    const InlineComponent =
      resolved.def?.component && typeof resolved.def.component === "function"
        ? (resolved.def.component as React.ComponentType<any>)
        : null;

    return (
      <div className="embeddr-plugin-scope h-full w-full">
        <PluginErrorBoundary pluginId={resolved.pluginId} componentName={resolved.componentName}>
          {InlineComponent ? (
            <InlineComponent {...sharedProps} />
          ) : (
            <DynamicPluginComponent
              pluginId={resolved.pluginId}
              componentName={resolved.componentName}
              {...sharedProps}
            />
          )}
        </PluginErrorBoundary>
      </div>
    );
  },
  (prev, next) =>
    prev.resolved.pluginId === next.resolved.pluginId &&
    prev.resolved.componentName === next.resolved.componentName &&
    prev.api === next.api &&
    prev.activeWindow.id === next.activeWindow.id &&
    prev.activeWindow.openRevision === next.activeWindow.openRevision &&
    prev.activeWindow.props === next.activeWindow.props &&
    prev.activeWindow.position?.x === next.activeWindow.position?.x &&
    prev.activeWindow.position?.y === next.activeWindow.position?.y &&
    prev.activeWindow.size?.width === next.activeWindow.size?.width &&
    prev.activeWindow.size?.height === next.activeWindow.size?.height &&
    prev.isActive === next.isActive &&
    prev.chromeState.showTitle === next.chromeState.showTitle &&
    prev.chromeState.isHeaderHidden === next.chromeState.isHeaderHidden &&
    prev.chromeState.headerHeight === next.chromeState.headerHeight &&
    prev.chromeState.hideHeader === next.chromeState.hideHeader &&
    prev.context.artifactId === next.context.artifactId &&
    prev.context.imageUrl === next.context.imageUrl,
);

const PluginWindowRenderer = React.memo(
  ({ windowState, zIndex, isBackdrop, isActive }: ZenWindowRendererProps) => {
    const {
      api,
      logos,
      getPluginApi,
      getWindowContext,
      getAdditionalSettingsItems,
      renderUnknown,
    } = useZenPluginPanelManagerProps();
    const closeWindow = useZenWindowStoreContext((s) => s.closeWindow);
    const minimizeWindow = useZenWindowStoreContext((s) => s.minimizeWindow);
    const togglePin = useZenWindowStoreContext((s) => s.togglePin);
    const bringToFront = useZenWindowStoreContext((s) => s.bringToFront);
    const updateWindow = useZenWindowStoreContext((s) => s.updateWindow);
    const setActiveTab = useZenWindowStoreContext((s) => s.setActiveTab);
    const detachTab = useZenWindowStoreContext((s) => s.detachTab);
    const selectedImage = useZenGlobalStoreContext((s) => s.selectedImage);
    const registryPlugins = usePluginRegistry((s) => s.plugins);

    const tabs = windowState.tabs || [windowState.id];
    const activeTabId = windowState.activeTabId || windowState.id;
    const activeWindow =
      useZenWindowStoreContext(
        React.useCallback(
          (s) => s.windows[activeTabId] || s.windows[windowState.id] || windowState,
          [activeTabId, windowState.id],
        ),
      ) || windowState;
    const resolved = resolvePluginComponent(activeWindow.componentId, registryPlugins);

    if (!resolved) {
      return (
        <ZenDraggablePanel
          id={windowState.id}
          title={windowState.title || activeWindow.componentId || "Unknown Panel"}
          isOpen={!windowState.isMinimized}
          onClose={() => closeWindow(windowState.id)}
          onMinimize={() => minimizeWindow(windowState.id)}
          onPinChange={() => togglePin(windowState.id)}
          onMouseDown={() => bringToFront(windowState.id)}
          position={windowState.position}
          size={windowState.size}
          onPositionChange={(position) => updateWindow(windowState.id, { position })}
          onSizeChange={(size) => updateWindow(windowState.id, { size })}
          pinned={windowState.isPinned}
          zIndex={zIndex}
          isActive={isActive}
        >
          {renderUnknown ? (
            renderUnknown(activeWindow)
          ) : (
            <div className="p-4 text-xs text-muted-foreground">
              Unknown panel: {activeWindow.componentId}
            </div>
          )}
        </ZenDraggablePanel>
      );
    }

    const defaultContext = {
      artifactId: selectedImage?.id,
      imageUrl: selectedImage?.url || selectedImage?.image_url || selectedImage?.thumb_url,
    };
    const context =
      getWindowContext?.({
        windowState,
        activeWindow,
        resolved,
        selectedImage,
        defaultContext,
      }) || defaultContext;

    const title = resolveTitle(activeWindow, resolved.def);
    const titleIcon = resolveTitleIcon(resolved.def, logos?.[resolved.pluginId] || null);
    const additionalSettingsItems = getAdditionalSettingsItems?.({
      windowState,
      activeWindow,
      resolved,
      isActive,
      zIndex,
    });

    const defaultPosition = activeWindow.props?.defaultPosition || resolved.def?.defaultPosition;
    const defaultSize = activeWindow.props?.defaultSize || resolved.def?.defaultSize;
    const hideHeader = isBackdrop
      ? true
      : activeWindow.props?.hideHeader ||
        activeWindow.props?.options?.hideHeader ||
        resolved.def?.options?.hideHeader;
    const transparent =
      activeWindow.props?.transparent ||
      activeWindow.props?.options?.transparent ||
      resolved.def?.options?.transparent;

    return (
      <ZenDraggablePanel
        id={windowState.id}
        title={title}
        titleIcon={titleIcon}
        isOpen={!windowState.isMinimized}
        onClose={() => closeWindow(windowState.id)}
        onMinimize={() => minimizeWindow(windowState.id)}
        onPinChange={() => togglePin(windowState.id)}
        onMouseDown={() => bringToFront(windowState.id)}
        position={isBackdrop ? { x: 0, y: 0 } : windowState.position}
        size={
          isBackdrop
            ? {
                width: typeof window !== "undefined" ? window.innerWidth : 1000,
                height: typeof window !== "undefined" ? window.innerHeight : 1000,
              }
            : windowState.size
        }
        onPositionChange={(position) => updateWindow(windowState.id, { position })}
        onSizeChange={(size) => updateWindow(windowState.id, { size })}
        defaultPosition={defaultPosition}
        defaultSize={defaultSize}
        hideHeader={hideHeader}
        transparent={transparent}
        pinned={isBackdrop ? true : windowState.isPinned}
        zIndex={isBackdrop ? 0 : zIndex}
        isActive={isActive}
        className={
          isBackdrop
            ? "!fixed !inset-0 !w-screen !h-screen !left-0 !top-0 !border-0 !shadow-none !transform-none !bg-background"
            : undefined
        }
        additionalSettingsItems={additionalSettingsItems}
      >
        {({ showTitle: panelShowTitle, isActive: panelIsActive }) => {
          const chromeState: PluginPanelChromeState = {
            showTitle: !hideHeader && panelShowTitle,
            isHeaderHidden: Boolean(hideHeader) || !panelShowTitle,
            headerHeight: hideHeader || !panelShowTitle ? 16 : 42,
            hideHeader: Boolean(hideHeader),
          };

          return (
            <div className="flex h-full min-h-0 flex-col">
              {tabs.length > 1 ? (
                <div className="flex items-center gap-1 border-b border-border bg-background/40 px-2 py-2">
                  {tabs.map((tabId) => (
                    <TabButton
                      key={tabId}
                      tabId={tabId}
                      hostId={windowState.id}
                      isActive={tabId === activeTabId}
                      onSelect={setActiveTab}
                    />
                  ))}
                  {activeTabId !== windowState.id ? (
                    <button
                      className="ml-auto text-[10px] text-muted-foreground hover:text-foreground"
                      onClick={() => detachTab(activeTabId)}
                      title="Detach tab"
                    >
                      Detach
                    </button>
                  ) : null}
                </div>
              ) : null}
              <div className="min-h-0 flex-1">
                <PluginPanelContent
                  resolved={resolved}
                  api={getPluginApi?.(resolved.pluginId) || api}
                  activeWindow={activeWindow}
                  isActive={panelIsActive}
                  context={context}
                  chromeState={chromeState}
                />
              </div>
            </div>
          );
        }}
      </ZenDraggablePanel>
    );
  },
);

const TabButton = React.memo(
  ({
    tabId,
    hostId,
    isActive,
    onSelect,
  }: {
    tabId: string;
    hostId: string;
    isActive: boolean;
    onSelect: (hostId: string, tabId: string) => void;
  }) => {
    const title = useZenWindowStoreContext((s) => s.windows[tabId]?.title || tabId);

    return (
      <button
        className={
          isActive
            ? "rounded border border-primary/40 bg-primary/10 px-2 py-1 text-[11px] text-foreground"
            : "rounded border border-transparent px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted/60"
        }
        onClick={() => onSelect(hostId, tabId)}
      >
        {title}
      </button>
    );
  },
  (prev, next) =>
    prev.tabId === next.tabId &&
    prev.hostId === next.hostId &&
    prev.isActive === next.isActive &&
    prev.onSelect === next.onSelect,
);

export function ZenPluginPanelManager(props: ZenPluginPanelManagerProps) {
  const contextValue = React.useMemo(
    () => ({
      api: props.api,
      logos: props.logos,
      getPluginApi: props.getPluginApi,
      getWindowContext: props.getWindowContext,
      getAdditionalSettingsItems: props.getAdditionalSettingsItems,
      renderUnknown: props.renderUnknown,
    }),
    [
      props.api,
      props.getAdditionalSettingsItems,
      props.getPluginApi,
      props.getWindowContext,
      props.logos,
      props.renderUnknown,
    ],
  );

  return (
    <ZenPluginPanelManagerContext.Provider value={contextValue}>
      <ZenPanelManagerCore
        useWindowStore={useZenWindowStoreContext}
        WindowRenderer={PluginWindowRenderer}
      />
    </ZenPluginPanelManagerContext.Provider>
  );
}
