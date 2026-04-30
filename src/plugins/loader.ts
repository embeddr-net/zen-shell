import React from "react";
import type { PluginDefinition } from "@embeddr/react-ui/types";
import * as Icons from "lucide-react";
import { DynamicPluginComponent } from "./dynamic-loader";
import { ensureUmdBundle } from "../runtime/umd-loader";
import { registerPlugin, registerPlugins, usePluginRegistry } from "./registry";
import {
  registerReactiveContext,
  type ReactiveConfig,
  type ReactivePresentation,
} from "@embeddr/react-ui/lib/reactive";
import {
  registerRenderable,
  registerRenderableMeta,
  type RenderableProps,
} from "@embeddr/react-ui/lib/renderables";

type PluginComponentRegistration = NonNullable<
  PluginDefinition["components"]
>[number];
type PluginActionRegistration = NonNullable<
  PluginDefinition["actions"]
>[number];

export interface PluginManifestComponent {
  name?: string;
  label?: string;
  component?: string;
  location?: string;
  props?: Record<string, unknown>;
  icon?: string;
}

export interface PluginManifestPanel {
  id?: string;
  name?: string;
  label?: string;
  component?: string;
  props?: Record<string, unknown>;
  icon?: string;
  options?: Record<string, unknown>;
}

export interface PluginManifestPage {
  id?: string;
  name?: string;
  label?: string;
  component?: string;
  route?: string;
  props?: Record<string, unknown>;
  icon?: string;
}

export interface PluginManifestWidget {
  name?: string;
  label?: string;
  component?: string;
  slot?: string;
  props?: Record<string, unknown>;
  icon?: string;
}

export interface PluginManifestDock {
  name?: string;
  label?: string;
  component?: string;
  props?: Record<string, unknown>;
  icon?: string;
  options?: Record<string, unknown>;
}

export interface PluginManifestAction {
  name?: string;
  label?: string;
  location?: string;
  component?: string;
  props?: Record<string, unknown>;
  icon?: string;
}

export interface PluginManifestRenderable {
  id: string;
  component: string;
  thumbnail_component?: string;
  match_type?: string;
  uri_prefix?: string;
  priority?: number;
  sources?: string[];
  event_types?: string[];
  processing_types?: string[];
  done_types?: string[];
  error_types?: string[];
  artifact_id_paths?: string[];
  preview_paths?: string[];
  prefer_final_artifact_only?: boolean;
  presentation?: {
    label?: string;
    short_label?: string;
    logo_url?: string;
    tone?: "default" | "brand" | "accent" | "warning";
  };
  aliases?: string[];
}

export interface PluginManifest {
  id: string;
  name?: string;
  version?: string;
  description?: string;
  url?: string;
  intents?: Array<string>;
  frontend_components?: PluginManifestComponent[];
  frontend_actions?: PluginManifestAction[];
  panels?: PluginManifestPanel[];
  pages?: PluginManifestPage[];
  widgets?: PluginManifestWidget[];
  docks?: PluginManifestDock[];
  renderables?: PluginManifestRenderable[];
}

export interface PluginLoaderAdapter {
  list: () => Promise<PluginManifest[]>;
  resolveScriptUrl: (manifest: PluginManifest) => string;
  resolveCssUrl?: (manifest: PluginManifest) => string | null;
}

const LOCATION_MAP: Record<string, any> = {
  ZEN_PANEL: "zen-toolbox-tab",
  SIDEBAR: "zen-sidebar",
  OVERLAY: "zen-overlay",
  HEADER: "header-nav",
  PAGE: "page",
  PLUGIN_PAGE: "page",
  page: "page",
  plugin_page: "page",
  WINDOW: "window",
  COMMAND_BAR: "command-bar-widget",
  DOCK: "zen-dock",
  ZEN_DOCK: "zen-dock",
};

function normalizePanelComponents(
  panels: PluginManifestPanel[] | undefined,
): PluginManifestComponent[] {
  return (panels || []).map((p) => ({
    name: p.id || p.name,
    label: p.label,
    component: p.component,
    location: "OVERLAY",
    props: p.props || {},
    icon: p.icon,
    options: p.options,
  }));
}

function normalizePageComponents(
  pages: PluginManifestPage[] | undefined,
): PluginManifestComponent[] {
  return (pages || []).map((p) => ({
    name: p.id || p.name,
    label: p.label,
    component: p.component,
    location: "PAGE",
    props: {
      ...(p.props || {}),
      route: p.route,
    },
    icon: p.icon,
  }));
}

function normalizeWidgetComponents(
  widgets: PluginManifestWidget[] | undefined,
): PluginManifestComponent[] {
  return (widgets || []).map((w) => ({
    name: w.name,
    label: w.label,
    component: w.component,
    location: "COMMAND_BAR",
    props: {
      ...(w.props || {}),
      slot: w.slot,
    },
    icon: w.icon,
  }));
}

