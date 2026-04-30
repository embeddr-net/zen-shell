/**
 * ZenFinderPreviewPane — ported from embeddr-frontend's LotusPreviewPane.
 * Uses zen-shell's own usePluginLogos hook.
 */
import React from "react";
import { Badge, Button, ScrollArea } from "@embeddr/react-ui/ui";
import { cn } from "@embeddr/react-ui/lib/utils";
import {
  ArrowUpDown,
  Command,
  Compass,
  CornerDownLeft,
  Cpu,
  FileText,
  Globe,
  Image as ImageIcon,
  Option,
  PlugZap,
  Sparkles,
  Terminal,
  Zap,
} from "lucide-react";
import { usePluginLogos } from "../hooks/data/usePluginLogos";
import type { ZenFinderItem } from "./finder-types";

const kindConfig: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  panel: { icon: Cpu, color: "text-blue-500", label: "Panel" },
  action: { icon: Zap, color: "text-amber-500", label: "Action" },
  "lotus-action": { icon: Zap, color: "text-amber-500", label: "Lotus Action" },
  nav: { icon: Compass, color: "text-green-500", label: "Navigation" },
  "lotus-nav": { icon: Compass, color: "text-green-500", label: "Lotus Nav" },
  artifact: { icon: ImageIcon, color: "text-purple-500", label: "Artifact" },
  resource: { icon: Globe, color: "text-cyan-500", label: "Resource" },
  command: { icon: Terminal, color: "text-orange-500", label: "Command" },
  feature: { icon: Sparkles, color: "text-pink-500", label: "Feature" },
};

interface ZenFinderPreviewPaneProps {
  item: ZenFinderItem | null;
  onRun: () => void;
  className?: string;
}

