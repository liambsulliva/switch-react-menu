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
  ensureIconHeroRgbPairsReady,
  getInstalledAppSignature,
  initializeRichDetailsForInstalledApps,
  persistRichCatalogAfterBootstrap,
} from "./lib/richDetailsBundledCatalog";
import { useRichDetailsHardReloadNonce } from "./lib/richDetailsHardReloadStore";
import { loadRichPersistentPayload } from "./lib/richDetailsPersistentCache";
import { CompactHome } from "./navigation/CompactHome";
import { GridHome } from "./navigation/GridHome";
import { useSettings } from "./settings/settingsStore";

export function App() {
  const settings = useSettings();
  const hardReloadNonce = useRichDetailsHardReloadNonce();
  const [richCatalogReady, setRichCatalogReady] = useState(false);
  const [richCatalogLoadProgress, setRichCatalogLoadProgress] = useState(0);
  const targetProgressRef = useRef(0);
  const displayProgressRef = useRef(0);
  const lastTargetMsRef = useRef(
    typeof performance !== "undefined" ? performance.now() : Date.now(),
  );
  const lastPaintedProgressRef = useRef(0);
  const prevHardReloadNonce = useRef<number | null>(null);
  const bootstrapGen = useRef(0);

  const resetProgressRefs = useCallback(() => {
    const now =
      typeof performance !== "undefined" ? performance.now() : Date.now();
    targetProgressRef.current = 0;
    displayProgressRef.current = 0;
    lastPaintedProgressRef.current = 0;
    lastTargetMsRef.current = now;
  }, []);

  const scheduleProgress = useCallback((p: number) => {
    const clamped = Math.max(0, Math.min(1, p));
    if (clamped !== targetProgressRef.current) {
      targetProgressRef.current = clamped;
      lastTargetMsRef.current =
        typeof performance !== "undefined" ? performance.now() : Date.now();
    }
  }, []);

  const finishBootstrapProgress = useCallback(() => {
    targetProgressRef.current = 1;
    displayProgressRef.current = 1;
    lastPaintedProgressRef.current = 1;
    setRichCatalogLoadProgress(1);
    setRichCatalogReady(true);
  }, []);

  useLayoutEffect(() => {
    resetProgressRefs();
    setRichCatalogReady(false);
    setRichCatalogLoadProgress(0);
  }, [resetProgressRefs, settings.disableRichDetails]);

  useLayoutEffect(() => {
    if (
      !settings.disableRichDetails &&
      prevHardReloadNonce.current !== null &&
      hardReloadNonce > prevHardReloadNonce.current
    ) {
      resetProgressRefs();
      setRichCatalogReady(false);
      setRichCatalogLoadProgress(0);
    }
    prevHardReloadNonce.current = hardReloadNonce;
  }, [hardReloadNonce, resetProgressRefs, settings.disableRichDetails]);

  useEffect(() => {
    if (richCatalogReady) return undefined;
    let raf = 0;
    const nowMs = () =>
      typeof performance !== "undefined" ? performance.now() : Date.now();

    const tick = () => {
      const target = targetProgressRef.current;
      let d = displayProgressRef.current;
      const t = nowMs();
      const staleMs = t - lastTargetMsRef.current;

      const gap = target - d;
      const k = gap > 0.22 ? 0.42 : gap > 0.08 ? 0.22 : 0.11;
      d += gap * k;

      if (target < 0.998 && staleMs > 380) {
        const creepCap = Math.min(0.87, target + 0.34);
        d = Math.min(d + 0.0028, creepCap);
      }

      if (target >= 0.998) {
        d += (1 - d) * 0.35;
        if (1 - d < 0.002) d = 1;
      }

      d = Math.max(0, Math.min(1, d));
      displayProgressRef.current = d;

      const lastP = lastPaintedProgressRef.current;
      if (Math.abs(d - lastP) >= 0.0035 || (d >= 0.99 && lastP < 0.99)) {
        lastPaintedProgressRef.current = d;
        setRichCatalogLoadProgress(d);
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
    };
  }, [richCatalogReady]);

  useEffect(() => {
    const gen = ++bootstrapGen.current;
    resetProgressRefs();
    let alive = true;
    const installedApps = Array.from(Switch.Application).filter(
      (app) => app.icon,
    );
    const sig = getInstalledAppSignature(installedApps);

    const frame = requestAnimationFrame(() => {
      queueMicrotask(async () => {
        try {
          if (settings.disableRichDetails) {
            await ensureIconHeroRgbPairsReady(installedApps, {
              hardReloadNonce,
              installedSignature: sig,
            });
            if (!alive || bootstrapGen.current !== gen) return;
            finishBootstrapProgress();
            return;
          }

          if (hardReloadNonce === 0) {
            scheduleProgress(0.045);
            const payload = await loadRichPersistentPayload(sig);
            if (!alive || bootstrapGen.current !== gen) return;
            if (payload) {
              applyRichHydrationFromDisk(payload);
              await ensureIconHeroRgbPairsReady(installedApps, {
                hardReloadNonce,
                installedSignature: sig,
              });
              if (!alive || bootstrapGen.current !== gen) return;
              finishBootstrapProgress();
              return;
            }
          }

          if (!alive || bootstrapGen.current !== gen) return;
          resetProgressRefs();
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
          finishBootstrapProgress();
        } catch {
          if (!alive || bootstrapGen.current !== gen) return;
          finishBootstrapProgress();
        }
      });
    });

    return () => {
      alive = false;
      cancelAnimationFrame(frame);
    };
  }, [
    finishBootstrapProgress,
    hardReloadNonce,
    resetProgressRefs,
    scheduleProgress,
    settings.disableRichDetails,
  ]);

  if (!richCatalogReady) {
    return <RichCatalogLoadingOverlay progress={richCatalogLoadProgress} />;
  }

  if (settings.compactView) {
    return <CompactHome />;
  }

  return <GridHome />;
}
