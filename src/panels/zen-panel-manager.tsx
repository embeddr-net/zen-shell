import React from "react";
import * as Lucide from "lucide-react";
import { DropdownMenuItem } from "@embeddr/react-ui";
import { useZenWindowStoreContext } from "../stores";
import { UmdPanelHost } from "./umd-panel-host";
import { ZenDraggablePanel } from "./zen-draggable-panel";
import { ZenPanelManagerCore } from "./zen-panel-manager-core";
import type { ZenWindowRendererProps } from "./zen-panel-manager-core";

export type ZenFrontendComponent = {
  name?: string | null;
  component?: string | null;
  label?: string | null;
  icon?: string | null;
  props?: Record<string, unknown> | null;
};

export type ZenPanelDef = {
  name?: string | null;
  component?: string | null;
  label?: string | null;
  icon?: string | null;
  props?: Record<string, unknown> | null;
};

export type ZenInspection = {
  name: string;
  source_path?: string | null;
  output_prefix?: string | null;
  frontend_components?: Array<ZenFrontendComponent> | null;
  panels?: Array<ZenPanelDef> | null;
};

function resolveComponentId(componentId: string, inspections: Record<string, ZenInspection>) {
  const pluginIds = Object.keys(inspections);
  let bestMatch: string | null = null;
  for (const pid of pluginIds) {
    const prefix = `${pid}-`;
    if (componentId.startsWith(prefix)) {
      if (!bestMatch || pid.length > bestMatch.length) {
        bestMatch = pid;
      }
    }
  }
  if (!bestMatch) return null;

  const defId = componentId.slice(bestMatch.length + 1);
  const inspection = inspections[bestMatch];
  const panels = inspection?.panels || [];
  const frontendDefs = inspection?.frontend_components || [];
  const defFromPanels = panels.find((panel) => panel?.name === defId || panel?.component === defId);
  const defFromFrontend = frontendDefs.find(
    (comp) => comp?.name === defId || comp?.component === defId,
  );
  const def = defFromPanels || defFromFrontend;

  return {
    pluginId: bestMatch,
    componentName: def?.component || defId,
    def,
  };
}

function resolveTitle(def?: ZenPanelDef | ZenFrontendComponent | null) {
  return def?.label || def?.name || def?.component || "Untitled Panel";
}

function resolveTitleIcon(
  def: ZenPanelDef | ZenFrontendComponent | null | undefined,
  logoUrl?: string | null,
) {
  if (logoUrl) {
    return <img src={logoUrl} alt="panel logo" className="h-4 w-4 rounded-sm object-contain" />;
  }
  if (!def?.icon) return undefined;
  const Icon = (Lucide as any)[def.icon];
  if (!Icon) return undefined;
  return <Icon className="h-4 w-4" />;
}

function buildBundlePaths(
  pluginId: string,
  inspection: ZenInspection | undefined,
  workspaceDir: string,
  distDir?: string,
) {
  const outputPrefix = inspection?.output_prefix || "plugins";
  const sourceBase = inspection?.source_path
    ? inspection.source_path.split("/").filter(Boolean).pop()
    : pluginId;
  const bundleBase = sourceBase || pluginId;
  const scriptUrl = distDir
    ? `/@fs/${distDir}/${outputPrefix}/${pluginId}/dist/${bundleBase}.umd.js`
    : `/@fs/${workspaceDir}/.sdk/dist/${outputPrefix}/${pluginId}/dist/${bundleBase}.umd.js`;
  const cssUrl = distDir
    ? `/@fs/${distDir}/${outputPrefix}/${pluginId}/dist/style.css`
    : `/@fs/${workspaceDir}/.sdk/dist/${outputPrefix}/${pluginId}/dist/style.css`;
  return { scriptUrl, cssUrl };
}

export function ZenUmdPanelManager({
  inspections,
  workspaceDir,
  logos,
  distDir,
  api,
}: {
  inspections: Record<string, ZenInspection>;
  workspaceDir: string;
  logos?: Record<string, string | null>;
  distDir?: string;
  api: any;
}) {
  const WindowRenderer = React.useCallback(
    (props: ZenWindowRendererProps) => (
      <UmdWindowRenderer
        {...props}
        inspections={inspections}
        workspaceDir={workspaceDir}
        distDir={distDir}
        api={api}
        logos={logos}
      />
    ),
    [inspections, workspaceDir, distDir, api, logos],
  );

  return (
    <ZenPanelManagerCore
      useWindowStore={useZenWindowStoreContext}
      WindowRenderer={WindowRenderer}
    />
  );
}

