/**
 * Finder query parsing — shared between all Embeddr frontends.
 *
 * Supports:
 *   - Shebangs:  !stash sunglasses  → routes to configured provider
 *   - Tags:      @type:image @kind:scenes → metadata filters
 *   - Sort:      $date $name:desc → sort operators
 *   - Plain text: everything else → search query
 */

import type { ZenFinderParsedQuery } from "./finder-types";

/**
 * Parse a raw finder query string into structured parts.
 *
 * Examples:
 *   "sunglasses"            → { text: "sunglasses", shebang: null, tags: [] }
 *   "!stash performers"     → { text: "performers", shebang: "stash", tags: [] }
 *   "@type:image landscape" → { text: "landscape", tags: [{ key: "type", value: "image" }] }
 *   "$date"                 → { text: "", tags: [{ key: "sort", value: "date" }] }
 */
export function parseFinderQuery(raw: string): ZenFinderParsedQuery {
  const trimmed = raw.trim();
  let shebang: string | null = null;
  let shebangArgs = "";
  let rest = trimmed;

  // Parse shebang (!provider args)
  if (trimmed.startsWith("!")) {
    const match = /^!([^\s]+)\s*(.*)$/.exec(trimmed);
    if (match) {
      shebang = match[1].toLowerCase();
      shebangArgs = match[2] || "";
      rest = shebangArgs;
    }
  }

  // Parse tags (@key:value) and sort operators ($key:value)
  const tags: Array<{ key: string; value?: string }> = [];
  const tokens = rest.split(/\s+/).filter(Boolean);
  const remaining: string[] = [];

  for (const token of tokens) {
    if (token.startsWith("@") && token.length > 1) {
      const tag = token.slice(1);
      const parts = tag.split(/[:=]/, 2);
      const key = (parts[0] || "").trim().toLowerCase();
      const value = (parts[1] || "").trim();
      if (key) tags.push({ key, value: value || undefined });
    } else if (token.startsWith("$") && token.length > 1) {
      const tag = token.slice(1);
      const parts = tag.split(/[:=]/, 2);
      const rawKey = (parts[0] || "").trim().toLowerCase();
      const rawValue = (parts[1] || "").trim();
      if (rawKey) {
        if (rawValue) tags.push({ key: rawKey, value: rawValue });
        else tags.push({ key: "sort", value: rawKey });
      }
    } else {
      remaining.push(token);
    }
  }

  return {
    raw,
    text: remaining.join(" ").trim(),
    shebang,
    shebangArgs,
    tags,
  };
}

/**
 * Extract a tag value by checking multiple key names.
 * Returns the first match.
 */
export function getTagValue(
  tags: Array<{ key: string; value?: string }>,
  keys: string[],
): string | undefined {
  return tags.find((t) => keys.includes(t.key))?.value;
}

/**
 * Reserved tag keys that are consumed by the Finder itself
 * (not passed through to search providers).
 */
export const RESERVED_TAG_KEYS = new Set([
  "type",
  "type_name",
  "type_prefix",
  "prefix",
  "id",
  "artifact",
  "kind",
  "sort",
  "order",
  "dir",
  "direction",
]);
