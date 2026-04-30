/**
 * Finder scoring and deduplication utilities — shared between all Embeddr frontends.
 */

import type { ZenFinderItem } from "./finder-types";

/** Normalize a string for comparison (lowercase + trim). */
export function norm(s: string): string {
  return (s || "").toLowerCase().trim();
}

/**
 * Score how well a query matches a title/subtitle.
 * Higher = better match. 0 = no match.
 *
 * Weights:
 *   100 — exact title match
 *    80 — title starts with query
 *    55 — title contains query
 *    35 — subtitle contains query
 *     0 — no match
 */
export function localScore(query: string, title: string, subtitle?: string): number {
  const q = norm(query);
  if (!q) return 0;
  const t = norm(title);
  const st = norm(subtitle || "");
  if (t === q) return 100;
  if (t.startsWith(q)) return 80;
  if (t.includes(q)) return 55;
  if (st.includes(q)) return 35;
  return 0;
}

/**
 * Merge two arrays of finder items, deduplicating by ID.
 * When both arrays have the same ID, keeps the one with the higher score.
 */
export function mergeDedup(a: Array<ZenFinderItem>, b: Array<ZenFinderItem>): Array<ZenFinderItem> {
  const map = new Map<string, ZenFinderItem>();
  for (const it of [...a, ...b]) {
    const prev = map.get(it.id);
    if (!prev) map.set(it.id, it);
    else if ((it.score ?? 0) > (prev.score ?? 0)) map.set(it.id, it);
  }
  return Array.from(map.values());
}

/**
 * Filter and score local items against a query string.
 * Returns items sorted by score (descending), limited to `maxItems`.
 */
export function filterLocalItems(
  items: Array<ZenFinderItem>,
  query: string,
  maxItems = 40,
): Array<ZenFinderItem> {
  const q = norm(query);
  if (!q) {
    return items.slice(0, maxItems).map((x) => ({ ...x, score: 0 }));
  }
  const scored = items
    .map((x) => ({ ...x, score: localScore(q, x.title, x.subtitle) }))
    .filter((x) => (x.score ?? 0) > 0)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  return scored.slice(0, maxItems);
}

/**
 * Sort merged finder results: local items boosted over server items,
 * then by score descending.
 */
export function sortFinderResults(
  items: Array<ZenFinderItem>,
  maxItems = 60,
): Array<ZenFinderItem> {
  return items
    .sort((a, b) => {
      const sa = (a.source === "local" ? 1000 : 0) + (a.score ?? 0);
      const sb = (b.source === "local" ? 1000 : 0) + (b.score ?? 0);
      return sb - sa;
    })
    .slice(0, maxItems);
}
