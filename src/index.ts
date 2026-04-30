export {
  ensureUmdBundle,
  ensureScript,
  ensureStylesheet,
  resolvePluginGlobal,
} from "./runtime/umd-loader";
export { DynamicPluginComponent } from "./plugins/dynamic-loader";
export { PluginErrorBoundary } from "./plugins/plugin-error-boundary";
export {
  usePluginRegistry,
  registerPlugin,
  unregisterPlugin,
  listPlugins,
} from "./plugins/registry";
export {
  getPluginActionsByLocation,
  getPluginComponentsByLocation,
} from "./plugins/context-actions";
export type { PluginRegistryState } from "./plugins/registry";
export { loadExternalPlugins, createVirtualPluginDefinition } from "./plugins/loader";
export type { PluginManifest, PluginLoaderAdapter } from "./plugins/loader";
export { UmdPanelHost } from "./panels/umd-panel-host";
export type { UmdPanelHostProps } from "./panels/umd-panel-host";
export { ZenDraggablePanel } from "./panels/zen-draggable-panel";
export { ZenUmdPanelManager } from "./panels/zen-panel-manager";
export type { ZenInspection, ZenFrontendComponent } from "./panels/zen-panel-manager";
export {
  ZenPluginPanelManager,
  type ZenPluginPanelManagerAdditionalSettingsArgs,
  type ZenPluginPanelManagerContextArgs,
  type ZenPluginPanelManagerProps,
} from "./panels/zen-plugin-panel-manager";
export { ZenPanelManagerCore } from "./panels/zen-panel-manager-core";
export type {
  ZenPanelManagerCoreProps,
  ZenWindowRendererProps,
  ZenWindowStateLike,
} from "./panels/zen-panel-manager-core";
export { ZenPanelManager } from "./panels/zen-default-panel-manager";
export type { ZenPanelManagerProps } from "./panels/zen-default-panel-manager";
export {
  collectPluginComponents,
  getEntryKey,
  resolvePluginComponent,
} from "./panels/plugin-components";
export type { PluginComponentEntry, ResolvedPluginComponent } from "./panels/plugin-components";
export { ZenShell } from "./shell/ZenShell";
export type { ZenShellProps } from "./shell/ZenShell";
export { useZenWindowStore } from "./windows/window-store";
export type { WindowState, PanelConstraints, PanelConstraintInsets } from "./windows/window-store";
export {
  ZenStoreProvider,
  useZenStores,
  useZenGlobalStore,
  useZenPanelStore,
  useZenPanelUiStore,
  useZenGlobalStoreContext,
  useZenPanelStoreContext,
  useZenPanelUiStoreContext,
  useZenWindowStoreContext,
} from "./stores";
export { CoreUIEventBridge } from "./events/core-ui-event-bridge";
export type {
  ZenGlobalState,
  ZenPanelState,
  ZenPanelUiEntry,
  ZenPanelUiState,
  ZenStoreBundle,
} from "./stores";
export { ThemeProvider } from "./providers/theme-provider";
export type { Theme } from "./providers/theme-provider";
export { useTheme } from "./hooks/use-theme";
export { useLocalStorage } from "./hooks/use-local-storage";
export { useScreenSafeArea } from "./hooks/use-screen-safe-area";
export type { UseScreenSafeAreaOptions } from "./hooks/use-screen-safe-area";
export { EventBus, globalEventBus } from "./events/event-bus";
export { registerZenGlobals } from "./runtime/zen-globals";
export { ZenClientProvider, useZenClient } from "./client/zen-client-context";
export { createPluginLoaderAdapter } from "./client/plugin-adapter";
export {
  TilingLayout,
  TILE_DND_MIME,
  collapseEmptyNodes,
  collectEntryKeys,
  createLeaf,
  createNodeId,
  findNodeById,
  findFirstEmptyLeaf,
  findLastOccupiedLeaf,
  getDropZoneFromPointer,
  getTileDragData,
  isTileDrag,
  pruneTreeEntries,
  sendEntryToTileTree,
  setTileDragData,
  updateNodeById,
} from "./layouts/tiling";
export type { TileDragPayload, TileDropZone, TileNode } from "./layouts/tiling";
export type { EmbeddrAPI, PluginDefinition, EmbeddrMessage } from "@embeddr/react-ui/types";
export { EmbeddrProvider, PluginContext } from "@embeddr/react-ui/context";

