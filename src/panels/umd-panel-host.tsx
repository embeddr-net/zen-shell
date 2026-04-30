import React from "react";
import { EmbeddrProvider } from "@embeddr/react-ui";
import { DynamicPluginComponent } from "../plugins/dynamic-loader";
import { PluginErrorBoundary } from "../plugins/plugin-error-boundary";
import { ensureUmdBundle } from "../runtime/umd-loader";
import { ZenDraggablePanel } from "./zen-draggable-panel";

type TabStrip = {
  tabs: Array<string>;
  activeTabId?: string;
  titles?: Record<string, string>;
  onSelect?: (tabId: string) => void;
  onMove?: (tabId: string, targetIndex: number) => void;
  onDetach?: (tabId: string) => void;
  onDetachAt?: (tabId: string, position: { x: number; y: number }) => void;
};

type PanelProps = Record<string, unknown> & { tabStrip?: TabStrip | null };

const PluginContent = React.memo(
  ({
    pluginId,
    componentName,
    api,
    windowId,
    pluginProps,
  }: {
    pluginId: string;
    componentName: string;
    api: any;
    windowId: string;
    pluginProps?: Record<string, unknown>;
  }) => (
    <PluginErrorBoundary pluginId={pluginId} componentName={componentName}>
      <DynamicPluginComponent
        pluginId={pluginId}
        componentName={componentName}
        api={api}
        windowId={windowId}
        {...(pluginProps || {})}
      />
    </PluginErrorBoundary>
  ),
  (prev, next) =>
    prev.pluginId === next.pluginId &&
    prev.componentName === next.componentName &&
    prev.api === next.api &&
    prev.windowId === next.windowId &&
    prev.pluginProps === next.pluginProps,
);

export interface UmdPanelHostProps {
  pluginId: string;
  componentName: string;
  title: string;
  titleIcon?: React.ReactNode;
  api: any;
  defaultPosition?: { x: number; y: number };
  defaultSize?: { width: number; height: number };
  position?: { x: number; y: number };
  size?: { width: number; height: number };
  onClose: () => void;
  onMinimize?: () => void;
  zIndex?: number;
  isActive?: boolean;
  pinned?: boolean;
  onPinChange?: () => void;
  onPositionChange?: (pos: { x: number; y: number }) => void;
  onSizeChange?: (size: { width: number; height: number }) => void;
  scriptUrl: string | null;
  cssUrl?: string | null;
  panelId: string;
  panelProps?: Record<string, unknown>;
  additionalSettingsItems?: React.ReactNode;
}

