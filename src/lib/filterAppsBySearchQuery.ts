import { peekInstalledRichMatch } from "./richDetailsStore";

function normalizeQuery(q: string): string {
  return q.trim().toLowerCase();
}

function appHasTagInsensitive(
  app: Switch.Application,
  required: string,
): boolean {
  const rich = peekInstalledRichMatch(app.id.toString());
  if (!rich?.tags?.length) return false;
  const rl = required.toLowerCase();
  return rich.tags.some((t) => t.toLowerCase() === rl);
}

export function appMatchesSearchQuery(
  app: Switch.Application,
  queryRaw: string,
): boolean {
  const q = normalizeQuery(queryRaw);
  if (!q) return true;

  if (app.name.toLowerCase().includes(q)) return true;

  const rich = peekInstalledRichMatch(app.id.toString());
  if (!rich?.tags?.length) return false;
  for (const tag of rich.tags) {
    if (tag.toLowerCase().includes(q)) return true;
  }
  return false;
}

export function filterAppsBySearchQuery(
  apps: readonly Switch.Application[],
  queryRaw: string,
  requiredTags?: readonly string[],
): Switch.Application[] {
  const tags = requiredTags?.filter((t) => t.trim().length > 0) ?? [];
  const q = normalizeQuery(queryRaw);
  const noText = !q;

  return apps.filter((a) => {
    for (const tag of tags) {
      if (!appHasTagInsensitive(a, tag)) return false;
    }
    if (noText) return true;
    return appMatchesSearchQuery(a, queryRaw);
  });
}
