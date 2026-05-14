import { useEffect, useState } from "react";
import type { IgdbGameDetails } from "../lib/igdb";
import { getInstalledIgdbMatch } from "../lib/igdbBundledCatalog";
import { canFetchRemoteIgdbUrls } from "../lib/remoteIgdbAssets";

export type IgdbInlineFetchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ok"; data: IgdbGameDetails | null };

function appIconObjectUrl(app: Switch.Application): string | null {
  if (!app.icon) return null;
  return URL.createObjectURL(new Blob([app.icon]));
}

export function useIgdbInlineExperience(
  app: Switch.Application | null,
  enabled: boolean,
): {
  fetchState: IgdbInlineFetchState;
  heroImageUrl: string | null;
} {
  const [fetchState, setFetchState] = useState<IgdbInlineFetchState>({
    status: "idle",
  });
  const [heroImageUrl, setHeroImageUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !app) {
      setFetchState({ status: "idle" });
      setHeroImageUrl(null);
      return;
    }

    const ac = new AbortController();
    setFetchState({ status: "loading" });

    const localIconUrl = appIconObjectUrl(app);
    setHeroImageUrl(localIconUrl);

    void (async () => {
      try {
        const bundled = await getInstalledIgdbMatch(app);
        if (ac.signal.aborted) return;
        setFetchState({ status: "ok", data: bundled });
        const cover =
          canFetchRemoteIgdbUrls() && bundled?.coverUrl
            ? bundled.coverUrl
            : localIconUrl;
        setHeroImageUrl(cover);
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
  }, [enabled, app?.id, app?.name]);

  return { fetchState, heroImageUrl };
}
