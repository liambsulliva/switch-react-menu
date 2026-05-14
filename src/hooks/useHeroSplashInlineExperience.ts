import { useEffect, useState, useSyncExternalStore } from "react";
import type { RichGameDetails } from "../lib/richGameDetails";
import {
  getInstalledRichMatch,
  getInstalledTitlesRevision,
  subscribeInstalledTitlesRevision,
} from "../lib/richDetailsBundledCatalog";
import { canFetchRemoteRichAssets } from "../lib/remoteRichAssets";

export type HeroSplashInlineFetchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ok"; data: RichGameDetails | null };

function appIconObjectUrl(app: Switch.Application): string | null {
  if (!app.icon) return null;
  return URL.createObjectURL(new Blob([app.icon]));
}

export function useHeroSplashInlineExperience(
  app: Switch.Application | null,
  enabled: boolean,
): {
  fetchState: HeroSplashInlineFetchState;
  backgroundImageUrl: string | null;
  fallbackImageUrl: string | null;
} {
  const [fetchState, setFetchState] = useState<HeroSplashInlineFetchState>({
    status: "idle",
  });
  const [backgroundImageUrl, setBackgroundImageUrl] = useState<string | null>(
    null,
  );
  const [fallbackImageUrl, setFallbackImageUrl] = useState<string | null>(null);

  const installedTitlesRevision = useSyncExternalStore(
    subscribeInstalledTitlesRevision,
    getInstalledTitlesRevision,
    getInstalledTitlesRevision,
  );

  useEffect(() => {
    if (!enabled || !app) {
      setFetchState({ status: "idle" });
      setBackgroundImageUrl(null);
      setFallbackImageUrl(null);
      return;
    }

    const ac = new AbortController();
    setFetchState({ status: "loading" });

    const localIconUrl = appIconObjectUrl(app);
    setBackgroundImageUrl(localIconUrl);
    setFallbackImageUrl(localIconUrl);

    void (async () => {
      try {
        const bundled = await getInstalledRichMatch(app);
        if (ac.signal.aborted) return;
        setFetchState({ status: "ok", data: bundled });
        const background =
          canFetchRemoteRichAssets() && bundled?.backgroundUrl
            ? bundled.backgroundUrl
            : localIconUrl;
        setBackgroundImageUrl(background);
      } catch (err: unknown) {
        if (ac.signal.aborted) return;
        const message = err instanceof Error ? err.message : "Request failed";
        setFetchState({ status: "error", message });
      }
    })();

    return () => {
      ac.abort();
      if (localIconUrl) URL.revokeObjectURL(localIconUrl);
    };
  }, [enabled, app?.id, app?.name, installedTitlesRevision]);

  return { fetchState, backgroundImageUrl, fallbackImageUrl };
}
