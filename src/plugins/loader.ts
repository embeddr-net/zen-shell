import React from "react";
import type { PluginDefinition } from "@embeddr/react-ui/types";
import * as Icons from "lucide-react";
import { DynamicPluginComponent } from "./dynamic-loader";
import { ensureUmdBundle } from "../runtime/umd-loader";
import { registerPlugin, registerPlugins, usePluginRegistry } from "./registry";

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

  for (const manifest of manifests) {
    const hasFrontendRuntime =
      Boolean(manifest.frontend_components?.length) ||
      Boolean(manifest.frontend_actions?.length) ||
      Boolean(manifest.panels?.length) ||
      Boolean(manifest.pages?.length) ||
      Boolean(manifest.widgets?.length) ||
      Boolean(manifest.docks?.length);

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
