import { Badge, Card, ScrollArea, Separator, useOptionalEmbeddrAPI } from "@embeddr/react-ui";
import { usePluginManifestContext } from "../context/PluginManifestContext";

export function ClientPanel() {
  const api = useOptionalEmbeddrAPI();
  const { plugins, manifestUrl, isReady } = usePluginManifestContext();

  const apiKey = api?.utils?.getApiKey?.();
  const backendUrl = api?.utils?.backendUrl || "";
  const modeLabel = apiKey ? "Authenticated" : "Guest";

  return (
    <Card className="h-full w-full p-3 flex flex-col gap-3 min-h-0">
      <div className="flex items-center justify-between">
        <div className="text-lg font-semibold">Client</div>
        <Badge variant={apiKey ? "default" : "secondary"}>{modeLabel}</Badge>
      </div>
      <div className="text-xs text-muted-foreground">{backendUrl || "No backend configured"}</div>
      <Separator />
      <ScrollArea className="flex-1 min-h-0 pr-2" type="always" hideScrollbars>
        <div className="space-y-3 text-sm">
          <div>
            <div className="text-xs text-muted-foreground">Auth</div>
            <div>{apiKey ? "API key present" : "Guest session"}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Plugin Manifest</div>
            <div className="text-xs break-all text-muted-foreground">
              {manifestUrl || "Not configured"}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Plugins</div>
            <div className="text-xs text-muted-foreground">
              {isReady ? `${plugins.length} discovered` : "Loading"}
            </div>
            {plugins.length > 0 && (
              <div className="mt-2 space-y-1">
                {plugins.map((plugin) => (
                  <div
                    key={plugin.id}
                    className="flex items-center justify-between rounded-md border border-border/60 bg-secondary/20 px-2 py-1"
                  >
                    <div className="text-xs font-medium">{plugin.name || plugin.id}</div>
                    <div className="text-[10px] text-muted-foreground">{plugin.id}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </ScrollArea>
    </Card>
  );
}
