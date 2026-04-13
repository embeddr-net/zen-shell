/**
 * Shared Finder types for the Zen command palette / Lotus Finder.
 *
 * Used by both embeddr-frontend (LotusFinder) and embeddr-trellis (TrellisFinder).
 * Each app provides its own local items and dispatch handler via ZenFinderConfig.
 */

// ---------------------------------------------------------------------------
// Item kinds
// ---------------------------------------------------------------------------

/** Core item kinds. Apps can extend with string literals. */
export type ZenFinderItemKind =
  | "command"
  | "panel"
  | "action"
  | "nav"
  | "artifact"
  | "resource"
  | "feature"
  | "message"
  | "lotus-action"
  | "lotus-nav"
  | (string & {});

export type ZenFinderItemSource = "local" | "server";

// ---------------------------------------------------------------------------
// Finder items
// ---------------------------------------------------------------------------

export interface ZenFinderItem {
  id: string;
  kind: ZenFinderItemKind;
  source: ZenFinderItemSource;
  title: string;
  subtitle?: string;
  description?: string;
  score?: number;
  icon?: string;
  data?: Record<string, any>;
}

// ---------------------------------------------------------------------------
// Finder mode
// ---------------------------------------------------------------------------

export type ZenFinderMode = "search" | "lotus";

// ---------------------------------------------------------------------------
// Kind filter options
// ---------------------------------------------------------------------------

export interface ZenFinderKindOption {
  value: string;
  label: string;
  icon?: string;
}

export const DEFAULT_KIND_OPTIONS: ZenFinderKindOption[] = [
  { value: "panel", label: "Panels", icon: "Cpu" },
  { value: "action", label: "Actions", icon: "Zap" },
  { value: "nav", label: "Navigation", icon: "Compass" },
  { value: "artifact", label: "Artifacts", icon: "Image" },
  { value: "resource", label: "Resources", icon: "Globe" },
  { value: "feature", label: "Features", icon: "Sparkles" },
  { value: "command", label: "Commands", icon: "Terminal" },
];

// ---------------------------------------------------------------------------
// Parsed query
// ---------------------------------------------------------------------------

export interface ZenFinderParsedQuery {
  raw: string;
  text: string;
  shebang: string | null;
  shebangArgs: string;
  tags: Array<{ key: string; value?: string }>;
}

// ---------------------------------------------------------------------------
// Chat message (for lotus mode)
// ---------------------------------------------------------------------------

export interface ZenFinderMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  suggestions?: Array<{ label: string; action?: string; capId?: string }>;
}

// ---------------------------------------------------------------------------
// Config — each app provides this to customize the Finder
// ---------------------------------------------------------------------------

export interface ZenFinderShebangConfig {
  provider: string;
  kind?: string;
}

export interface ZenFinderConfig {
  /** App-specific local items (commands, nav, panels) */
  localItems: ZenFinderItem[];

  /** Enable semantic artifact search via search.text */
  enableSearch?: boolean;

  /** Enable Lotus chat mode */
  enableChat?: boolean;

  /** Shebang → provider mapping (e.g. { stash: "nynxz-stash.search" }) */
  shebangs?: Record<string, string | ZenFinderShebangConfig>;

  /** Default search provider (defaults to "search.text") */
  textProvider?: string;

  /** Kind filter options (defaults to DEFAULT_KIND_OPTIONS) */
  kindOptions?: ZenFinderKindOption[];

  /** Called when user activates an item (Enter/click) */
  onDispatch: (item: ZenFinderItem) => void;

  /** Optional: called when finder opens */
  onOpen?: () => void;

  /** Optional: called when finder closes */
  onClose?: () => void;
}
