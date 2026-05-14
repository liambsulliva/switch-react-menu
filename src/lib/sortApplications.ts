import { peekInstalledRichMatch } from "./richDetailsBundledCatalog";
import { getLaunchCount } from "../settings/launchCountsStore";
import type { SortingMode } from "../settings/settingsStore";

function compareName(a: Switch.Application, b: Switch.Application): number {
  return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
}

export function sortApplicationsForMode(
  apps: readonly Switch.Application[],
  mode: SortingMode,
  customOrder: readonly string[],
): Switch.Application[] {
  const copy = [...apps];

  switch (mode) {
    case "alphabetical":
      return copy.sort(compareName);
    case "releaseDate":
      return copy.sort((a, b) => {
        const ta = peekInstalledRichMatch(a.id.toString())?.firstReleaseDate;
        const tb = peekInstalledRichMatch(b.id.toString())?.firstReleaseDate;
        const na = ta ?? null;
        const nb = tb ?? null;
        if (na != null && nb != null && na !== nb) {
          return nb - na;
        }
        if (na != null && nb == null) return -1;
        if (na == null && nb != null) return 1;
        return compareName(a, b);
      });
    case "timesOpened":
      return copy.sort((a, b) => {
        const ca = getLaunchCount(a.id.toString());
        const cb = getLaunchCount(b.id.toString());
        if (ca !== cb) return cb - ca;
        return compareName(a, b);
      });
    case "custom": {
      if (customOrder.length === 0) {
        return copy;
      }
      const orderMap = new Map(customOrder.map((id, i) => [id, i]));
      return copy.sort((a, b) => {
        const ai = orderMap.get(a.id.toString()) ?? Infinity;
        const bi = orderMap.get(b.id.toString()) ?? Infinity;
        return ai - bi;
      });
    }
    case "recentlyPlayed":
    default:
      return copy;
  }
}
