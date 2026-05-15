import type { RichGameDetails } from "./richGameDetails";

export type SearchTagCatalog = {
  lowerToCanonical: Map<string, string>;
  canonicalSorted: readonly string[];
};

export function buildSearchTagCatalog(
  apps: readonly { id: { toString(): string } }[],
  peekInstalledRich: (applicationId: string) => RichGameDetails | null,
): SearchTagCatalog {
  const lowerToCanonical = new Map<string, string>();
  for (const app of apps) {
    const rich = peekInstalledRich(app.id.toString());
    if (!rich?.tags?.length) continue;
    for (const t of rich.tags) {
      const k = t.toLowerCase();
      if (!lowerToCanonical.has(k)) lowerToCanonical.set(k, t);
    }
  }
  const canonicalSorted = [...new Set(lowerToCanonical.values())].sort((a, b) =>
    a.toLowerCase().localeCompare(b.toLowerCase()),
  );
  return { lowerToCanonical, canonicalSorted };
}

export function getHashTagCompletionSuffix(
  draft: string,
  catalog: SearchTagCatalog,
): string | null {
  const m = draft.match(/#([^\s#]*)$/);
  if (!m) return null;
  const partial = m[1];
  if (!partial) return null;
  const pl = partial.toLowerCase();
  for (const tag of catalog.canonicalSorted) {
    const tl = tag.toLowerCase();
    if (!tl.startsWith(pl)) continue;
    if (tag.length <= partial.length) continue;
    return tag.slice(partial.length);
  }
  return null;
}

export function peelTrailingCommittedHashTags(
  draft: string,
  lowerToCanonical: Map<string, string>,
): { draft: string; appendedTags: string[] } {
  const appendedTags: string[] = [];
  let d = draft;
  while (true) {
    const m = d.match(/#([^\s#]+) $/);
    if (!m) break;
    const canon = lowerToCanonical.get(m[1].toLowerCase());
    if (!canon) break;
    appendedTags.push(canon);
    d = d.slice(0, -m[0].length);
  }
  return { draft: d, appendedTags };
}
