import React from "react";
import { usePluginRegistry } from "../plugins/registry";
import type { EmbeddrAPI } from "@embeddr/react-ui/types";

type AnyEvent = { detail?: any } | any;

type CoreUIEventBridgeProps = {
  api: EmbeddrAPI;
  onNavigate?: (to: string) => void;
};

export const CoreUIEventBridge = ({ api, onNavigate }: CoreUIEventBridgeProps) => {
  React.useEffect(() => {
    const resolveBoundComponentId = (
      bindingKey:
        | "display_media"
        | "display_lightbox"
        | "display_compare"
        | "open_artifact"
        | "open_gallery",
      payload: any,
      keywords: Array<string>,
    ): string | null => {
      const explicit = payload?.componentId ?? payload?.component_id;
      if (typeof explicit === "string" && explicit.length > 0) return explicit;

      const bindings = (api.settings?.get?.("ui.bindings", {}) || {}) as any;
      const bound = bindings?.[bindingKey];
      if (typeof bound === "string" && bound.length > 0) return bound;
      if (bound && typeof bound === "object") {
        const fromObject = bound.componentId ?? bound.component_id;
        if (typeof fromObject === "string" && fromObject.length > 0) {
          return fromObject;
        }
      }

      const plugins = usePluginRegistry.getState().plugins || {};
      let best: { componentId: string; score: number } | null = null;

      for (const [pluginId, plugin] of Object.entries(plugins)) {
        const components = (plugin as any)?.components || [];
        for (const component of components) {
          const compId = component?.id;
          const exportName = component?.exportName;
          const location = String(component?.location || "").toLowerCase();
          const label = String(component?.label || "").toLowerCase();
          const haystack = `${String(compId || "").toLowerCase()} ${String(exportName || "").toLowerCase()} ${label}`;

          let score = 0;
          for (const keyword of keywords) {
            if (haystack.includes(keyword)) score += 2;
          }
          if (location.includes("overlay") || location.includes("window")) {
            score += 1;
          }
          if (score <= 0) continue;

          const resolvedDefId = String(exportName || compId || "");
          if (!resolvedDefId) continue;
          const componentId = `${pluginId}-${resolvedDefId}`;
          if (!best || score > best.score) {
            best = { componentId, score };
          }
        }
      }

      return best?.componentId || null;
    };

    const openPanel = (event: AnyEvent) => {
      const d = event?.detail ?? event;
      const p = d?.payload ?? d;
      const componentId = p?.componentId;
      const panelId = p?.panel_id ?? p?.panelId;

      let resolvedComponentId = componentId as string | undefined;
      if (!resolvedComponentId && typeof panelId === "string") {
        const match = /^plugin:([^/]+)\/(.+)$/.exec(panelId);
        if (match) resolvedComponentId = `${match[1]}-${match[2]}`;
      }

      if (!resolvedComponentId) return;

      if (panelId) {
        api.windows.open(
          panelId,
          p?.title ?? resolvedComponentId,
          resolvedComponentId,
          p?.props ?? {},
        );
      } else {
        api.windows.spawn(resolvedComponentId, p?.title ?? resolvedComponentId, p?.props ?? {});
      }
    };

    const normalizeItems = (payload: any) => {
      if (Array.isArray(payload?.items) && payload.items.length) {
        return payload.items;
      }
      if (Array.isArray(payload?.artifactIds)) {
        return payload.artifactIds.map((id: string) => ({ artifactId: id }));
      }
      if (Array.isArray(payload?.artifact_ids)) {
        return payload.artifact_ids.map((id: string) => ({ artifactId: id }));
      }
      return [];
    };

    const openMediaFrame = (payload: any) => {
      const p = payload?.payload ?? payload ?? {};
      const items = normalizeItems(p);
      if (!items.length) return;

      const shouldSpawn =
        p.spawn === true || p.windowStrategy === "spawn" || p.instanceMode === "multiple";
      const windowId = shouldSpawn
        ? undefined
        : (p.targetWindowId ?? p.panelId ?? "core-media-frame");
      const componentId = resolveBoundComponentId("display_media", p, ["media", "frame", "viewer"]);
      if (!componentId) return;
      const props = {
        initialItems: items,
        initialMode: p.mode ?? "replace",
        initialSelectIndex: p.selectIndex ?? 0,
        intent: { mode: p.mode ?? "replace" },
        panelId: p.panelId ?? windowId,
      };

      if (windowId) {
        api.windows.open(windowId, p.title ?? "Media Frame", componentId, props);
      } else {
        api.windows.spawn(componentId, p.title ?? "Media Frame", props);
      }
    };

    const openLightbox = (payload: any) => {
      const p = payload?.payload ?? payload ?? {};
      const items = normalizeItems(p);
      if (!items.length) return;

      const shouldSpawn =
        p.spawn === true || p.windowStrategy === "spawn" || p.instanceMode === "multiple";
      const windowId = shouldSpawn ? undefined : (p.targetWindowId ?? p.panelId ?? "core-lightbox");
      const componentId = resolveBoundComponentId("display_lightbox", p, ["lightbox"]);
      if (!componentId) return;
      const props = {
        initialItems: items,
        initialMode: p.mode ?? "replace",
        initialSelectIndex: p.selectIndex ?? 0,
        showThumbnails: p.showThumbnails ?? true,
        panelId: p.panelId ?? windowId,
      };

      if (windowId) {
        api.windows.open(windowId, p.title ?? "Lightbox", componentId, props);
      } else {
        api.windows.spawn(componentId, p.title ?? "Lightbox", props);
      }
    };

    const openCompare = (payload: any) => {
      const p = payload?.payload ?? payload ?? {};
      const items = Array.isArray(p?.items)
        ? p.items.slice(0, 2)
        : Array.isArray(p?.artifact_ids)
          ? p.artifact_ids.slice(0, 2).map((id: string) => ({ artifactId: id }))
          : [p.primary, p.secondary].filter(Boolean);

      if (!items.length) return;

      const windowId = p.targetWindowId ?? p.panelId ?? "core-compare";
      const componentId = resolveBoundComponentId("display_compare", p, ["compare", "comparison"]);
      if (!componentId) return;
      const props = {
        initialItems: items,
        panelId: p.panelId ?? windowId,
      };

      if (windowId) {
        api.windows.open(windowId, p.title ?? "Compare", componentId, props);
      } else {
        api.windows.spawn(componentId, p.title ?? "Compare", props);
      }
    };

    const resolveDisplayIntent = (payload: any): "media" | "lightbox" | "compare" => {
      const p = payload?.payload ?? payload ?? {};
      const rawIntent = p.display ?? p.intent ?? p.view ?? p.kind ?? p.panel_type ?? p.target;
      const intent = String(rawIntent || "").toLowerCase();

      if (intent.includes("lightbox")) return "lightbox";
      if (intent.includes("compare")) return "compare";
      if (intent.includes("media") || intent.includes("frame")) return "media";

      const items = normalizeItems(p);
      if (items.length === 2 && (p.primary || p.secondary || p.compare)) {
        return "compare";
      }

      return "media";
    };

    const handleDisplayMedia = (event: AnyEvent) => {
      const d = event?.detail ?? event;
      const p = d?.payload ?? d;
      openMediaFrame(p);
    };

    const handleDisplayLightbox = (event: AnyEvent) => {
      const d = event?.detail ?? event;
      const p = d?.payload ?? d;
      openLightbox(p);
    };

    const handleDisplayCompare = (event: AnyEvent) => {
      const d = event?.detail ?? event;
      const p = d?.payload ?? d;
      openCompare(p);
    };

    const handleDisplayGeneric = (event: AnyEvent) => {
      const d = event?.detail ?? event;
      const p = d?.payload ?? d;
      const intent = resolveDisplayIntent(p);
      if (intent === "lightbox") {
        openLightbox(p);
        return;
      }
      if (intent === "compare") {
        openCompare(p);
        return;
      }
      openMediaFrame(p);
    };

    const handleNavigate = (event: AnyEvent) => {
      const d = event?.detail ?? event;
      const p = d?.payload ?? d;
      const to = p?.route ?? p?.to;
      if (onNavigate && typeof to === "string" && to.length > 0) {
        onNavigate(to);
      }
    };

    const handleOpenArtifact = (event: AnyEvent) => {
      const d = event?.detail ?? event;
      const p = d?.payload ?? d;
      const artifactId = p?.artifact_id ?? p?.artifactId;
      if (typeof artifactId !== "string" || artifactId.length === 0) return;

      openMediaFrame({
        title: p?.title || `Artifact ${artifactId.slice(0, 8)}`,
        artifactIds: [artifactId],
        panelId: p?.panelId,
        targetWindowId: p?.targetWindowId,
        componentId:
          p?.componentId ||
          resolveBoundComponentId("open_artifact", p, ["artifact", "detail", "media"]),
      });
    };

    const handleOpenGallery = (event: AnyEvent) => {
      const detail = event?.detail ?? event;
      const p = detail?.payload ?? detail;
      const items = p?.items ?? p?.item_ids ?? p?.itemIds;
      if (!Array.isArray(items) || !items.length) return;
      openMediaFrame({
        title: p?.title || `Gallery (${items.length} items)`,
        artifactIds: items,
        mode: "replace",
        panelId: p?.panelId,
        targetWindowId: p?.targetWindowId,
        componentId:
          p?.componentId ||
          resolveBoundComponentId("open_gallery", p, ["gallery", "media", "frame"]),
      });
    };

    const handleToast = (event: AnyEvent) => {
      const d = event?.detail ?? event;
      const p = d?.payload ?? d;
      const title = p?.title ?? "Embeddr";
      const description = p?.description ?? "";
      const variant = p?.variant ?? "default";
      const msg = description ? `${title}: ${description}` : title;

      if (!api.toast) return;
      if (variant === "destructive" || variant === "error") api.toast.error(msg);
      else if (variant === "success") api.toast.success(msg);
      else api.toast.info(msg);
    };

    const listenerSpecs: Array<readonly [string, (event: AnyEvent) => void]> = [
      ["ui:display", handleDisplayGeneric],
      ["ui.display", handleDisplayGeneric],
      ["ui:display_media", handleDisplayMedia],
      ["ui.display_media_frame", handleDisplayMedia],
      ["ui:display_lightbox", handleDisplayLightbox],
      ["ui.display_lightbox", handleDisplayLightbox],
      ["ui:display_compare", handleDisplayCompare],
      ["ui.display_compare", handleDisplayCompare],
      ["ui:open_panel", openPanel],
      ["ui.open_panel", openPanel],
      ["embeddr:ui:open_panel", openPanel],
      ["embeddr-core:ui:open_panel", openPanel],
      ["ui:open_gallery", handleOpenGallery],
      ["ui:navigate", handleNavigate],
      ["ui:toast", handleToast],
      ["llm:display_artifact", handleOpenArtifact],
      ["llm:display_gallery", handleOpenGallery],
    ];

    const subscriptions = listenerSpecs.map(([eventName, handler]) => {
      const unsubscribe = api.events?.on?.(eventName as any, handler as any);
      return [eventName, handler, unsubscribe] as const;
    });

    return () => {
      for (const [eventName, handler, unsubscribe] of subscriptions) {
        if (typeof unsubscribe === "function") unsubscribe();
        else api.events?.off?.(eventName as any, handler as any);
      }
    };
  }, [api, onNavigate]);

  return null;
};
