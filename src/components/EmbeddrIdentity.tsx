import { useCallback, useEffect, useState } from "react";
import { Badge, useOptionalEmbeddrAPI } from "@embeddr/react-ui";

export interface IdentityInfo {
  instance_name: string;
  user: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
    is_admin: boolean;
  } | null;
  operator: {
    name: string;
    display_name: string | null;
    is_root: boolean;
  } | null;
}

interface EmbeddrIdentityProps {
  /** Override the API instance (defaults to context) */
  api?: any;
  /**
   * Pre-fetched identity info — skip the fetch and render directly.
   * Use this in standalone apps (Sisyphus, Sprout) that already have
   * the profile data from their own connection flow.
   */
  identity?: IdentityInfo | null;
  /** Compact mode — single line */
  compact?: boolean;
  /** Additional CSS class */
  className?: string;
}

/**
 * Shared identity badge showing the logged-in user, operator, and instance.
 * Drop this into any plugin panel to show who's connected.
 *
 * Usage:
 *   <EmbeddrIdentity />
 *   <EmbeddrIdentity compact />
 */
export function EmbeddrIdentity({
  api: apiProp,
  identity: identityProp,
  compact = false,
  className = "",
}: EmbeddrIdentityProps) {
  const contextApi = useOptionalEmbeddrAPI();
  const api = apiProp || contextApi;

  const [info, setInfo] = useState<IdentityInfo | null>(identityProp ?? null);
  const [loading, setLoading] = useState(!identityProp);

  const fetchIdentity = useCallback(async () => {
    if (identityProp) {
      setInfo(identityProp);
      setLoading(false);
      return;
    }
    if (!api) {
      setLoading(false);
      return;
    }

    const backendUrl = api.utils?.backendUrl || "";
    const apiKey = api.utils?.getApiKey?.();
    if (!backendUrl) {
      setLoading(false);
      return;
    }

    const headers: Record<string, string> = {};
    if (apiKey) headers["X-API-Key"] = apiKey;

    try {
      // Fetch whoami + public info in parallel
      const [whoamiRes, publicRes] = await Promise.all([
        fetch(`${backendUrl}/api/security/whoami`, { headers, credentials: "include" }),
        fetch(`${backendUrl}/api/system/public`, { credentials: "include" }),
      ]);

      let user = null;
      let operator = null;
      if (whoamiRes.ok) {
        const data = await whoamiRes.json();
        user = data.user || null;
        operator = data.operator || null;
      }

      let instanceName = "Embeddr";
      if (publicRes.ok) {
        const data = await publicRes.json();
        instanceName = data.instance?.name || instanceName;
      }

      setInfo({ instance_name: instanceName, user, operator });
    } catch {
      setInfo(null);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    fetchIdentity();
  }, [fetchIdentity]);

  if (loading) {
    return (
      <div className={`text-xs text-muted-foreground ${className}`}>
        Loading...
      </div>
    );
  }

  if (!info || !info.user) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center shrink-0">
          <span className="text-[9px] font-medium text-muted-foreground">?</span>
        </div>
        <span className="text-xs text-muted-foreground">Not authenticated</span>
      </div>
    );
  }

  const displayName = info.user.display_name || info.user.username;
  const initials = displayName.slice(0, 2).toUpperCase();
  const operatorLabel =
    info.operator?.display_name || info.operator?.name || "";

  if (compact) {
    return (
      <div className={`flex items-center gap-2 min-w-0 ${className}`}>
        {info.user.avatar_url ? (
          <img
            src={info.user.avatar_url}
            alt=""
            className="h-5 w-5 rounded-full shrink-0 object-cover"
          />
        ) : (
          <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <span className="text-[8px] font-medium text-primary">{initials}</span>
          </div>
        )}
        <span className="text-xs truncate">{displayName}</span>
        {operatorLabel && (
          <span className="text-[10px] text-muted-foreground truncate">
            {operatorLabel}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {info.user.avatar_url ? (
        <img
          src={info.user.avatar_url}
          alt=""
          className="h-8 w-8 rounded-full shrink-0 object-cover"
        />
      ) : (
        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <span className="text-[10px] font-semibold text-primary">{initials}</span>
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium truncate">{displayName}</span>
          {info.user.is_admin && (
            <Badge variant="outline" className="text-[8px] px-1 py-0 h-3.5">
              admin
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
          {operatorLabel && <span className="truncate">{operatorLabel}</span>}
          {operatorLabel && <span>&middot;</span>}
          <span className="truncate">{info.instance_name}</span>
        </div>
      </div>
    </div>
  );
}