export function ZenFinderPreviewPane({ item, onRun, className }: ZenFinderPreviewPaneProps) {
  const { data: logoData } = usePluginLogos();
  const logos = logoData?.logos || {};

  if (!item) {
    return (
      <div
        className={cn(
          "h-full p-4 flex flex-col items-center justify-center text-muted-foreground gap-3",
          className,
        )}
      >
        <div className="text-3xl opacity-20">{"\u2726"}</div>
        <span className="text-sm">Select an item to preview</span>
        <div className="text-[10px] space-y-1 text-center opacity-60">
          <div>Use arrow keys to navigate</div>
          <div>Press Enter to run</div>
        </div>
      </div>
    );
  }

  const pluginId =
    (item.data?.pluginId as string) ||
    (item.data?.plugin as string) ||
    (item.data?.plugin_name as string) ||
    (item.subtitle as string) ||
    "";
  const pluginLogo = pluginId ? logos?.[pluginId] : null;

  const kind = kindConfig[item.kind] || {
    icon: PlugZap,
    color: "text-muted-foreground",
    label: item.kind,
  };
  const KindIcon = kind.icon;

  const resource = (item.data?.resource || {}) as Record<string, any>;
  const resourceType = resource?.type || item.kind;
  let previewUrl = (item.data?.preview_url as string) || resource?.preview_url;
  if (!previewUrl && resource?.content_url) previewUrl = resource.content_url;
  if (resourceType === "document") previewUrl = undefined;
  if (resourceType === "video" && previewUrl) {
    if (previewUrl.includes("/scene/") && /\/stream(\?|$)/.test(previewUrl)) {
      previewUrl = previewUrl.replace(/\/stream(\?.*)?$/, "/screenshot$1");
    }
  }
  if (resourceType === "image" && previewUrl) {
    if (previewUrl.includes("/image/") && /\/image(\?|$)/.test(previewUrl)) {
      previewUrl = previewUrl.replace(/\/image(\?.*)?$/, "/thumbnail$1");
    }
  }

  const rawScore = item.score ?? 0;
  const score =
    item.source === "server" && rawScore > 0 && rawScore <= 1 ? Math.round(rawScore * 100) : null;

  return (
    <div className={cn("h-full flex flex-col", className)}>
      <div className="p-4 border-b border-border/60">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <KindIcon className={cn("h-4 w-4 shrink-0", kind.color)} />
              <h3 className="font-semibold text-base truncate">{item.title}</h3>
            </div>
            <div className="flex items-center gap-2 mt-1.5">
              <Badge variant="outline" className="capitalize text-[10px]">
                {kind.label}
              </Badge>
              {score != null && score > 0 && (
                <Badge variant="secondary" className="text-[10px]">
                  {score}%
                </Badge>
              )}
            </div>
          </div>
          <Button onClick={onRun} variant="secondary" size="sm">
            <CornerDownLeft className="h-3.5 w-3.5 mr-1.5" />
            Run
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1 min-h-0" type="always">
        <div className="p-4 space-y-4">
          {pluginId && (
            <div className="flex items-center gap-3 rounded-lg border bg-muted/30 px-3 py-2.5">
              {pluginLogo ? (
                <img
                  src={pluginLogo}
                  alt=""
                  className="h-8 w-8 rounded-md object-contain border bg-background p-0.5"
                />
              ) : (
                <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center">
                  <PlugZap className="h-4 w-4 text-muted-foreground" />
                </div>
              )}
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{pluginId}</div>
                <div className="text-[10px] text-muted-foreground">Plugin</div>
              </div>
            </div>
          )}

          {previewUrl ? (
            <div className="border border-border/60 rounded-lg bg-muted/30 overflow-hidden">
              <img
                src={previewUrl}
                alt={item.title || "Preview"}
                className="w-full max-h-65 object-contain bg-background"
                loading="lazy"
              />
            </div>
          ) : resourceType === "document" ? (
            <div className="border border-border/60 rounded-lg bg-muted/30 flex items-center gap-2 p-4 text-muted-foreground">
              <FileText className="h-4 w-4" />
              <span className="text-xs">Document preview unavailable.</span>
            </div>
          ) : null}

          {item.description && (
            <div>
              <div className="text-[10px] text-muted-foreground/70 uppercase tracking-wide mb-1">
                Description
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                {item.description}
              </p>
            </div>
          )}

          {(item.kind === "action" || item.kind === "panel") && item.data && (
            <div className="space-y-2">
              {item.data.action && <MetaRow label="Action" value={String(item.data.action)} />}
              {item.data.componentName && (
                <MetaRow label="Component" value={String(item.data.componentName)} />
              )}
              {item.data.entryKey && <MetaRow label="Entry" value={String(item.data.entryKey)} />}
            </div>
          )}

          {item.data?.tags && Array.isArray(item.data.tags) && item.data.tags.length > 0 && (
            <div>
              <div className="text-[10px] text-muted-foreground/70 uppercase tracking-wide mb-1">
                Tags
              </div>
              <div className="flex flex-wrap gap-1">
                {item.data.tags.map((tag: string, i: number) => (
                  <Badge key={i} variant="secondary" className="text-[10px]">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <div className="pt-2 space-y-1.5">
            <div className="text-[10px] text-muted-foreground/70 uppercase tracking-wide">
              Shortcuts
            </div>
            <div className="grid grid-cols-2 gap-1 text-[10px] text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <ArrowUpDown className="h-3 w-3" /> Navigate
              </div>
              <div className="flex items-center gap-1.5">
                <CornerDownLeft className="h-3 w-3" /> Run
              </div>
              <div className="flex items-center gap-1.5">
                <Command className="h-3 w-3" /> Cmd+K
              </div>
              <div className="flex items-center gap-1.5">
                <Option className="h-3 w-3" /> Esc close
              </div>
            </div>
          </div>
        </div>
      </ScrollArea>

      <div className="px-3 py-2 border-t border-border/60 text-[10px] text-muted-foreground/50 truncate">
        {item.id}
      </div>
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-muted-foreground/70 shrink-0">{label}:</span>
      <code className="text-[11px] bg-muted rounded px-1.5 py-0.5 truncate">{value}</code>
    </div>
  );
}
