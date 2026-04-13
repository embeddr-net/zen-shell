import React from "react";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@embeddr/react-ui";

export type TileDropZone = "center" | "left" | "right" | "top" | "bottom";

export type TileNode = {
  id: string;
  instanceId?: string;
  entryKey?: string;
  split?: "vertical" | "horizontal";
  children?: [TileNode, TileNode];
  /** When false, the tile header bar is hidden. Defaults to true (visible). */
  showHeader?: boolean;
};

export type TileDragPayload = {
  entryKey: string;
  instanceId?: string;
  sourceNodeId?: string;
};

export const TILE_DND_MIME = "application/x-embeddr-tile";

export const createNodeId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `node-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
};

export const createLeaf = (
  entryKey?: string,
  id?: string,
  instanceId?: string,
): TileNode => {
  const leafId = id ?? createNodeId();
  return {
    id: leafId,
    entryKey,
    instanceId: instanceId ?? leafId,
  };
};

export const getDropZoneFromPointer = (
  event: React.DragEvent,
  threshold = 0.25,
): TileDropZone => {
  const rect = event.currentTarget.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  const w = Math.max(rect.width, 1);
  const h = Math.max(rect.height, 1);

  // Pixel distance from each edge
  const dTop = y;
  const dBottom = h - y;
  const dLeft = x;
  const dRight = w - x;

  // Edge zone size — uniform for all edges
  const edgePx = Math.max(40, Math.min(w, h) * threshold);
  const minDist = Math.min(dTop, dBottom, dLeft, dRight);

  // If not close enough to any edge → center (replace / swap)
  if (minDist > edgePx) return "center";

  // Pick the closest edge — unbiased, no priority ordering
  if (dTop <= dBottom && dTop <= dLeft && dTop <= dRight) return "top";
  if (dBottom <= dLeft && dBottom <= dRight) return "bottom";
  if (dLeft <= dRight) return "left";
  return "right";
};

export const collectEntryKeys = (node: TileNode | null): string[] => {
  if (!node) return [];
  if (!node.split || !node.children) {
    return node.entryKey ? [node.entryKey] : [];
  }
  return [
    ...collectEntryKeys(node.children[0]),
    ...collectEntryKeys(node.children[1]),
  ];
};

export const findFirstEmptyLeaf = (node: TileNode): TileNode | null => {
  if (!node.children || !node.split) {
    return node.entryKey ? null : node;
  }
  return (
    findFirstEmptyLeaf(node.children[0]) ||
    findFirstEmptyLeaf(node.children[1])
  );
};

export const findLastOccupiedLeaf = (node: TileNode): TileNode | null => {
  if (!node.children || !node.split) {
    return node.entryKey ? node : null;
  }
  return (
    findLastOccupiedLeaf(node.children[1]) ||
    findLastOccupiedLeaf(node.children[0])
  );
};

export const findNodeById = (node: TileNode, id: string): TileNode | null => {
  if (node.id === id) return node;
  if (!node.children) return null;
  return (
    findNodeById(node.children[0], id) || findNodeById(node.children[1], id)
  );
};

export const updateNodeById = (
  node: TileNode,
  id: string,
  updater: (node: TileNode) => TileNode,
): TileNode => {
  if (node.id === id) return updater(node);
  if (!node.children) return node;
  const left = updateNodeById(node.children[0], id, updater);
  const right = updateNodeById(node.children[1], id, updater);
  if (left === node.children[0] && right === node.children[1]) return node;
  return { ...node, children: [left, right] };
};

export const pruneTreeEntries = (
  node: TileNode,
  validKeys: Set<string>,
): TileNode => {
  if (!node.children || !node.split) {
    const nextEntryKey = validKeys.has(node.entryKey ?? "")
      ? node.entryKey
      : undefined;
    if (nextEntryKey === node.entryKey) return node;
    return {
      ...node,
      entryKey: nextEntryKey,
      instanceId: nextEntryKey ? (node.instanceId ?? node.id) : undefined,
    };
  }
  const left = pruneTreeEntries(node.children[0], validKeys);
  const right = pruneTreeEntries(node.children[1], validKeys);
  if (left === node.children[0] && right === node.children[1]) return node;
  return {
    ...node,
    children: [left, right],
  };
};

export const collapseEmptyNodes = (node: TileNode | null): TileNode | null => {
  if (!node) return null;
  if (!node.children || !node.split) {
    return node.entryKey ? node : null;
  }
  const left = collapseEmptyNodes(node.children[0]);
  const right = collapseEmptyNodes(node.children[1]);
  if (!left && !right) return null;
  if (left && !right) return left;
  if (!left && right) return right;
  if (left === node.children[0] && right === node.children[1]) return node;
  return { ...node, children: [left, right] as [TileNode, TileNode] };
};

export const setTileDragData = (
  event: React.DragEvent,
  payload: TileDragPayload,
) => {
  const serialized = JSON.stringify(payload);
  event.dataTransfer.setData(TILE_DND_MIME, serialized);
  event.dataTransfer.setData("text/plain", serialized);
  event.dataTransfer.effectAllowed = "move";
};

export const isTileDrag = (event: React.DragEvent) =>
  Array.from(event.dataTransfer.types || []).includes(TILE_DND_MIME);

export const getTileDragData = (
  event: React.DragEvent,
): TileDragPayload | null => {
  const raw =
    event.dataTransfer.getData(TILE_DND_MIME) ||
    event.dataTransfer.getData("text/plain");
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as TileDragPayload;
    if (!parsed.entryKey) return null;
    return parsed;
  } catch {
    return null;
  }
};

export const sendEntryToTileTree = (
  tileTree: TileNode | null,
  entryKey: string,
  instanceId?: string,
): TileNode => {
  if (!tileTree) {
    return createLeaf(entryKey, undefined, instanceId);
  }

  const emptyLeaf = findFirstEmptyLeaf(tileTree);
  if (emptyLeaf) {
    return updateNodeById(tileTree, emptyLeaf.id, (node) => ({
      ...node,
      entryKey,
      instanceId: instanceId ?? node.instanceId ?? node.id,
    }));
  }

  const lastLeaf = findLastOccupiedLeaf(tileTree);
  if (lastLeaf) {
    return updateNodeById(tileTree, lastLeaf.id, (existing) => ({
      id: createNodeId(),
      split: "horizontal" as const,
      children: [
        existing,
        createLeaf(entryKey, undefined, instanceId),
      ] as [TileNode, TileNode],
    }));
  }

  return createLeaf(entryKey, undefined, instanceId);
};

type TilingLayoutProps = {
  tree: TileNode;
  renderLeaf: (node: TileNode) => React.ReactNode;
  panelDefaultSize?: number;
  panelMinSize?: number;
  hideHandle?: boolean;
  className?: string;
  onTreeLayoutChange?: () => void;
};

type Layout = Record<string, number>;

const getLayoutStorageKey = (
  groupId: string,
  panelIds: readonly [string, string],
) => `embeddr-tiling-layout:${groupId}:${panelIds.join(":")}`;

const readPersistedLayout = (
  storageKey: string,
  panelIds: readonly [string, string],
): Layout | undefined => {
  if (typeof window === "undefined") {
    return undefined;
  }

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return undefined;

    const parsed = JSON.parse(raw) as Layout;
    const first = parsed[panelIds[0]];
    const second = parsed[panelIds[1]];

    if (typeof first !== "number" || typeof second !== "number") {
      return undefined;
    }

    return parsed;
  } catch {
    return undefined;
  }
};

function usePersistedPanelLayout(
  groupId: string,
  panelIds: readonly [string, string],
) {
  const saveTimeoutRef = React.useRef<number | null>(null);
  const storageKey = React.useMemo(
    () => getLayoutStorageKey(groupId, panelIds),
    [groupId, panelIds],
  );
  const defaultLayout = React.useMemo(
    () => readPersistedLayout(storageKey, panelIds),
    [panelIds, storageKey],
  );

  React.useEffect(() => {
    return () => {
      if (saveTimeoutRef.current !== null) {
        window.clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  const onLayoutChange = React.useCallback(
    (layout: Layout) => {
      if (typeof window === "undefined") return;

      if (saveTimeoutRef.current !== null) {
        window.clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = window.setTimeout(() => {
        try {
          window.localStorage.setItem(storageKey, JSON.stringify(layout));
        } catch {
          // Ignore storage failures and fall back to default split sizes.
        }
      }, 200);
    },
    [storageKey],
  );

  return { defaultLayout, onLayoutChange };
}

type TilingNodeViewProps = {
  node: TileNode;
  renderLeaf: (node: TileNode) => React.ReactNode;
  panelDefaultSize?: number;
  panelMinSize?: number;
  hideHandle?: boolean;
  className?: string;
  isRoot?: boolean;
  onTreeLayoutChange?: () => void;
};

function TilingSplitNodeView({
  node,
  renderLeaf,
  panelDefaultSize = 50,
  panelMinSize = 20,
  hideHandle = true,
  className,
  isRoot = false,
  onTreeLayoutChange,
}: TilingNodeViewProps) {
  const [firstChild, secondChild] = node.children as [TileNode, TileNode];
  const baseClass = "h-full w-full min-h-0 min-w-0";
  const groupClass =
    isRoot && className ? `${baseClass} ${className}` : baseClass;
  const panelIds = React.useMemo(
    () => [firstChild.id, secondChild.id] as const,
    [firstChild.id, secondChild.id],
  );
  const fallbackLayout = React.useMemo<Layout>(
    () => ({
      [panelIds[0]]: panelDefaultSize,
      [panelIds[1]]: panelDefaultSize,
    }),
    [panelDefaultSize, panelIds],
  );
  const { defaultLayout, onLayoutChange: persistLayoutChange } =
    usePersistedPanelLayout(node.id, panelIds);
  const notifyTreeLayoutChange = React.useCallback(() => {
    onTreeLayoutChange?.();
  }, [onTreeLayoutChange]);
  const onLayoutChange = React.useCallback(
    (layout: Layout) => {
      notifyTreeLayoutChange();
      persistLayoutChange(layout);
    },
    [notifyTreeLayoutChange, persistLayoutChange],
  );
  const onPanelResize = React.useCallback(() => {
    notifyTreeLayoutChange();
  }, [notifyTreeLayoutChange]);

  return (
    <ResizablePanelGroup
      key={node.id}
      id={node.id}
      orientation={node.split}
      className={groupClass}
      defaultLayout={defaultLayout}
      onLayoutChange={onLayoutChange}
    >
      <ResizablePanel
        key={panelIds[0]}
        id={panelIds[0]}
        defaultSize={
          defaultLayout?.[panelIds[0]] ?? fallbackLayout[panelIds[0]]
        }
        minSize={panelMinSize}
        onResize={onPanelResize}
        className="min-h-0 min-w-0"
      >
        <TilingNodeView
          node={firstChild}
          renderLeaf={renderLeaf}
          panelDefaultSize={panelDefaultSize}
          panelMinSize={panelMinSize}
          hideHandle={hideHandle}
          onTreeLayoutChange={onTreeLayoutChange}
        />
      </ResizablePanel>
      <ResizableHandle hideHandle={hideHandle} />
      <ResizablePanel
        key={panelIds[1]}
        id={panelIds[1]}
        defaultSize={
          defaultLayout?.[panelIds[1]] ?? fallbackLayout[panelIds[1]]
        }
        minSize={panelMinSize}
        onResize={onPanelResize}
        className="min-h-0 min-w-0"
      >
        <TilingNodeView
          node={secondChild}
          renderLeaf={renderLeaf}
          panelDefaultSize={panelDefaultSize}
          panelMinSize={panelMinSize}
          hideHandle={hideHandle}
          onTreeLayoutChange={onTreeLayoutChange}
        />
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}

function TilingNodeView(props: TilingNodeViewProps) {
  if (!props.node.split || !props.node.children) {
    return <>{props.renderLeaf(props.node)}</>;
  }

  return <TilingSplitNodeView {...props} />;
}

export const TilingLayout = ({ tree, ...props }: TilingLayoutProps) => {
  return <TilingNodeView {...props} node={tree} isRoot />;
};