const UmdWindowRenderer = React.memo(
  ({
    windowState,
    zIndex,
    isBackdrop,
    isActive,
    inspections,
    workspaceDir,
    logos,
    distDir,
    api,
  }: ZenWindowRendererProps & {
    inspections: Record<string, ZenInspection>;
    workspaceDir: string;
    logos?: Record<string, string | null>;
    distDir?: string;
    api: any;
  }) => {
    const closeWindow = useZenWindowStoreContext((s) => s.closeWindow);
    const minimizeWindow = useZenWindowStoreContext((s) => s.minimizeWindow);
    const togglePin = useZenWindowStoreContext((s) => s.togglePin);
    const setBackdrop = useZenWindowStoreContext((s) => s.setBackdrop);
    const updateWindow = useZenWindowStoreContext((s) => s.updateWindow);
    const bringToFront = useZenWindowStoreContext((s) => s.bringToFront);
    const windows = useZenWindowStoreContext((s) => s.windows);
    const setActiveTab = useZenWindowStoreContext((s) => s.setActiveTab);
    const detachTab = useZenWindowStoreContext((s) => s.detachTab);
    const moveTab = useZenWindowStoreContext((s) => s.moveTab);

    const tabs = windowState.tabs || [windowState.id];
    const activeTabId = windowState.activeTabId || windowState.id;
    const activeWindow = windows[activeTabId] || windowState;

    const resolved = resolveComponentId(activeWindow.componentId, inspections);

    if (!resolved) {
      if (activeWindow.componentId === "test") {
        return (
          <ZenDraggablePanel
            id={windowState.id}
            title={activeWindow.title || "Test Window"}
            isOpen={!windowState.isMinimized}
            onClose={() => closeWindow(windowState.id)}
            position={windowState.position}
            size={windowState.size}
            onPositionChange={(pos) => updateWindow(windowState.id, { position: pos })}
            onSizeChange={(size) => updateWindow(windowState.id, { size })}
            zIndex={zIndex}
            isActive={isActive}
            onMinimize={() => minimizeWindow(windowState.id)}
            pinned={windowState.isPinned}
            onPinChange={() => togglePin(windowState.id)}
            onMouseDown={() => bringToFront(windowState.id)}
          >
            <div className="p-4 flex flex-col items-center justify-center h-full text-muted-foreground bg-secondary/10">
              {tabs.length > 1 && (
                <div className="w-full flex items-center gap-1 px-2 py-2 border-b border-border bg-background/40">
                  {tabs.map((tabId: string) => (
                    <button
                      key={tabId}
                      className={`px-2 py-1 text-[11px] rounded border ${
                        tabId === activeTabId
                          ? "bg-primary/10 border-primary/40 text-foreground"
                          : "border-transparent text-muted-foreground hover:bg-muted/60"
                      }`}
                      onClick={() => setActiveTab(windowState.id, tabId)}
                    >
                      {windows[tabId]?.title || tabId}
                    </button>
                  ))}
                  {activeTabId !== windowState.id && (
                    <button
                      className="ml-auto text-[10px] text-muted-foreground hover:text-foreground"
                      onClick={() => detachTab(activeTabId)}
                      title="Detach tab"
                    >
                      Detach
                    </button>
                  )}
                </div>
              )}
              <div className="flex flex-col items-center justify-center h-full w-full">
                <p className="font-medium">Test Window</p>
                <p className="text-xs">ID: {windowState.id}</p>
              </div>
            </div>
          </ZenDraggablePanel>
        );
      }
      return null;
    }

    const inspection = inspections[resolved.pluginId];
    const { scriptUrl, cssUrl } = buildBundlePaths(
      resolved.pluginId,
      inspection,
      workspaceDir,
      distDir,
    );

    const title = activeWindow.title?.trim() || resolveTitle(resolved.def) || "Untitled";
    const titleIcon = resolveTitleIcon(resolved.def, logos?.[resolved.pluginId] || null);

    return (
      <UmdPanelHost
        pluginId={resolved.pluginId}
        componentName={resolved.componentName}
        title={title}
        titleIcon={titleIcon}
        api={api}
        defaultPosition={windowState.position}
        defaultSize={windowState.size}
        position={windowState.position}
        size={windowState.size}
        onClose={() => closeWindow(windowState.id)}
        onMinimize={() => minimizeWindow(windowState.id)}
        scriptUrl={scriptUrl}
        cssUrl={cssUrl}
        panelId={windowState.id}
        panelProps={{
          ...activeWindow.props,
          openRevision: activeWindow.openRevision,
          tabStrip:
            tabs.length > 1
              ? {
                  tabs,
                  activeTabId,
                  onSelect: (tabId: string) => setActiveTab(windowState.id, tabId),
                  onDetach: (tabId: string) => detachTab(tabId),
                  onDetachAt: (tabId: string) => {
                    detachTab(tabId);
                  },
                  onMove: (tabId: string, targetIndex: number) =>
                    moveTab(windowState.id, tabId, targetIndex),
                  titles: tabs.reduce((acc: Record<string, string>, id: string) => {
                    acc[id] = windows[id]?.title?.trim() || "Untitled Panel";
                    return acc;
                  }, {}),
                }
              : null,
        }}
        zIndex={zIndex}
        isActive={isActive}
        pinned={isBackdrop ? true : windowState.isPinned}
        onPinChange={() => togglePin(windowState.id)}
        additionalSettingsItems={
          <DropdownMenuItem
            onClick={() => (isBackdrop ? setBackdrop(null) : setBackdrop(windowState.id))}
          >
            {isBackdrop ? "Exit Backdrop" : "Set as Backdrop"}
          </DropdownMenuItem>
        }
        onPositionChange={(pos) => updateWindow(windowState.id, { position: pos })}
        onSizeChange={(size) => updateWindow(windowState.id, { size })}
      />
    );
  },
  (prev, next) =>
    prev.windowState === next.windowState &&
    prev.zIndex === next.zIndex &&
    prev.isBackdrop === next.isBackdrop &&
    prev.isActive === next.isActive &&
    prev.inspections === next.inspections &&
    prev.workspaceDir === next.workspaceDir &&
    prev.api === next.api,
);
