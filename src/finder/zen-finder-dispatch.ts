/**
 * Finder dispatch — maps item types to default actions.
 *
 * Provides "open in default application" behavior:
 *   - Resources → media frame panel
 *   - Artifacts → artifact detail panel
 *   - Panels → spawn the panel
 *   - Commands → run handler function
 *   - Navigation → app-provided routing
 *   - Lotus actions → server-side dispatch
 *
 * Apps can override any handler per kind.
 */
import type { ZenFinderItem } from "./finder-types";
import { useTypeActionStore } from "../stores/type-action-store";

/** Handler function for a specific item kind */
export type FinderDispatchHandler = (
  item: ZenFinderItem,
  api: any,
) => void | Promise<void>;

export interface FinderDispatchConfig {
  /** Override handlers per item kind. Takes priority over defaults. */
  handlers?: Partial<Record<string, FinderDispatchHandler>>;

  /** ComponentId for the media viewer panel (default: "embeddr-core-media-frame") */
  mediaFrameComponentId?: string;

  /** ComponentId for artifact detail panel (default: "embeddr-core-artifact-detail") */
  artifactDetailComponentId?: string;

  /** Called for navigation items — app provides its own routing */
  onNavigate?: (route: string) => void;

  /** Called when dispatch completes or fails — for toasts, logging, etc. */
  onResult?: (result: { success: boolean; message?: string }) => void;
}

/**
 * Resolve a preview URL from a finder item's resource data.
 * Handles stash scene screenshots, image thumbnails, etc.
 */
function resolveResourceUrls(item: ZenFinderItem) {
  const resource = (item.data?.resource || {}) as Record<string, any>;
  const resourceType =
    resource?.type || item.data?.type_name || item.kind || "web";

  let contentUrl =
    resource?.content_url || resource?.url || (item.data?.url as string);
  let previewUrl =
    (item.data?.preview_url as string) ||
    resource?.preview_url ||
    resource?.thumbnail ||
    resource?.thumb;

  // Stash scene: /stream → /screenshot for preview
  if (resourceType === "video" && previewUrl) {
    if (
      String(previewUrl).includes("/scene/") &&
      /\/stream(\?|$)/.test(String(previewUrl))
    ) {
      previewUrl = String(previewUrl).replace(
        /\/stream(\?.*)?$/,
        "/screenshot$1",
      );
    }
  }

  return { contentUrl, previewUrl, resourceType };
}

/**
 * Create a dispatch function with sane defaults and optional overrides.
 *
 * Usage:
 *   const dispatch = createFinderDispatch(api, { onNavigate: (r) => router.push(r) });
 *   dispatch(item); // Opens media frame, spawns panel, etc.
 */
export function createFinderDispatch(
  api: any,
  config: FinderDispatchConfig = {},
) {
  const {
    handlers = {},
    mediaFrameComponentId,
    artifactDetailComponentId,
    onNavigate,
    onResult,
  } = config;

  // Use the type action registry for resolving handlers
  const registry = useTypeActionStore.getState();

  return async (item: ZenFinderItem): Promise<void> => {
    const kind = item.kind;

    // Check for app-provided override first
    const override = handlers[kind];
    if (override) {
      try {
        await override(item, api);
        onResult?.({ success: true });
      } catch (e: any) {
        onResult?.({ success: false, message: e?.message });
      }
      return;
    }

    // Default handlers by kind
    try {
      switch (kind) {
        // ── Command: call handler function directly ──
        case "command": {
          const handler = item.data?.handler as
            | (() => void | Promise<void>)
            | undefined;
          if (handler) await handler();
          break;
        }

        // ── Panel: spawn as floating window ──
        case "panel": {
          const componentId = item.data?.entryKey || item.data?.componentId;
          if (componentId && api?.windows?.spawn) {
            api.windows.spawn(
              String(componentId),
              item.title,
              item.data?.props || {},
            );
          }
          break;
        }

        // ── Navigation: delegate to app ──
        case "nav": {
          const route =
            (item.data?.route as string) ||
            (item.data?.sectionId as string) ||
            "";
          if (onNavigate && route) {
            onNavigate(route);
          }
          break;
        }

        // ── Artifact: open via registry or fallback ──
        case "artifact": {
          const artifactId = item.data?.artifact_id || item.id;
          const artifactHandler =
            registry.resolve("artifact") ||
            artifactDetailComponentId ||
            "embeddr-core:artifact-detail";

          if (api?.windows?.spawn) {
            api.windows.spawn(artifactHandler, item.title, {
              artifactId: String(artifactId),
              defaultSize: { width: 500, height: 700 },
            });
          }
          break;
        }

        // ── Resource: open via registry or fallback ──
        case "resource": {
          const { contentUrl, previewUrl, resourceType } =
            resolveResourceUrls(item);
          if (!contentUrl && !previewUrl) {
            onResult?.({ success: false, message: "No resource URL available" });
            return;
          }

          const resourceHandler =
            registry.resolve(resourceType) ||
            registry.resolve("resource") ||
            mediaFrameComponentId ||
            "embeddr-core:media-frame";

          const frameId = `media-frame-${Date.now()}`;
          if (api?.windows?.open) {
            api.windows.open(frameId, item.title, resourceHandler, {
              panelId: frameId,
              initialItems: [
                {
                  id: item.data?.resource?.id || item.id,
                  url: contentUrl || previewUrl,
                  thumbUrl: previewUrl,
                  type: resourceType,
                  title: item.title,
                },
              ],
              initialMode: "replace",
              initialSelectIndex: 0,
            });
          }
          break;
        }

        // ── Lotus action: server-side dispatch ──
        case "lotus-action": {
          const resultId = item.data?.resultId || item.data?.capabilityId;
          const dispatchData =
            (item.data?.dispatchData as Record<string, unknown>) || {};
          if (resultId && api?.lotus?.dispatch) {
            const response = await api.lotus.dispatch(
              String(resultId),
              "action",
              dispatchData,
            );
            if (response?.navigate_to && onNavigate) {
              onNavigate(response.navigate_to);
            }
          }
          break;
        }

        // ── Lotus nav: open URL ──
        case "lotus-nav": {
          const url = (item.data?.url as string) || (item.data?.route as string);
          if (url) {
            if (onNavigate) {
              onNavigate(url);
            } else if (typeof window !== "undefined") {
              window.open(url, "_blank");
            }
          }
          break;
        }

        // ── Feature: treat like panel ──
        case "feature": {
          const componentId = item.data?.componentId || item.data?.entryKey;
          if (componentId && api?.windows?.spawn) {
            api.windows.spawn(String(componentId), item.title, {});
          }
          break;
        }

        default: {
          // Unknown kind — try resource behavior if it has a URL
          const { contentUrl, previewUrl, resourceType } =
            resolveResourceUrls(item);
          if (contentUrl || previewUrl) {
            const fallbackHandler =
              registry.resolve(resourceType) ||
              registry.resolve("resource") ||
              mediaFrameComponentId ||
              "embeddr-core:media-frame";
            const frameId = `media-frame-${Date.now()}`;
            if (api?.windows?.open) {
              api.windows.open(frameId, item.title, fallbackHandler, {
                panelId: frameId,
                initialItems: [
                  {
                    id: item.id,
                    url: contentUrl || previewUrl,
                    thumbUrl: previewUrl,
                    type: resourceType,
                    title: item.title,
                  },
                ],
                initialMode: "replace",
                initialSelectIndex: 0,
              });
            }
          }
          break;
        }
      }

      onResult?.({ success: true });
    } catch (e: any) {
      onResult?.({ success: false, message: e?.message });
    }
  };
}