export function UmdPanelHost({
  pluginId,
  componentName,
  title,
  titleIcon,
  api,
  defaultPosition,
  defaultSize,
  position,
  size,
  onClose,
  onMinimize,
  zIndex,
  isActive,
  pinned,
  onPinChange,
  onPositionChange,
  onSizeChange,
  scriptUrl,
  cssUrl,
  panelId,
  panelProps,
  additionalSettingsItems,
}: UmdPanelHostProps) {
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const { tabStrip, ...pluginProps } = (panelProps || {}) as PanelProps;
  const dragRef = React.useRef<{
    tabId: string;
    startX: number;
    startY: number;
    active: boolean;
    mode?: "reorder" | "detach";
  } | null>(null);
  const tabViewportRef = React.useRef<HTMLDivElement | null>(null);
  const tabTrackRef = React.useRef<HTMLDivElement | null>(null);
  const tabStripRef = React.useRef<HTMLDivElement | null>(null);
  const tabButtonRefs = React.useRef(new Map<string, HTMLButtonElement>());
  const tabInsertIndexRef = React.useRef<number | null>(null);
  const [tabInsertLeft, setTabInsertLeft] = React.useState<number | null>(null);
  const [tabOffset, setTabOffset] = React.useState(0);
  const [tabMaxOffset, setTabMaxOffset] = React.useState(0);

  const updateTabMetrics = React.useCallback(() => {
    const viewport = tabViewportRef.current;
    const track = tabTrackRef.current;
    if (!viewport || !track) {
      setTabMaxOffset(0);
      return;
    }
    const maxOffset = Math.max(0, track.scrollWidth - viewport.clientWidth);
    setTabMaxOffset(maxOffset);
    setTabOffset((prev) => Math.min(Math.max(prev, 0), maxOffset));
  }, []);
  React.useEffect(() => {
    const handleMove = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || !tabStrip) return;
      const strip = tabStripRef.current;
      const stripRect = strip?.getBoundingClientRect();
      const inStrip = stripRect
        ? event.clientY >= stripRect.top && event.clientY <= stripRect.bottom
        : false;
      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;
      const dist = Math.hypot(dx, dy);

      if (!drag.active && dist > 6) {
        drag.active = true;
        drag.mode = inStrip ? "reorder" : "detach";
        if (drag.mode === "detach") {
          tabStrip.onDetachAt
            ? tabStrip.onDetachAt(drag.tabId, {
                x: event.clientX,
                y: event.clientY,
              })
            : tabStrip.onDetach?.(drag.tabId);
        }
      }

      if (!drag.active) return;

      if (drag.mode === "detach") return;

      if (!inStrip) {
        drag.mode = "detach";
        tabStrip.onDetachAt
          ? tabStrip.onDetachAt(drag.tabId, {
              x: event.clientX,
              y: event.clientY,
            })
          : tabStrip.onDetach?.(drag.tabId);
        tabInsertIndexRef.current = null;
        setTabInsertLeft(null);
        return;
      }

      if (!stripRect) return;
      const rects = tabStrip.tabs
        .map((id: string) => tabButtonRefs.current.get(id)?.getBoundingClientRect() ?? null)
        .filter((rect): rect is DOMRect => Boolean(rect));

      if (rects.length === 0) return;

      let nextIndex = rects.length;
      let nextLeft = rects[rects.length - 1].right - stripRect.left;
      for (let i = 0; i < rects.length; i += 1) {
        const rect = rects[i];
        const mid = rect.left + rect.width / 2;
        if (event.clientX < mid) {
          nextIndex = i;
          nextLeft = rect.left - stripRect.left;
          break;
        }
      }
      tabInsertIndexRef.current = nextIndex;
      setTabInsertLeft(nextLeft);
    };

    const handleUp = () => {
      const drag = dragRef.current;
      if (drag?.active && drag.mode === "reorder" && tabInsertIndexRef.current !== null) {
        tabStrip?.onMove?.(drag.tabId, tabInsertIndexRef.current);
      }
      dragRef.current = null;
      tabInsertIndexRef.current = null;
      setTabInsertLeft(null);
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [tabStrip]);

  React.useEffect(() => {
    updateTabMetrics();
  }, [tabStrip?.tabs?.length, updateTabMetrics]);

  React.useEffect(() => {
    const viewport = tabViewportRef.current;
    const track = tabTrackRef.current;
    if (!viewport || !track || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => updateTabMetrics());
    observer.observe(viewport);
    observer.observe(track);
    return () => observer.disconnect();
  }, [updateTabMetrics, tabStrip?.tabs?.length]);

  React.useEffect(() => {
    let cancelled = false;
    if (!scriptUrl) return;
    ensureUmdBundle({ scriptUrl, cssUrl })
      .then(() => {
        if (!cancelled) setLoadError(null);
      })
      .catch((err) => {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : String(err));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [scriptUrl, cssUrl]);

  return (
    <ZenDraggablePanel
      id={panelId}
      title={title}
      titleIcon={titleIcon}
      isOpen={true}
      onClose={onClose}
      onMinimize={onMinimize}
      zIndex={zIndex}
      defaultPosition={defaultPosition}
      defaultSize={defaultSize}
      position={position}
      size={size}
      onPositionChange={onPositionChange}
      onSizeChange={onSizeChange}
      pinned={pinned}
      onPinChange={onPinChange}
      isActive={isActive}
      additionalSettingsItems={additionalSettingsItems}
      className="embeddr-draggable-panel"
    >
      {loadError ? (
        <div className="p-3 text-xs text-destructive">{loadError}</div>
      ) : (
        <div className="h-full w-full min-h-0 overflow-hidden embeddr-plugin-scope @container [container-name:panel] relative">
          {tabStrip && tabStrip.tabs?.length > 1 && (
            <div
              ref={tabStripRef}
              className="absolute top-0 inset-x-0 h-7.5 flex items-center gap-1 px-1.5 border-b border-border bg-background/80 backdrop-blur z-10"
            >
              <button
                className={`h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground ${
                  tabOffset <= 0 ? "opacity-30 pointer-events-none" : ""
                }`}
                onClick={() =>
                  setTabOffset((prev) => {
                    const viewportWidth = tabViewportRef.current?.clientWidth;
                    const step = viewportWidth ? Math.max(80, viewportWidth - 60) : 140;
                    return Math.max(0, prev - step);
                  })
                }
                aria-label="Scroll tabs left"
              >
                ‹
              </button>
              <div ref={tabViewportRef} className="flex-1 overflow-hidden">
                <div
                  ref={tabTrackRef}
                  className="flex items-center gap-1 whitespace-nowrap transition-transform"
                  style={{ transform: `translateX(-${tabOffset}px)` }}
                >
                  {tabStrip.tabs.map((tabId: string) => (
                    <button
                      key={tabId}
                      ref={(node) => {
                        if (node) tabButtonRefs.current.set(tabId, node);
                        else tabButtonRefs.current.delete(tabId);
                      }}
                      className={`px-2 py-1 text-[11px] rounded border inline-flex items-center gap-1 ${
                        tabId === tabStrip.activeTabId
                          ? "bg-primary/10 border-primary/40 text-foreground"
                          : "border-transparent text-muted-foreground hover:bg-muted/60"
                      }`}
                      onClick={() => tabStrip.onSelect?.(tabId)}
                      onPointerDown={(event) => {
                        dragRef.current = {
                          tabId,
                          startX: event.clientX,
                          startY: event.clientY,
                          active: false,
                        };
                      }}
                      onContextMenu={(event) => {
                        event.preventDefault();
                        tabStrip.onDetachAt
                          ? tabStrip.onDetachAt(tabId, {
                              x: event.clientX,
                              y: event.clientY,
                            })
                          : tabStrip.onDetach?.(tabId);
                      }}
                      title="Right-click to detach"
                    >
                      <span className="max-w-24 truncate">{tabStrip.titles?.[tabId] || tabId}</span>
                    </button>
                  ))}
                </div>
              </div>
              <button
                className={`h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground ${
                  tabOffset >= tabMaxOffset ? "opacity-30 pointer-events-none" : ""
                }`}
                onClick={() =>
                  setTabOffset((prev) => {
                    const viewportWidth = tabViewportRef.current?.clientWidth;
                    const step = viewportWidth ? Math.max(80, viewportWidth - 60) : 140;
                    const next = prev + step;
                    return next >= tabMaxOffset - 4 ? tabMaxOffset : Math.min(tabMaxOffset, next);
                  })
                }
                aria-label="Scroll tabs right"
              >
                ›
              </button>
              {tabInsertLeft !== null && (
                <div
                  className="absolute top-1 bottom-1 w-px bg-primary/70"
                  style={{ left: tabInsertLeft }}
                />
              )}
            </div>
          )}
          <div
            className="h-full"
            style={{
              paddingTop:
                tabStrip && tabStrip.tabs && tabStrip.tabs.length > 1 ? "30px" : undefined,
            }}
          >
            <EmbeddrProvider api={api}>
              <PluginContent
                key={tabStrip?.activeTabId || panelId}
                pluginId={pluginId}
                componentName={componentName}
                api={api}
                windowId={(tabStrip?.activeTabId as string) || panelId}
                pluginProps={pluginProps}
              />
            </EmbeddrProvider>
          </div>
        </div>
      )}
    </ZenDraggablePanel>
  );
}
