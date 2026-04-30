import React, { useCallback, useEffect, useMemo, useState } from "react";
import { DraggablePanel as LibDraggablePanel } from "@embeddr/react-ui/components/embeddr";
import { cn } from "@embeddr/react-ui/lib/utils";
import { useZenPanelUiStoreContext, useZenStores, useZenWindowStoreContext } from "../stores";

// Use the Props from the library as base, but extend with Zen-specifics
interface ZenDraggablePanelProps {
  id: string;
  title: string;
  titleIcon?: React.ReactNode;
  children:
    | React.ReactNode
    | ((props: { showTitle: boolean; isActive: boolean }) => React.ReactNode);
  isOpen: boolean;
  onClose: () => void;
  defaultPosition?: { x: number; y: number };
  defaultSize?: { width: number; height: number };
  className?: string;
  minWidth?: number;
  minHeight?: number;
  hideHeader?: boolean;
  transparent?: boolean;
  onMinimize?: () => void;
  zIndex?: number;
  additionalSettingsItems?: React.ReactNode;
  pinned?: boolean;
  onPinChange?: () => void;
  isActive?: boolean;
  position?: { x: number; y: number };
  size?: { width: number; height: number };
  onPositionChange?: (pos: { x: number; y: number }) => void;
  onSizeChange?: (size: { width: number; height: number }) => void;
  onDragEnd?: () => void;
  onResizeEnd?: () => void;
  onMouseDown?: (event: React.MouseEvent) => void;
  showTitle?: boolean;
  onShowTitleChange?: (showTitle: boolean) => void;
  titlePosition?: "top" | "bottom";
  onTitlePositionChange?: (position: "top" | "bottom") => void;
  isFolded?: boolean;
  onFoldChange?: (folded: boolean) => void;
  context?: { artifactId?: string | number; imageUrl?: string };
  openRevision?: number;
  resetUiOnOpen?: boolean;
}

