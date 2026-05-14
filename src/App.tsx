import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { RichCatalogLoadingOverlay } from "./components/Loader";
import {
  applyRichHydrationFromDisk,
  bumpInstalledTitlesRevision,
  getInstalledAppSignature,
  initializeRichDetailsForInstalledApps,
  persistRichCatalogAfterBootstrap,
} from "./lib/richDetailsBundledCatalog";
import { useRichDetailsHardReloadNonce } from "./lib/richDetailsHardReloadStore";
import { loadRichPersistentPayload } from "./lib/richDetailsPersistentCache";
import { CompactHome } from "./navigation/CompactHome";
import { GridHome } from "./navigation/GridHome";
import { getSettings, useSettings } from "./settings/settingsStore";

export function App() {
  const settings = useSettings();
  const hardReloadNonce = useRichDetailsHardReloadNonce();
  const [richCatalogReady, setRichCatalogReady] = useState(
    () => getSettings().disableRichDetails,
  );
  const [richCatalogLoadProgress, setRichCatalogLoadProgress] = useState(0);
  const pendingProgressRef = useRef(0);
  const progressRafRef = useRef(0);
  const prevHardReloadNonce = useRef<number | null>(null);
  const bootstrapGen = useRef(0);

  const flushProgress = useCallback(() => {
    progressRafRef.current = 0;
    setRichCatalogLoadProgress(pendingProgressRef.current);
  }, []);

  const scheduleProgress = useCallback(
    (p: number) => {
      pendingProgressRef.current = p;
      if (progressRafRef.current !== 0) return;
      progressRafRef.current = requestAnimationFrame(flushProgress);
    },
    [flushProgress],
  );

  useLayoutEffect(() => {
    if (settings.disableRichDetails) {
      setRichCatalogReady(true);
      setRichCatalogLoadProgress(1);
    } else {
      setRichCatalogReady(false);
      setRichCatalogLoadProgress(0);
    }
  }, [settings.disableRichDetails]);

  useLayoutEffect(() => {
    if (
      !settings.disableRichDetails &&
      prevHardReloadNonce.current !== null &&
      hardReloadNonce > prevHardReloadNonce.current
    ) {
      setRichCatalogReady(false);
      setRichCatalogLoadProgress(0);
    }
    prevHardReloadNonce.current = hardReloadNonce;
  }, [hardReloadNonce, settings.disableRichDetails]);

  useEffect(() => {
    if (settings.disableRichDetails) {
      setRichCatalogReady(true);
      setRichCatalogLoadProgress(1);
      return;
    }

    const gen = ++bootstrapGen.current;
    let alive = true;
    const installedApps = Array.from(Switch.Application).filter(
      (app) => app.icon,
    );
    const sig = getInstalledAppSignature(installedApps);

    const frame = requestAnimationFrame(() => {
      queueMicrotask(async () => {
        try {
          if (hardReloadNonce === 0) {
            const payload = await loadRichPersistentPayload(sig);
            if (!alive || bootstrapGen.current !== gen) return;
            if (payload) {
              applyRichHydrationFromDisk(payload);
              setRichCatalogLoadProgress(1);
              setRichCatalogReady(true);
              return;
            }
          }

          if (!alive || bootstrapGen.current !== gen) return;
          setRichCatalogReady(false);
          setRichCatalogLoadProgress(0);

          await initializeRichDetailsForInstalledApps(installedApps, {
            onProgress: scheduleProgress,
            reuseCatalog: false,
            forceRefresh: hardReloadNonce > 0,
          });
          if (!alive || bootstrapGen.current !== gen) return;

          await persistRichCatalogAfterBootstrap(installedApps);
          if (!alive || bootstrapGen.current !== gen) return;

          bumpInstalledTitlesRevision();
          setRichCatalogLoadProgress(1);
          setRichCatalogReady(true);
        } catch {
          if (!alive || bootstrapGen.current !== gen) return;
          setRichCatalogLoadProgress(1);
          setRichCatalogReady(true);
        }
      });
    });

    return () => {
      alive = false;
      cancelAnimationFrame(frame);
      if (progressRafRef.current !== 0) {
        cancelAnimationFrame(progressRafRef.current);
        progressRafRef.current = 0;
      }
    };
  }, [settings.disableRichDetails, hardReloadNonce, scheduleProgress]);

  if (!richCatalogReady) {
    return <RichCatalogLoadingOverlay progress={richCatalogLoadProgress} />;
  }

  if (settings.compactView) {
    return <CompactHome />;
  }

  return <GridHome />;
}
