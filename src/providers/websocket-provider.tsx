import React, { createContext, useContext, useEffect, useRef } from "react";
import type { EmbeddrMessage } from "@embeddr/react-ui/types";
import {
  createEmbeddrWebSocket,
  type ClientSessionInfo,
  type EmbeddrWebSocket,
} from "@embeddr/client-typescript";
import { globalEventBus } from "../events/event-bus";

// Re-export for backwards compat
export type { ClientSessionInfo } from "@embeddr/client-typescript";

export type WebSocketState = {
  isConnected: boolean;
  lastMessage: EmbeddrMessage | null;
  myClientId: string | null;
  clients: string[];
  sessions: ClientSessionInfo[];
  refreshClients: () => Promise<void>;
};

const defaultState: WebSocketState = {
  isConnected: false,
  lastMessage: null,
  myClientId: null,
  clients: [],
  sessions: [],
  refreshClients: async () => {},
};

const WebSocketContext = createContext<WebSocketState>(defaultState);

export const useZenWebSocket = () => useContext(WebSocketContext);

export type ZenWebSocketProviderProps = {
  children: React.ReactNode;
  /** Base URL of the embeddr backend (e.g. "http://localhost:8003") */
  backendUrl: string;
  /** Optional API key for auth */
  apiKey?: string;
  /** Reconnect delay in ms (default 5000) */
  reconnectDelay?: number;
  /** Whether to auto-connect on mount (default true) */
  autoConnect?: boolean;
};

export const ZenWebSocketProvider = ({
  children,
  backendUrl,
  apiKey,
  reconnectDelay = 5000,
  autoConnect = true,
}: ZenWebSocketProviderProps) => {
  const wsClientRef = useRef<EmbeddrWebSocket | null>(null);
  const [isConnected, setIsConnected] = React.useState(false);
  const [lastMessage, setLastMessage] = React.useState<EmbeddrMessage | null>(
    null,
  );
  const [clients, setClients] = React.useState<string[]>([]);
  const [sessions, setSessions] = React.useState<ClientSessionInfo[]>([]);
  const [myClientId, setMyClientId] = React.useState<string | null>(null);

  // Create / recreate the headless WS client when config changes
  useEffect(() => {
    if (!backendUrl || !autoConnect) return;

    const client = createEmbeddrWebSocket({
      backendUrl,
      apiKey,
      reconnectDelay,
      autoConnect: false,
    });
    wsClientRef.current = client;

    const unsubConnected = client.on("connected", () => {
      setIsConnected(true);
      globalEventBus.emit("websocket:connected");
      client
        .refreshClients()
        .then((result) => {
          setClients(result.clients);
          setSessions(result.sessions);
        })
        .catch(() => undefined);
    });

    const unsubDisconnected = client.on("disconnected", () => {
      setIsConnected(false);
      globalEventBus.emit("websocket:disconnected");
    });

    const unsubMessage = client.on("message", (msg) => {
      const embeddrMsg = msg as unknown as EmbeddrMessage;
      setLastMessage(embeddrMsg);
      globalEventBus.emit("websocket:message", embeddrMsg);

      if (msg.type) {
        globalEventBus.emit(msg.type, msg.data);
        if (
          msg.type === "client_connected" ||
          msg.type === "client_disconnected"
        ) {
          client.refreshClients().then((result) => {
            setClients(result.clients);
            setSessions(result.sessions);
          });
        }
      }

      if (msg.source && msg.type) {
        globalEventBus.emit(`${msg.source}:${msg.type}`, msg.data);
        globalEventBus.emit(`source:${msg.source}:${msg.type}`, msg.data);
      }
    });

    const unsubHello = client.on("client_hello", (data) => {
      if (data.client_id) setMyClientId(data.client_id);
    });

    // Bridge outbound sends from globalEventBus → WS
    const unsubSend = globalEventBus.on(
      "websocket:send",
      (payload: unknown) => {
        if (typeof payload === "string") {
          client.send(JSON.parse(payload));
        } else if (payload && typeof payload === "object") {
          client.send(payload as Record<string, any>);
        }
      },
    );

    client.connect();

    return () => {
      unsubConnected();
      unsubDisconnected();
      unsubMessage();
      unsubHello();
      unsubSend();
      client.destroy();
      wsClientRef.current = null;
    };
  }, [backendUrl, apiKey, reconnectDelay, autoConnect]);

  const refreshClients = React.useCallback(async () => {
    const client = wsClientRef.current;
    if (!client) return;
    const result = await client.refreshClients();
    setClients(result.clients);
    setSessions(result.sessions);
  }, []);

  const value = React.useMemo<WebSocketState>(
    () => ({
      isConnected,
      lastMessage,
      myClientId,
      clients,
      sessions,
      refreshClients,
    }),
    [isConnected, lastMessage, myClientId, clients, sessions, refreshClients],
  );

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
};