export function ZenDraggablePanel({
  id,
  title,
  titleIcon,
  children,
  isOpen,
  onClose,
  defaultPosition = { x: 20, y: 20 },
  defaultSize = { width: 320, height: 400 },
  className,
  minWidth = 200,
  minHeight = 40,
  hideHeader,
  transparent,
  onMinimize,
  additionalSettingsItems,
  zIndex: propZIndex,
  pinned,
  onPinChange,
  isActive: isActiveProp,
  position: controlledPosition,
  size: controlledSize,
  onPositionChange,
  onSizeChange,
  onDragEnd,
  onResizeEnd,
  onMouseDown,
  showTitle: controlledShowTitle,
  onShowTitleChange,
  titlePosition: controlledTitlePosition,
  onTitlePositionChange,
  isFolded: controlledIsFolded,
  onFoldChange,
  openRevision,
  resetUiOnOpen,
}: ZenDraggablePanelProps) {
  // --- Store access: stable function refs (no re-render) ---
  const bringToFront = useZenWindowStoreContext((s) => s.bringToFront);
  const updateWindow = useZenWindowStoreContext((s) => s.updateWindow);
  const togglePin = useZenWindowStoreContext((s) => s.togglePin);
  const openWindow = useZenWindowStoreContext((s) => s.openWindow);
  const mergeWindows = useZenWindowStoreContext((s) => s.mergeWindows);
  const setMergeHoverTarget = useZenWindowStoreContext((s) => s.setMergeHoverTarget);

  // --- Targeted subscriptions: only re-render when THIS panel's data changes ---
  const windowState = useZenWindowStoreContext((s) => s.windows[id]);
  const backdropWindowId = useZenWindowStoreContext((s) => s.backdropWindowId);
  const isMergeHoverTarget = useZenWindowStoreContext((s) => s.mergeHoverTargetId === id);
  const panelGroupingEnabled = useZenWindowStoreContext((s) => s.panelGroupingEnabled);
  // Targeted: only this panel's order index (number), not the whole array
  const orderIndex = useZenWindowStoreContext((s) => s.panelOrder.indexOf(id));
  const isLastInOrder = useZenWindowStoreContext(
    (s) => s.panelOrder[s.panelOrder.length - 1] === id,
  );
  const panelConstraints = useZenWindowStoreContext((s) => s.panelConstraints);
  const panelUiState = useZenPanelUiStoreContext((s) => s.panels[id]);
  const ensurePanelUi = useZenPanelUiStoreContext((s) => s.ensurePanelUi);
  const setPanelUi = useZenPanelUiStoreContext((s) => s.setPanelUi);

  // Get raw store for imperative access without subscribing
  const { windowStore } = useZenStores();
  const lastPositionRef = React.useRef<{ x: number; y: number } | null>(null);
  const lastSizeRef = React.useRef<{ width: number; height: number } | null>(null);
  const lastMouseRef = React.useRef<{ x: number; y: number } | null>(null);
  const isInteractingRef = React.useRef(false);
  // Initialize from controlled prop → Zustand persisted state → default
  const [localPosition, _setLocalPosition] = useState(
    controlledPosition ?? windowState?.position ?? defaultPosition,
  );
  const setLocalPosition = (pos: { x: number; y: number }) => {
    if ((window as any).__PANEL_DEBUG) {
      const prev = positionRef.current;
      const dx = Math.abs(prev.x - pos.x);
      const dy = Math.abs(prev.y - pos.y);
      if (dx > 5 || dy > 5) {
        console.warn(`[zen:${id}] setLocalPosition JUMP`, {
          from: prev,
          to: pos,
          dx,
          dy,
          interacting: isInteractingRef.current,
        });
        console.trace();
      }
    }
    _setLocalPosition(pos);
  };
  const [localSize, setLocalSize] = useState(controlledSize ?? windowState?.size ?? defaultSize);
  const positionRef = React.useRef(localPosition);
  const sizeRef = React.useRef(localSize);

  useEffect(() => {
    positionRef.current = localPosition;
  }, [localPosition]);

  useEffect(() => {
    sizeRef.current = localSize;
  }, [localSize]);
  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      lastMouseRef.current = { x: event.clientX, y: event.clientY };
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  useEffect(() => {
    // Self-register if not in store
    if (!windowState) {
      openWindow({
        id,
        title,
        componentId: "zen-draggable-panel",
        props: {
          defaultPosition,
          defaultSize,
          minWidth,
          minHeight,
        },
      });
    }
  }, [id, title, windowState, openWindow, defaultPosition, defaultSize, minWidth, minHeight]);

  useEffect(() => {
    if (!windowState) return;
    if (!windowState.position) {
      updateWindow(id, { position: defaultPosition });
    }
    if (!windowState.size) {
      updateWindow(id, { size: defaultSize });
    }
  }, [
    defaultPosition,
    defaultSize,
    id,
    updateWindow,
    windowState,
    windowState?.position,
    windowState?.size,
  ]);

  useEffect(() => {
    if (isInteractingRef.current) return;
    if (controlledPosition) {
      if ((window as any).__PANEL_DEBUG) {
        const cur = positionRef.current;
        const dx = Math.abs(cur.x - controlledPosition.x);
        const dy = Math.abs(cur.y - controlledPosition.y);
        if (dx > 2 || dy > 2)
          console.log(`[zen:${id}] SYNC controlledPosition`, {
            from: cur,
            to: controlledPosition,
            delta: { dx, dy },
          });
      }
      setLocalPosition(controlledPosition);
    }
  }, [controlledPosition, id]);

  useEffect(() => {
    if (isInteractingRef.current) return;
    if (controlledSize) {
      setLocalSize(controlledSize);
    }
  }, [controlledSize]);

  const clampPositionToViewport = useCallback(
    (nextPosition: { x: number; y: number }, nextSize: { width: number; height: number }) => {
      if (!panelConstraints.enabled || typeof window === "undefined") {
        return nextPosition;
      }

      const insets = panelConstraints.safeArea;
      const minX = insets.left;
      const minY = insets.top;
      const maxX = Math.max(minX, window.innerWidth - insets.right - nextSize.width);
      const maxY = Math.max(minY, window.innerHeight - insets.bottom - nextSize.height);

      return {
        x: Math.min(Math.max(nextPosition.x, minX), maxX),
        y: Math.min(Math.max(nextPosition.y, minY), maxY),
      };
    },
    [panelConstraints.enabled, panelConstraints.safeArea],
  );

  const clampSizeToViewport = useCallback(
    (nextSize: { width: number; height: number }, atPosition: { x: number; y: number }) => {
      if (!panelConstraints.enabled || typeof window === "undefined") {
        return nextSize;
      }

      const insets = panelConstraints.safeArea;
      const maxWidth = Math.max(minWidth, window.innerWidth - insets.right - atPosition.x);
      const maxHeight = Math.max(minHeight, window.innerHeight - insets.bottom - atPosition.y);

      return {
        width: Math.min(Math.max(nextSize.width, minWidth), maxWidth),
        height: Math.min(Math.max(nextSize.height, minHeight), maxHeight),
      };
    },
    [minHeight, minWidth, panelConstraints.enabled, panelConstraints.safeArea],
  );

  const snapPositionToEdges = useCallback(
    (nextPosition: { x: number; y: number }, nextSize: { width: number; height: number }) => {
      if (!panelConstraints.enabled || typeof window === "undefined") {
        return nextPosition;
      }

      const threshold = Math.max(0, panelConstraints.snapThreshold || 0);
      if (threshold === 0) {
        return nextPosition;
      }

      const insets = panelConstraints.safeArea;
      const rightEdge = window.innerWidth - insets.right - nextSize.width;
      const bottomEdge = window.innerHeight - insets.bottom - nextSize.height;

      let x = nextPosition.x;
      let y = nextPosition.y;

      if (Math.abs(x - insets.left) <= threshold) x = insets.left;
      if (Math.abs(rightEdge - x) <= threshold) x = rightEdge;
      if (Math.abs(y - insets.top) <= threshold) y = insets.top;
      if (Math.abs(bottomEdge - y) <= threshold) y = bottomEdge;

      return { x, y };
    },
    [panelConstraints.enabled, panelConstraints.safeArea, panelConstraints.snapThreshold],
  );

  const isPinned = pinned ?? windowState?.isPinned ?? false;
  // Use prop from parent if provided; otherwise use reactive subscription
  const isActive = isActiveProp ?? isLastInOrder;
  const isBackdrop = backdropWindowId === id;

  const effectiveShowTitle = controlledShowTitle ?? panelUiState?.showTitle ?? true;
  const effectiveTitlePosition = controlledTitlePosition ?? panelUiState?.titlePosition ?? "top";
  const effectiveIsFolded = controlledIsFolded ?? panelUiState?.isFolded ?? false;

  useEffect(() => {
    ensurePanelUi(id);
  }, [ensurePanelUi, id]);

  const handleShowTitleChange = useCallback(
    (show: boolean) => {
      if (controlledShowTitle === undefined) {
        setPanelUi(id, { showTitle: show });
      }
      onShowTitleChange?.(show);
    },
    [controlledShowTitle, id, onShowTitleChange, setPanelUi],
  );

  const handleTitlePositionChange = useCallback(
    (position: "top" | "bottom") => {
      if (controlledTitlePosition === undefined) {
        setPanelUi(id, { titlePosition: position });
      }
      onTitlePositionChange?.(position);
    },
    [controlledTitlePosition, id, onTitlePositionChange, setPanelUi],
  );

  const handleFoldChange = useCallback(
    (folded: boolean) => {
      if (controlledIsFolded === undefined) {
        setPanelUi(id, { isFolded: folded });
      }
      onFoldChange?.(folded);
    },
    [controlledIsFolded, id, onFoldChange, setPanelUi],
  );

  // Sync position changes to the store so other components (like taskbars) know where this window is.
  // We largely let LibDraggablePanel handle the actual 'moving' state internally (uncontrolled) for performance.
  const findMergeTarget = useCallback(() => {
    if (!panelGroupingEnabled) return null;
    if (windowState?.groupHostId) return null;
    if (!isInteractingRef.current) return null;
    const pointer = lastMouseRef.current;
    if (!pointer) return null;
    const currentEl = document.querySelector(`[data-panel-id="${id}"]`);
    if (!currentEl) return null;
    const centerX = pointer.x;
    const centerY = pointer.y;

    // Read windows imperatively to avoid subscription-based re-renders
    const currentWindows = windowStore.getState().windows;
    const candidates = document.querySelectorAll('[data-panel-drop-zone="tab"]');
    for (const node of Array.from(candidates)) {
      const el = node as HTMLElement;
      const targetId = el.getAttribute("data-panel-id");
      if (!targetId || targetId === id) continue;
      const target = currentWindows[targetId];
      if (!target || target.isMinimized || target.groupHostId) continue;
      const rect = el.getBoundingClientRect();
      const isInside =
        centerX >= rect.left &&
        centerX <= rect.left + rect.width &&
        centerY >= rect.top &&
        centerY <= rect.top + rect.height;
      if (isInside) return target.id;
    }
    return null;
  }, [id, panelGroupingEnabled, windowState?.groupHostId, windowStore]);

  const handlePositionChange = useCallback(
    (pos: { x: number; y: number }) => {
      const constrained = clampPositionToViewport(pos, controlledSize ?? sizeRef.current);
      if ((window as any).__PANEL_DEBUG)
        console.log(`[zen:${id}] handlePositionChange`, {
          raw: pos,
          constrained,
          interacting: isInteractingRef.current,
        });
      lastPositionRef.current = constrained;
      setLocalPosition(constrained);
      isInteractingRef.current = true;
      onPositionChange?.(constrained);
      const targetId = findMergeTarget();
      const currentHoverId = windowStore.getState().mergeHoverTargetId;
      if (targetId !== currentHoverId) setMergeHoverTarget(targetId);
    },
    [
      id,
      onPositionChange,
      findMergeTarget,
      clampPositionToViewport,
      setMergeHoverTarget,
      windowStore,
      windowState,
      controlledSize,
    ],
  );

  const handleSizeChange = useCallback(
    (s: { width: number; height: number }) => {
      // During resize, use lastPositionRef (which tracks the live position
      // being updated by handlePositionChange) instead of the stale
      // controlledPosition/positionRef which lag behind by one frame.
      const positionForClamp = isInteractingRef.current
        ? (lastPositionRef.current ?? positionRef.current)
        : (controlledPosition ?? positionRef.current);
      const constrainedSize = clampSizeToViewport(s, positionForClamp);
      lastSizeRef.current = constrainedSize;
      setLocalSize(constrainedSize);
      onSizeChange?.(constrainedSize);
    },
    [id, updateWindow, onSizeChange, clampSizeToViewport, controlledPosition, windowState],
  );

  const handleDragEnd = useCallback(() => {
    const rawPos = lastPositionRef.current;
    const sizeForClamp = controlledSize ?? sizeRef.current;
    const snappedPos = rawPos
      ? snapPositionToEdges(clampPositionToViewport(rawPos, sizeForClamp), sizeForClamp)
      : null;
    if (snappedPos) {
      setLocalPosition(snappedPos);
      onPositionChange?.(snappedPos);
    }
    const pos = snappedPos ?? rawPos;
    if (pos) {
      updateWindow(id, { position: pos });
    }
    const targetId = findMergeTarget();
    if (panelGroupingEnabled && targetId) mergeWindows(id, targetId);
    setMergeHoverTarget(null);
    isInteractingRef.current = false;
    onDragEnd?.();
  }, [
    findMergeTarget,
    id,
    mergeWindows,
    panelGroupingEnabled,
    onDragEnd,
    onPositionChange,
    clampPositionToViewport,
    snapPositionToEdges,
    controlledSize,
    setMergeHoverTarget,
    updateWindow,
  ]);

  const handleResizeEnd = useCallback(() => {
    if ((window as any).__PANEL_DEBUG)
      console.log(`[zen:${id}] handleResizeEnd`, {
        lastPos: lastPositionRef.current,
        ctrlPos: controlledPosition,
        posRef: positionRef.current,
        lastSize: lastSizeRef.current,
      });
    const currentPos = lastPositionRef.current ?? controlledPosition ?? positionRef.current;
    const size = lastSizeRef.current ? clampSizeToViewport(lastSizeRef.current, currentPos) : null;
    // Persist both size AND position — position changes during NW/N/W resize
    const updates: Record<string, any> = {};
    if (size) {
      updates.size = size;
      setLocalSize(size);
      onSizeChange?.(size);
    }
    if (currentPos) {
      updates.position = currentPos;
    }
    if (Object.keys(updates).length > 0) {
      updateWindow(id, updates);
    }
    isInteractingRef.current = false;
    onResizeEnd?.();
  }, [id, onResizeEnd, updateWindow, clampSizeToViewport, controlledPosition, onSizeChange]);

  useEffect(() => {
    if (!panelConstraints.enabled) return;

    const applyViewportClamp = () => {
      // Don't re-clamp during an active interaction (drag or resize)
      if (isInteractingRef.current) return;

      const currentSize = clampSizeToViewport(
        controlledSize ?? sizeRef.current,
        controlledPosition ?? positionRef.current,
      );
      const currentPos = clampPositionToViewport(
        controlledPosition ?? positionRef.current,
        currentSize,
      );

      const posChanged =
        currentPos.x !== positionRef.current.x || currentPos.y !== positionRef.current.y;
      const sizeChanged =
        currentSize.width !== sizeRef.current.width ||
        currentSize.height !== sizeRef.current.height;

      if (posChanged) {
        setLocalPosition(currentPos);
        onPositionChange?.(currentPos);
      }
      if (sizeChanged) {
        setLocalSize(currentSize);
        onSizeChange?.(currentSize);
      }
      if (posChanged || sizeChanged) {
        updateWindow(id, {
          position: currentPos,
          size: currentSize,
        });
      }
    };

    applyViewportClamp();
    window.addEventListener("resize", applyViewportClamp);
    return () => window.removeEventListener("resize", applyViewportClamp);
  }, [
    panelConstraints.enabled,
    clampPositionToViewport,
    clampSizeToViewport,
    controlledPosition,
    controlledSize,
    id,
    onPositionChange,
    onSizeChange,
    updateWindow,
  ]);

  // Handle render-prop children
  const resolvedChildren = useMemo(() => {
    if (typeof children === "function") {
      return children({
        showTitle: !hideHeader && effectiveShowTitle,
        isActive,
      });
    }
    return children;
  }, [children, hideHeader, effectiveShowTitle, isActive]);

  // Backdrops are specific full-screen modes
  if (isBackdrop) {
    return (
      <div
        className={cn(
          "fixed inset-0 z-10 w-full h-full bg-background/95 backdrop-blur-3xl overflow-hidden",
          className,
        )}
        style={{ pointerEvents: "auto" }}
      >
        {resolvedChildren}
      </div>
    );
  }

  // Compute zIndex from prop (parent provides it) or reactive subscription
  const computedZIndex = useMemo(() => {
    if (propZIndex != null) return propZIndex;
    const baseOrder = orderIndex === -1 ? 0 : orderIndex;
    return isPinned ? 1000 + baseOrder : 20 + baseOrder;
  }, [propZIndex, isPinned, orderIndex]);

  return (
    <LibDraggablePanel
      id={id}
      title={title}
      titleIcon={titleIcon}
      isOpen={isOpen}
      onClose={onClose}
      className={cn(className, "embeddr-draggable-panel")}
      // Defaults
      defaultPosition={defaultPosition}
      defaultSize={defaultSize}
      minWidth={minWidth}
      minHeight={minHeight}
      // Always pass position/size so LibDraggablePanel is fully controlled
      // (otherwise onPositionChange blocks internal updates but position is stale)
      position={localPosition}
      size={localSize}
      // Events
      onPositionChange={handlePositionChange}
      onSizeChange={handleSizeChange}
      onDragEnd={handleDragEnd}
      onResizeEnd={handleResizeEnd}
      // State
      zIndex={computedZIndex}
      pinned={isPinned}
      onPinChange={onPinChange || (() => togglePin(id))}
      isActive={isActive}
      mergeActive={isMergeHoverTarget}
      // Interaction
      onFocus={() => bringToFront(id)}
      onMouseDown={(e) => {
        e.stopPropagation();
        onMouseDown?.(e);
        bringToFront(id);
      }}
      // Appearance
      onMinimize={onMinimize}
      hideHeader={hideHeader}
      transparent={transparent}
      showTitle={effectiveShowTitle}
      onShowTitleChange={handleShowTitleChange}
      titlePosition={effectiveTitlePosition}
      onTitlePositionChange={handleTitlePositionChange}
      isFolded={effectiveIsFolded}
      onFoldChange={handleFoldChange}
      additionalSettingsItems={additionalSettingsItems}
      openRevision={openRevision}
      resetUiOnOpen={resetUiOnOpen}
    >
      <div
        className="h-full w-full"
        onMouseDown={(e: React.MouseEvent<HTMLDivElement>) => {
          e.stopPropagation();
          bringToFront(id);
        }}
      >
        {resolvedChildren}
      </div>
    </LibDraggablePanel>
  );
}