// --- New shared infrastructure ---
export { ZenWebSocketProvider, useZenWebSocket } from "./providers/websocket-provider";
export type {
  ZenWebSocketProviderProps,
  WebSocketState,
  ClientSessionInfo,
} from "./providers/websocket-provider";

export { ZenToastProvider, useZenToast } from "./providers/toast-provider";
export type {
  ZenToastProviderProps,
  ToastAPI,
  ToastItem,
  ToastType,
} from "./providers/toast-provider";

export { EmbeddrShellProvider } from "./providers/embeddr-shell-provider";
export { AuthProvider, useAuth } from "./providers/auth-provider";
export type { AuthState, AuthUser, AuthOperator, AuthMode } from "./providers/auth-provider";
export type { EmbeddrShellProviderProps } from "./providers/embeddr-shell-provider";

export { createEmbeddrAPI, createPluginScopedAPI } from "./client/api-factory";
export type { EmbeddrAPIConfig } from "./client/api-factory";

// --- Plugin manifest & runtime (moved from react-ui) ---
export {
  resolvePluginManifestUrl,
  fetchPluginManifest,
  loadPluginBundle,
} from "./runtime/plugin-manifest";
export type {
  PluginManifest as PluginManifestShape,
  PluginManifestItem,
  PluginManifestConfig,
} from "./runtime/plugin-manifest";

export {
  resolvePluginRuntime,
  listPluginPanels,
  getPluginGlobalName,
} from "./runtime/plugin-runtime";
export type {
  PluginRuntime,
  PluginComponentEntry as PluginRuntimeComponentEntry,
} from "./runtime/plugin-runtime";

export { PluginManifestProvider, usePluginManifestContext } from "./context/PluginManifestContext";

export { ClientPanel } from "./components/ClientPanel";
export { EmbeddrIdentity } from "./components/EmbeddrIdentity";
export type { IdentityInfo } from "./components/EmbeddrIdentity";

// --- Data hooks (shared React Query hooks) ---
export {
  useArtifactTypeCounts,
  usePluginLogos,
  useSystemHealth,
  useOperatorPreferences,
} from "./hooks/data";
export type { TypeTreeEntry, SystemHealth } from "./hooks/data";

// --- Type Action Registry ---
export { useTypeActionStore } from "./stores/type-action-store";
export type { TypeActionEntry, TypeActionState } from "./stores/type-action-store";

// --- Finder (shared command palette / Lotus Finder) ---
export { ZenFinder } from "./finder/ZenFinder";
export { createDefaultFinderSearch } from "./finder/zen-finder-search";
export { createFinderDispatch } from "./finder/zen-finder-dispatch";
export type { FinderDispatchConfig, FinderDispatchHandler } from "./finder/zen-finder-dispatch";
export { ZenFinderSearchBar } from "./finder/ZenFinderSearchBar";
export { ZenFinderResultsList } from "./finder/ZenFinderResultsList";
export { ZenFinderPreviewPane } from "./finder/ZenFinderPreviewPane";
export { parseFinderQuery, getTagValue, RESERVED_TAG_KEYS } from "./finder/finder-query";
export {
  norm,
  localScore,
  mergeDedup,
  filterLocalItems,
  sortFinderResults,
} from "./finder/finder-scoring";
export { DEFAULT_KIND_OPTIONS } from "./finder/finder-types";
export type {
  ZenFinderItem,
  ZenFinderItemKind,
  ZenFinderItemSource,
  ZenFinderMode,
  ZenFinderParsedQuery,
  ZenFinderMessage,
  ZenFinderConfig,
  ZenFinderShebangConfig,
  ZenFinderKindOption,
} from "./finder/finder-types";
