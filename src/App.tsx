import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { RichDetailsLoadingOverlay } from "./components/Loader";
import {
  applyRichHydrationFromDisk,
  bumpInstalledTitlesRevision,
  ensureIconHeroRgbPairsReady,
  getInstalledAppSignature,
  initializeRichDetailsForInstalledApps,
  persistRichDetailsAfterBootstrap,
} from "./lib/richDetailsStore";
import { useRichDetailsHardReloadNonce } from "./lib/richDetailsHardReloadStore";
import { RawgApiError } from "./lib/rawgApiClient";
import { loadRichPersistentPayload } from "./lib/richDetailsPersistentCache";
import { CompactHome } from "./navigation/CompactHome";
import { GridHome } from "./navigation/GridHome";
import { RawgApiKeyGate } from "./navigation/RawgApiKeyGate";
import { hasRawgApiKey, useRawgApiKey } from "./settings/rawgApiKeyStore";
import { useSettings } from "./settings/settingsStore";

export function App() {
  const settings = useSettings();
  const rawgApiKey = useRawgApiKey();
  const hardReloadNonce = useRichDetailsHardReloadNonce();
  const [richDetailsReady, setRichDetailsReady] = useState(false);
  const [richDetailsLoadProgress, setRichDetailsLoadProgress] = useState(0);
  const [loadMessage, setLoadMessage] = useState("Loading…");
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [showRawgKeySettings, setShowRawgKeySettings] = useState(false);
  const targetProgressRef = useRef(0);
  const displayProgressRef = useRef(0);
  const lastTargetMsRef = useRef(
    typeof performance !== "undefined" ? performance.now() : Date.now(),
  );
  const lastPaintedProgressRef = useRef(0);
  const prevHardReloadNonce = useRef<number | null>(null);
  const bootstrapGen = useRef(0);

  const richDetailsEnabled = !settings.disableRichDetails;
  const needsRawgKey = richDetailsEnabled && !hasRawgApiKey();

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
    setRichDetailsLoadProgress(1);
    setRichDetailsReady(true);
    setBootstrapError(null);
  }, []);

  useLayoutEffect(() => {
    resetProgressRefs();
    setRichDetailsReady(false);
    setRichDetailsLoadProgress(0);
    setBootstrapError(null);
    setLoadMessage("Loading…");
  }, [resetProgressRefs, settings.disableRichDetails, rawgApiKey]);

  useLayoutEffect(() => {
    if (
      richDetailsEnabled &&
      prevHardReloadNonce.current !== null &&
      hardReloadNonce > prevHardReloadNonce.current
    ) {
      resetProgressRefs();
      setRichDetailsReady(false);
      setRichDetailsLoadProgress(0);
      setBootstrapError(null);
      setLoadMessage("Refreshing RAWG game details…");
    }
    prevHardReloadNonce.current = hardReloadNonce;
  }, [hardReloadNonce, resetProgressRefs, richDetailsEnabled]);

  useEffect(() => {
    if (richDetailsReady) return undefined;
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
        setRichDetailsLoadProgress(d);
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
    };
  }, [richDetailsReady]);

  useEffect(() => {
    if (needsRawgKey || showRawgKeySettings) return undefined;

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
          if (!richDetailsEnabled) {
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
            setLoadMessage("Loading cached game details…");
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
          setRichDetailsReady(false);
          setRichDetailsLoadProgress(0);
          setLoadMessage("Fetching RAWG game details…");

          await initializeRichDetailsForInstalledApps(installedApps, {
            onProgress: scheduleProgress,
            forceRefresh: hardReloadNonce > 0,
          });
          if (!alive || bootstrapGen.current !== gen) return;

          await persistRichDetailsAfterBootstrap(installedApps);
          if (!alive || bootstrapGen.current !== gen) return;

          bumpInstalledTitlesRevision();
          finishBootstrapProgress();
        } catch (err) {
          if (!alive || bootstrapGen.current !== gen) return;
          if (err instanceof RawgApiError && err.status === 401) {
            setBootstrapError(
              "RAWG API key was rejected. Update your key in Settings.",
            );
          } else if (err instanceof Error) {
            setBootstrapError(err.message);
          } else {
            setBootstrapError("Failed to load game details.");
          }
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
    needsRawgKey,
    resetProgressRefs,
    richDetailsEnabled,
    scheduleProgress,
    showRawgKeySettings,
  ]);

  const handleOpenRawgApiKeySettings = useCallback(() => {
    setShowRawgKeySettings(true);
    setRichDetailsReady(false);
    resetProgressRefs();
    setRichDetailsLoadProgress(0);
  }, [resetProgressRefs]);

  const handleRawgKeyGateComplete = useCallback(() => {
    setShowRawgKeySettings(false);
    if (needsRawgKey) {
      resetProgressRefs();
      setRichDetailsReady(false);
      setRichDetailsLoadProgress(0);
      setBootstrapError(null);
      setLoadMessage("Fetching RAWG game details…");
    }
  }, [needsRawgKey, resetProgressRefs]);

  if (showRawgKeySettings || needsRawgKey) {
    return (
      <RawgApiKeyGate
        mode={needsRawgKey ? "required" : "settings"}
        onComplete={handleRawgKeyGateComplete}
        onCancel={
          showRawgKeySettings && !needsRawgKey
            ? () => {
                setShowRawgKeySettings(false);
                if (!richDetailsReady) {
                  finishBootstrapProgress();
                }
              }
            : undefined
        }
      />
    );
  }

  if (!richDetailsReady) {
    return (
      <RichDetailsLoadingOverlay
        progress={richDetailsLoadProgress}
        message={loadMessage}
        error={bootstrapError}
      />
    );
  }

  if (settings.compactView) {
    return (
      <CompactHome
        bootstrapError={bootstrapError}
        onEditRawgApiKey={handleOpenRawgKeySettings}
      />
    );
  }

  return (
    <GridHome
      bootstrapError={bootstrapError}
      onEditRawgApiKey={handleOpenRawgKeySettings}
    />
  );
}
