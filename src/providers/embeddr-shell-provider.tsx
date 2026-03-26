/**
 * @module EmbeddrShellProvider
 *
 * All-in-one provider tree for zen-shell distros.
 * Mirrors the frontend's AppProviders stack but uses zen-shell primitives.
 *
 * Usage:
 *   <EmbeddrShellProvider backendUrl="http://localhost:8003" apiKey="...">
 *     <YourApp />
 *   </EmbeddrShellProvider>
 *
 * NOTE: This provider does NOT include QueryClientProvider.
 * Wrap your app with <QueryClientProvider> yourself, since react-query
 * is a peer dependency and the consuming app owns the QueryClient instance.
 */

import React from "react";
import { ThemeProvider } from "./theme-provider";
import { ZenWebSocketProvider } from "./websocket-provider";
import { ZenToastProvider } from "./toast-provider";
import { ZenStoreProvider } from "../stores";
import { EmbeddrProvider } from "@embeddr/react-ui/context";
import { CoreUIEventBridge } from "../events/core-ui-event-bridge";
import { ZenClientProvider } from "../client/zen-client-context";
import { createEmbeddrAPI, type EmbeddrAPIConfig } from "../client/api-factory";
import { useZenStores, useZenWindowStoreContext } from "../stores";

export type EmbeddrShellProviderProps = {
  children: React.ReactNode;
  /** Backend URL (e.g. "http://localhost:8003") */
  backendUrl: string;
  /** Optional API key */
  apiKey?: string;
  /** Theme storage key (default "embeddr-theme") */
  themeStorageKey?: string;
  /** Default theme (default "system") */
  defaultTheme?: "light" | "dark" | "system";
  /** Settings key prefix for localStorage (default "embeddr") */
  settingsPrefix?: string;
  /** Whether to render the built-in toast UI (default true) */
  enableToast?: boolean;
  /** Whether to connect WebSocket (default true) */
  enableWebSocket?: boolean;
  /** Additional EmbeddrAPI overrides */
  apiOverrides?: Partial<EmbeddrAPIConfig>;
};

/**
 * Inner component that has access to the store context for wiring windows.
 */
const ShellInner = ({
  children,
  backendUrl,
  apiKey,
  settingsPrefix,
  enableWebSocket,
}: {
  children: React.ReactNode;
  backendUrl: string;
  apiKey?: string;
  settingsPrefix: string;
  enableWebSocket: boolean;
}) => {
  const openWindow = useZenWindowStoreContext((s) => s.openWindow);
  const spawnWindow = useZenWindowStoreContext((s) => s.spawnWindow);
  const { windowStore } = useZenStores();

  const api = React.useMemo(
    () =>
      createEmbeddrAPI({
        backendUrl,
        apiKey,
        settingsPrefix,
        windows: {
          open: (id, title, componentId, props) =>
            openWindow({ id, title, componentId, props }),
          spawn: (componentId, title, props) =>
            spawnWindow(componentId, title, props),
          getState: () => windowStore.getState(),
          list: () => Object.values(windowStore.getState().windows),
        },
      }),
    [backendUrl, apiKey, settingsPrefix, openWindow, spawnWindow, windowStore],
  );

  const wsContent = enableWebSocket ? (
    <ZenWebSocketProvider backendUrl={backendUrl} apiKey={apiKey}>
      <EmbeddrProvider api={api}>
        <CoreUIEventBridge api={api} />
        {children}
      </EmbeddrProvider>
    </ZenWebSocketProvider>
  ) : (
    <EmbeddrProvider api={api}>
      <CoreUIEventBridge api={api} />
      {children}
    </EmbeddrProvider>
  );

  return wsContent;
};

export const EmbeddrShellProvider = ({
  children,
  backendUrl,
  apiKey,
  themeStorageKey = "embeddr-theme",
  defaultTheme = "system",
  settingsPrefix = "embeddr",
  enableToast = true,
  enableWebSocket = true,
}: EmbeddrShellProviderProps) => {
  return (
    <ThemeProvider storageKey={themeStorageKey} defaultTheme={defaultTheme}>
      <ZenStoreProvider>
        <ZenClientProvider backendUrl={backendUrl} apiKey={apiKey}>
          {enableToast ? (
            <ZenToastProvider>
              <ShellInner
                backendUrl={backendUrl}
                apiKey={apiKey}
                settingsPrefix={settingsPrefix}
                enableWebSocket={enableWebSocket}
              >
                {children}
              </ShellInner>
            </ZenToastProvider>
          ) : (
            <ShellInner
              backendUrl={backendUrl}
              apiKey={apiKey}
              settingsPrefix={settingsPrefix}
              enableWebSocket={enableWebSocket}
            >
              {children}
            </ShellInner>
          )}
        </ZenClientProvider>
      </ZenStoreProvider>
    </ThemeProvider>
  );
};