function normalizeDockComponents(
  docks: PluginManifestDock[] | undefined,
): PluginManifestComponent[] {
  return (docks || []).map((d) => ({
    name: d.name,
    label: d.label,
    component: d.component,
    location: "DOCK",
    props: d.props || {},
    icon: d.icon,
    options: d.options,
  }));
}

function lucideIconFromName(name?: string) {
  if (!name) return undefined;
  return (Icons as any)[name] || undefined;
}

function toComponentRegistration(
  _pluginId: string,
  comp: PluginManifestComponent,
): PluginComponentRegistration | null {
  const componentName = comp.component || comp.name;
  if (!componentName) return null;
  const label = comp.label || comp.name || componentName;
  return {
    id: comp.name || componentName,
    location:
      LOCATION_MAP[comp.location || "WINDOW"] || comp.location || "window",
    label,
    icon: lucideIconFromName(comp.icon),
    // use exportName for window spawning + toolbox rendering
    exportName: componentName,
    // keep component unset for zen-toolbox-tab/overlay; they render via DynamicPluginComponent
    component: undefined as any,
    defaultPosition: (comp as any).defaultPosition,
    defaultSize: (comp as any).defaultSize,
    options: (comp as any).options,
    props: comp.props || {},
  } as any;
}

function toActionRegistration(
  pluginId: string,
  action: PluginManifestAction,
): PluginActionRegistration | null {
  const componentName = action.component || action.name;
  const label = action.label || action.name || componentName || "Action";

  if (componentName) {
    return {
      id: action.name || componentName,
      location: (action.location || "zen-toolbox-action") as any,
      label,
      icon: lucideIconFromName(action.icon),
      component: (apiProps: any) =>
        React.createElement(DynamicPluginComponent, {
          pluginId,
          componentName,
          api: apiProps.api,
          ...(action.props || {}),
        }),
    };
  }

  return {
    id: action.name || label,
    location: (action.location || "zen-toolbox-action") as any,
    label,
    icon: lucideIconFromName(action.icon),
    handler: undefined,
  } as any;
}

function renderableToReactiveConfig(
  r: PluginManifestRenderable,
): ReactiveConfig {
  return {
    source: r.sources && r.sources.length ? r.sources : undefined,
    types: r.event_types,
    processingTypes: r.processing_types,
    doneTypes: r.done_types,
    errorTypes: r.error_types,
    artifactIdPaths: r.artifact_id_paths,
    previewPaths: r.preview_paths,
    preferFinalArtifactOnly: r.prefer_final_artifact_only,
  };
}

function renderableToPresentation(
  r: PluginManifestRenderable,
): ReactivePresentation | undefined {
  const p = r.presentation;
  if (!p) return undefined;
  return {
    label: p.label,
    shortLabel: p.short_label,
    logoUrl: p.logo_url,
    tone: p.tone,
  };
}

function registerManifestRenderables(manifest: PluginManifest): void {
  if (!manifest.renderables?.length) return;

  for (const r of manifest.renderables) {
    const config = renderableToReactiveConfig(r);
    const presentation = renderableToPresentation(r);

    const matchPrefixes = [r.uri_prefix, ...(r.aliases || [])].filter(
      (s): s is string => Boolean(s && s.length),
    );

    // Register the reactive context under each possible match key. The
    // registry's resolver iterates entries and returns the first full
    // match — ANDing type + urlPrefix on one entry would require both
    // to hit, so we split them into separate entries for OR semantics.
    if (r.match_type) {
      registerReactiveContext({
        match: { type: r.match_type },
        config,
        presentation,
      });
    }
    for (const prefix of matchPrefixes) {
      registerReactiveContext({
        match: { urlPrefix: prefix },
        config,
        presentation,
      });
    }

    // Lazy wrapper: resolves the UMD export by plugin id + component name
    // when the component is first rendered. Renderables register immediately
    // from the manifest so resolveRenderable() can find them before the UMD
    // bundle has loaded.
    const pluginId = manifest.id;
    const componentName = r.component;
    const thumbnailName = r.thumbnail_component || "";
    const LazyRenderable: React.FC<RenderableProps> = (props) =>
      React.createElement(DynamicPluginComponent, {
        pluginId,
        componentName,
        api: props.api,
        item: props.item,
        context: props.context,
      } as any);

    const LazyThumbnail: React.FC<RenderableProps> | undefined = thumbnailName
      ? (props) =>
          React.createElement(DynamicPluginComponent, {
            pluginId,
            componentName: thumbnailName,
            api: props.api,
            item: props.item,
            context: props.context,
          } as any)
      : undefined;

    // Use predicate-only matching so match_type OR any alias triggers the
    // renderable. The descriptor's top-level `type`/`urlPrefix` fields are
    // ANDed by the registry, which would miss alias URIs that don't also
    // carry the canonical type.
    registerRenderable({
      id: r.id,
      priority: r.priority ?? 50,
      match: {
        predicate: (item) => {
          if (!item) return false;
          const t = String(item.type || "");
          if (r.match_type && t === r.match_type) return true;
          const url = String(item.url || "");
          if (!url) return false;
          return matchPrefixes.some((p) => url.startsWith(p));
        },
      },
      render: LazyRenderable,
      renderThumbnail: LazyThumbnail,
    });

    registerRenderableMeta({
      id: r.id,
      label: presentation?.label,
      plugin: manifest.id,
      match: {
        type: r.match_type || undefined,
        urlPrefix: matchPrefixes[0],
      },
    });
  }
}

