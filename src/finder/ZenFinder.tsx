/**
 * ZenFinder — shared command palette / Lotus Finder.
 *
 * Ported from embeddr-frontend's LotusFinder. Provides the same UI and
 * behavior in any app that uses zen-shell.
 */
import React from "react";
import { Dialog, DialogContent } from "@embeddr/react-ui/ui";
import { cn } from "@embeddr/react-ui/lib/utils";
import { DEFAULT_KIND_OPTIONS } from "./finder-types";
import { parseFinderQuery } from "./finder-query";
import { filterLocalItems, mergeDedup, sortFinderResults } from "./finder-scoring";
import { ZenFinderSearchBar } from "./ZenFinderSearchBar";
import { ZenFinderResultsList } from "./ZenFinderResultsList";
import { ZenFinderPreviewPane } from "./ZenFinderPreviewPane";
import type { ZenFinderConfig, ZenFinderItem, ZenFinderMode } from "./finder-types";

interface ZenFinderProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: ZenFinderConfig;

  /**
   * Called with parsed query on each keystroke (debounced).
   * App performs server search and returns results.
   */
  onSearch?: (params: {
    text: string;
    shebang: string | null;
    shebangArgs: string;
    tags: Array<{ key: string; value?: string }>;
    raw: string;
  }) => Promise<Array<ZenFinderItem>>;

  /** Optional chat send handler for lotus mode */
  onChatSend?: (message: string) => void;
  /** Chat content (for lotus mode) */
  chatContent?: React.ReactNode;
  /** Extra hint text in footer */
  footerHint?: string;
}

export function ZenFinder({
  open,
  onOpenChange,
  config,
  onSearch,
  onChatSend,
  chatContent,
  footerHint,
}: ZenFinderProps) {
  const [query, setQuery] = React.useState("");
  const [items, setItems] = React.useState<Array<ZenFinderItem>>([]);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [mode, setMode] = React.useState<ZenFinderMode>("search");
  const [hiddenKinds, setHiddenKinds] = React.useState<Set<string>>(() => {
    try {
      const stored = window.localStorage.getItem("zen-finder-hidden-kinds");
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });

  const inputRef = React.useRef<HTMLInputElement>(null);

  const toggleKind = React.useCallback((kind: string) => {
    setHiddenKinds((prev) => {
      const next = new Set(prev);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      try {
        window.localStorage.setItem("zen-finder-hidden-kinds", JSON.stringify([...next]));
      } catch {}
      return next;
    });
  }, []);

  const parsedQuery = React.useMemo(() => parseFinderQuery(query), [query]);

  const filteredLocal = React.useMemo(
    () => filterLocalItems(config.localItems, parsedQuery.text),
    [config.localItems, parsedQuery.text],
  );

  const filteredItems = React.useMemo(() => {
    if (!hiddenKinds.size) return items;
    return items.filter((it) => !hiddenKinds.has(it.kind));
  }, [items, hiddenKinds]);

  const selectedItem = React.useMemo(
    () => filteredItems.find((x) => x.id === selectedId) ?? null,
    [filteredItems, selectedId],
  );

  // Debounced server search
  React.useEffect(() => {
    if (!open) return;
    if (mode === "lotus") {
      setItems(filteredLocal);
      setSelectedId(filteredLocal[0]?.id ?? null);
      setLoading(false);
      return;
    }

    const { text, shebang, tags, shebangArgs, raw } = parsedQuery;

    if (!text && !shebang && tags.length === 0) {
      const merged = mergeDedup(filteredLocal, []);
      setItems(merged);
      setSelectedId(merged[0]?.id ?? null);
      return;
    }

    if (!onSearch) {
      setItems(filteredLocal);
      setSelectedId(filteredLocal[0]?.id ?? null);
      return;
    }

    let cancelled = false;

    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const serverItems = await onSearch({ text, shebang, shebangArgs, tags, raw });
        if (cancelled) return;

        const merged = sortFinderResults(mergeDedup(shebang ? [] : filteredLocal, serverItems));
        setItems(merged);
        setSelectedId((cur) => cur ?? merged[0]?.id ?? null);
      } catch {
        if (!cancelled) {
          setItems(filteredLocal);
          setSelectedId(filteredLocal[0]?.id ?? null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 140);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [parsedQuery, open, mode, filteredLocal, onSearch]);

  // Reset on open
  React.useEffect(() => {
    if (!open) return;
    setQuery("");
    setLoading(false);
    const merged = mergeDedup(filteredLocal, []);
    setItems(merged);
    setSelectedId(merged[0]?.id ?? null);
    config.onOpen?.();
  }, [open]);

  // Keyboard nav
  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const dir = e.key === "ArrowDown" ? 1 : -1;
      const idx = filteredItems.findIndex((x) => x.id === selectedId);
      const next = Math.max(0, Math.min(filteredItems.length - 1, idx + dir));
      setSelectedId(filteredItems[next]?.id ?? null);
    }
    if (e.key === "Escape") {
      e.preventDefault();
      onOpenChange(false);
    }
  };

  const dispatch = React.useCallback(
    (item: ZenFinderItem) => {
      onOpenChange(false);
      config.onDispatch(item);
    },
    [config.onDispatch, onOpenChange],
  );

  const kindOptions = config.kindOptions || DEFAULT_KIND_OPTIONS;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            onOpenChange(false);
          }
        }}
        className={cn(
          "max-w-4xl p-0! gap-0! overflow-hidden",
          "bg-background/70 backdrop-blur-xl border border-border/60 shadow-2xl",
        )}
        style={{ display: "flex", flexDirection: "column", height: "60vh" }}
      >
        {/* Search bar */}
        <div className="p-3 border-b border-border/60 shrink-0">
          <ZenFinderSearchBar
            value={query}
            onChange={setQuery}
            onSubmit={() => {
              if (mode === "lotus" && onChatSend) {
                onChatSend(query);
                setQuery("");
              } else if (selectedItem) {
                dispatch(selectedItem);
              }
            }}
            loading={loading}
            autoFocus
            inputRef={inputRef}
            onKeyDown={handleInputKeyDown}
            mode={mode}
            onModeChange={setMode}
            chatAvailable={config.enableChat ?? false}
            kindOptions={kindOptions}
            hiddenKinds={hiddenKinds}
            onToggleKind={toggleKind}
            searchProvider={config.textProvider}
          />
        </div>

        {/* Body */}
        {mode === "lotus" && chatContent ? (
          chatContent
        ) : (
          <div className="flex-1 min-h-0 grid grid-cols-2">
            <div className="min-h-0 border-r border-border/60 overflow-hidden">
              <ZenFinderResultsList
                items={filteredItems}
                selectedId={selectedId}
                onSelect={(it) => setSelectedId(it.id)}
                onConfirm={dispatch}
                onRequestFocusInput={() => inputRef.current?.focus()}
                keyboard={false}
              />
            </div>
            <div className="min-h-0 overflow-hidden">
              <ZenFinderPreviewPane
                item={selectedItem}
                onRun={() => selectedItem && dispatch(selectedItem)}
              />
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-3 py-2 border-t border-border/60 text-[10px] text-muted-foreground/70 flex items-center justify-between shrink-0">
          <span>
            {footerHint ||
              (mode === "lotus"
                ? "Lotus mode \u2014 conversational intelligence"
                : "Tip: !stash cats, !llm artifacts, @type:image")}
          </span>
          <span>{filteredItems.length} results</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
