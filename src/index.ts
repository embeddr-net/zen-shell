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
export {
  loadExternalPlugins,
  createVirtualPluginDefinition,
} from "./plugins/loader";
export type { PluginManifest, PluginLoaderAdapter } from "./plugins/loader";
export { UmdPanelHost } from "./panels/umd-panel-host";
export type { UmdPanelHostProps } from "./panels/umd-panel-host";
export { ZenDraggablePanel } from "./panels/zen-draggable-panel";
export { ZenUmdPanelManager } from "./panels/zen-panel-manager";
export type {
  ZenInspection,
  ZenFrontendComponent,
} from "./panels/zen-panel-manager";
export { ZenPanelManagerCore } from "./panels/zen-panel-manager-core";
export type {
  ZenPanelManagerCoreProps,
  ZenWindowRendererProps,
  ZenWindowStateLike,
} from "./panels/zen-panel-manager-core";
export { ZenPanelManager } from "./panels/zen-default-panel-manager";
export type { ZenPanelManagerProps } from "./panels/zen-default-panel-manager";
export { ZenShell } from "./shell/ZenShell";
export type { ZenShellProps } from "./shell/ZenShell";
export { useZenWindowStore } from "./windows/window-store";
export type {
  WindowState,
  PanelConstraints,
  PanelConstraintInsets,
} from "./windows/window-store";
export {
  ZenStoreProvider,
  useZenStores,
  useZenGlobalStore,
  useZenPanelStore,
  useZenGlobalStoreContext,
  useZenPanelStoreContext,
  useZenWindowStoreContext,
} from "./stores";
export { CoreUIEventBridge } from "./events/core-ui-event-bridge";
export type { ZenGlobalState, ZenPanelState, ZenStoreBundle } from "./stores";
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
  getDropZoneFromPointer,
  getTileDragData,
  isTileDrag,
  pruneTreeEntries,
  setTileDragData,
  updateNodeById,
} from "./layouts/tiling";
export type { TileDragPayload, TileDropZone, TileNode } from "./layouts/tiling";
export type {
  EmbeddrAPI,
  PluginDefinition,
  EmbeddrMessage,
} from "@embeddr/react-ui/types";
export { EmbeddrProvider, PluginContext } from "@embeddr/react-ui/context";

// --- New shared infrastructure ---
export {
  ZenWebSocketProvider,
  useZenWebSocket,
} from "./providers/websocket-provider";
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
  PluginComponentEntry,
} from "./runtime/plugin-runtime";

export {
  PluginManifestProvider,
  usePluginManifestContext,
} from "./context/PluginManifestContext";

export { ClientPanel } from "./components/ClientPanel";
export { EmbeddrIdentity } from "./components/EmbeddrIdentity";
export type { IdentityInfo } from "./components/EmbeddrIdentity";