export function createVirtualPluginDefinition(
  manifest: PluginManifest,
): PluginDefinition {
  const normalizedComponents = [
    ...(manifest.frontend_components || []),
    ...normalizePanelComponents(manifest.panels),
    ...normalizePageComponents(manifest.pages),
    ...normalizeWidgetComponents(manifest.widgets),
    ...normalizeDockComponents(manifest.docks),
  ];
  return {
    id: manifest.id,
    name: manifest.name || manifest.id,
    version: manifest.version || "0.0.0",
    description: manifest.description || "",
    components: normalizedComponents
      .map((c) => toComponentRegistration(manifest.id, c))
      .filter(Boolean) as any,
    actions: (manifest.frontend_actions || [])
      .map((a) => toActionRegistration(manifest.id, a))
      .filter(Boolean) as any,
  };
}

export async function loadExternalPlugins({
  adapter,
  exposeGlobal = true,
  cacheBust = true,
}: {
  adapter: PluginLoaderAdapter;
  exposeGlobal?: boolean;
  cacheBust?: boolean;
}) {
  if (!adapter) {
    console.error("[ZenUI] loadExternalPlugins: Adapter is undefined");
    return [];
  }
  const manifests = await adapter.list();

  const metadataMap: Record<string, any> = {};
  manifests.forEach((m) => {
    metadataMap[m.id] = m;
  });
  usePluginRegistry.getState().setBackendMetadata(metadataMap);

  if (exposeGlobal) {
    (window as any).Embeddr = {
      ...(window as any).Embeddr,
      registerPlugin: (plugin: PluginDefinition) => {
        registerPlugin(plugin);
      },
    };
  }

  const virtualPlugins = manifests
    .filter((manifest) =>
      Boolean(manifest.frontend_components?.length) ||
      Boolean(manifest.frontend_actions?.length) ||
      Boolean(manifest.panels?.length) ||
      Boolean(manifest.pages?.length) ||
      Boolean(manifest.widgets?.length) ||
      Boolean(manifest.docks?.length),
    )
    .map((manifest) => createVirtualPluginDefinition(manifest));

  registerPlugins(virtualPlugins);

  // Register declared renderables into the reactive + renderable registries
  // *before* UMD bundles load — resolveRenderable() then finds the lazy
  // wrapper, which resolves the actual component on first render.
  for (const manifest of manifests) {
    registerManifestRenderables(manifest);
  }

  for (const manifest of manifests) {
    const hasFrontendRuntime =
      Boolean(manifest.frontend_components?.length) ||
      Boolean(manifest.frontend_actions?.length) ||
      Boolean(manifest.panels?.length) ||
      Boolean(manifest.pages?.length) ||
      Boolean(manifest.widgets?.length) ||
      Boolean(manifest.docks?.length) ||
      Boolean(manifest.renderables?.length);

    if (!hasFrontendRuntime) {
      continue;
    }

    const scriptUrlRaw = adapter.resolveScriptUrl(manifest);
    if (!scriptUrlRaw) {
      continue;
    }
    const cacheSuffix = cacheBust
      ? `${scriptUrlRaw.includes("?") ? "&" : "?"}t=${Date.now()}`
      : "";
    const scriptUrl = cacheBust
      ? `${scriptUrlRaw}${cacheSuffix}`
      : scriptUrlRaw;
    const cssUrlRaw = adapter.resolveCssUrl?.(manifest) ?? null;
    const cssUrl = cssUrlRaw
      ? cacheBust
        ? `${cssUrlRaw}${cssUrlRaw.includes("?") ? "&" : "?"}t=${Date.now()}`
        : cssUrlRaw
      : null;

    try {
      await ensureUmdBundle({ scriptUrl, cssUrl });
    } catch (err) {
      console.warn(
        `[ZenUI] Failed to load UMD bundle for plugin ${manifest.id}, skipping`,
        err,
      );
    }
  }

  return manifests;
}
