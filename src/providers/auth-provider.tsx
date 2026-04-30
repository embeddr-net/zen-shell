/**
 * AuthProvider — shared auth state for any Embeddr frontend.
 *
 * On mount, checks the server's auth mode and current session.
 * Provides login/logout/bootstrap functions and current user/operator info.
 * Works in both "open" mode (always authenticated) and "db" mode (session required).
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useZenClient } from "../client/zen-client-context";

export interface AuthUser {
  id: string;
  username: string;
  displayName?: string;
  avatarUrl?: string;
  isAdmin: boolean;
}

export interface AuthOperator {
  id: string;
  name: string;
  displayName?: string;
  isRoot: boolean;
}

export type AuthMode = "open" | "db" | "single" | "multi";

export interface AuthState {
  /** Whether auth state has been loaded from the server */
  ready: boolean;
  /** Current auth mode */
  authMode: AuthMode;
  /** Whether auth is enforced (non-open mode) */
  authEnabled: boolean;
  /** Whether the current session is authenticated */
  isAuthenticated: boolean;
  /** Whether bootstrap is needed (db mode, no users yet) */
  needsBootstrap: boolean;
  /** Current user (null if not authenticated) */
  user: AuthUser | null;
  /** Current operator (null if not authenticated) */
  operator: AuthOperator | null;
  /** Current permissions */
  permissions: Array<string>;
  /** Error from last auth operation */
  error: string | null;
  /** Loading state for auth operations */
  loading: boolean;

  /** Login with username and password (db mode) */
  login: (username: string, password: string) => Promise<boolean>;
  /** Logout and clear session */
  logout: () => Promise<void>;
  /** Bootstrap first admin user (db mode, no users) */
  bootstrap: (
    username: string,
    password: string,
    displayName?: string,
  ) => Promise<{ apiKey?: string }>;
  /** Refresh auth state from server */
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { backendUrl } = useZenClient();
  const [ready, setReady] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("open");
  const [authEnabled, setAuthEnabled] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [needsBootstrap, setNeedsBootstrap] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [operator, setOperator] = useState<AuthOperator | null>(null);
  const [permissions, setPermissions] = useState<Array<string>>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchJson = useCallback(
    async (path: string, options?: RequestInit) => {
      if (!backendUrl) return null;
      const res = await fetch(`${backendUrl}${path}`, {
        credentials: "include",
        ...options,
        headers: {
          "Content-Type": "application/json",
          ...(options?.headers || {}),
        },
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(body || `${res.status}`);
      }
      return res.json();
    },
    [backendUrl],
  );

  // Check auth state on mount and when backendUrl changes
  const refresh = useCallback(async () => {
    if (!backendUrl) return;
    try {
      // First check the overview (always public)
      const overview = await fetchJson("/security/overview");
      const mode = (overview?.auth_mode || "open") as AuthMode;
      const enabled = overview?.auth_enabled ?? false;
      setAuthMode(mode);
      setAuthEnabled(enabled);

      if (!enabled || mode === "open") {
        // Open mode — always authenticated
        setIsAuthenticated(true);
        setNeedsBootstrap(false);
        setUser(overview?.user || null);
        setReady(true);
        return;
      }

      // DB mode — check if we have a valid session
      try {
        const whoami = await fetchJson("/security/whoami");
        const u = whoami?.user;
        const op = whoami?.operator;
        setIsAuthenticated(true);
        setNeedsBootstrap(false);
        setUser(
          u
            ? {
                id: u.id,
                username: u.username,
                displayName: u.display_name,
                avatarUrl: u.avatar_url,
                isAdmin: u.is_admin,
              }
            : null,
        );
        setOperator(
          op
            ? {
                id: op.id,
                name: op.name,
                displayName: op.display_name,
                isRoot: op.is_root,
              }
            : null,
        );
        setPermissions(whoami?.permissions || []);
      } catch {
        // Not authenticated — check if bootstrap needed
        setIsAuthenticated(false);
        setUser(null);
        setOperator(null);
        setPermissions([]);

        // If overview didn't include a user, check if any users exist
        // A 409 on bootstrap means users exist (need login), empty means need bootstrap
        try {
          const testBootstrap = await fetch(`${backendUrl}/security/bootstrap`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: "", password: "" }),
          });
          // 400 = validation error (users may or may not exist)
          // 409 = users exist, bootstrap already done
          setNeedsBootstrap(testBootstrap.status !== 409);
        } catch {
          setNeedsBootstrap(false);
        }
      }
      setReady(true);
    } catch {
      // Server unreachable
      setReady(true);
      setIsAuthenticated(false);
    }
  }, [backendUrl, fetchJson]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = useCallback(
    async (username: string, password: string): Promise<boolean> => {
      setLoading(true);
      setError(null);
      try {
        await fetchJson("/security/login", {
          method: "POST",
          body: JSON.stringify({ username, password }),
        });
        await refresh();
        setLoading(false);
        return true;
      } catch (e: any) {
        const msg = (() => {
          try {
            return JSON.parse(e.message)?.error || e.message;
          } catch {
            return e.message;
          }
        })();
        setError(msg);
        setLoading(false);
        return false;
      }
    },
    [fetchJson, refresh],
  );

  const logout = useCallback(async () => {
    setLoading(true);
    try {
      await fetchJson("/security/logout", { method: "POST" });
    } catch {}
    setIsAuthenticated(false);
    setUser(null);
    setOperator(null);
    setPermissions([]);
    setLoading(false);
  }, [fetchJson]);

  const bootstrap = useCallback(
    async (
      username: string,
      password: string,
      displayName?: string,
    ): Promise<{ apiKey?: string }> => {
      setLoading(true);
      setError(null);
      try {
        const result = await fetchJson("/security/bootstrap", {
          method: "POST",
          body: JSON.stringify({
            username,
            password,
            display_name: displayName || username,
            confirm: true,
          }),
        });
        const apiKey = result?.api_key?.key;
        // Auto-login after bootstrap
        await login(username, password);
        setNeedsBootstrap(false);
        setLoading(false);
        return { apiKey };
      } catch (e: any) {
        const msg = (() => {
          try {
            return JSON.parse(e.message)?.error || e.message;
          } catch {
            return e.message;
          }
        })();
        setError(msg);
        setLoading(false);
        return {};
      }
    },
    [fetchJson, login],
  );

  const value = useMemo<AuthState>(
    () => ({
      ready,
      authMode,
      authEnabled,
      isAuthenticated,
      needsBootstrap,
      user,
      operator,
      permissions,
      error,
      loading,
      login,
      logout,
      bootstrap,
      refresh,
    }),
    [
      ready,
      authMode,
      authEnabled,
      isAuthenticated,
      needsBootstrap,
      user,
      operator,
      permissions,
      error,
      loading,
      login,
      logout,
      bootstrap,
      refresh,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    // Return a sensible default when not wrapped in AuthProvider
    return {
      ready: true,
      authMode: "open",
      authEnabled: false,
      isAuthenticated: true,
      needsBootstrap: false,
      user: null,
      operator: null,
      permissions: ["*"],
      error: null,
      loading: false,
      login: async () => true,
      logout: async () => {},
      bootstrap: async () => ({}),
      refresh: async () => {},
    };
  }
  return ctx;
}
