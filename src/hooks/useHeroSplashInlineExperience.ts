import { useEffect, useState, useSyncExternalStore } from "react";
import type { RichGameDetails } from "../lib/richGameDetails";
import {
  getInstalledRichMatch,
  getInstalledTitlesRevision,
  subscribeInstalledTitlesRevision,
} from "../lib/richDetailsBundledCatalog";

export type HeroSplashInlineFetchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ok"; data: RichGameDetails | null };

export function useHeroSplashInlineExperience(
  app: Switch.Application | null,
  enabled: boolean,
): {
  fetchState: HeroSplashInlineFetchState;
} {
  const [fetchState, setFetchState] = useState<HeroSplashInlineFetchState>({
    status: "idle",
  });

  const installedTitlesRevision = useSyncExternalStore(
    subscribeInstalledTitlesRevision,
    getInstalledTitlesRevision,
    getInstalledTitlesRevision,
  );

  useEffect(() => {
    if (!enabled || !app) {
      setFetchState({ status: "idle" });
      return;
    }

    const ac = new AbortController();
    setFetchState({ status: "loading" });

    void (async () => {
      try {
        const bundled = await getInstalledRichMatch(app);
        if (ac.signal.aborted) return;
        setFetchState({ status: "ok", data: bundled });
      } catch (err: unknown) {
        if (ac.signal.aborted) return;
        const message = err instanceof Error ? err.message : "Request failed";
        setFetchState({ status: "error", message });
      }
    })();

    return () => {
      ac.abort();
    };
  }, [enabled, app?.id, app?.name, installedTitlesRevision]);

  return { fetchState };
}
