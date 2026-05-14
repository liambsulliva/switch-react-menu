import { peekInstalledRichMatch } from "./richDetailsBundledCatalog";

function normalizeQuery(q: string): string {
  return q.trim().toLowerCase();
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
): Switch.Application[] {
  const q = normalizeQuery(queryRaw);
  if (!q) return [...apps];
  return apps.filter((a) => appMatchesSearchQuery(a, queryRaw));
}
