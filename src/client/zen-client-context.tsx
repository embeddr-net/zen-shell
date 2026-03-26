import React, { createContext, useContext, useMemo } from "react";

type ZenClientConfig = {
  backendUrl: string;
  apiKey?: string;
};

type ZenClientState = {
  backendUrl: string;
  apiKey?: string;
};

const defaultState: ZenClientState = {
  backendUrl: "",
  apiKey: undefined,
};

const ZenClientContext = createContext<ZenClientState>(defaultState);

export const ZenClientProvider = ({
  children,
  backendUrl,
  apiKey,
}: {
  children: React.ReactNode;
} & ZenClientConfig) => {
  const value = useMemo(
    () => ({
      backendUrl: backendUrl.trim().replace(/\/$/, ""),
      apiKey,
    }),
    [backendUrl, apiKey],
  );

  return (
    <ZenClientContext.Provider value={value}>
      {children}
    </ZenClientContext.Provider>
  );
};

export const useZenClient = () => useContext(ZenClientContext);
