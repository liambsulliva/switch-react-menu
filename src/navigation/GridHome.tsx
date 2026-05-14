import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { Image, Rect } from "react-tela";
import { truncate } from "../lib/truncate";
import { AppIcon } from "../components/AppIcon";
import { ApplicationDetailsContent } from "../components/ApplicationDetailsContent";
import { Modal } from "../components/Modal";
import { Navigation } from "../components/Navigation";
import { AlbumPage } from "./AlbumPage";
import { CustomSortMode } from "./CustomSortMode";
import { SettingsMenu } from "./SettingsMenu";
import {
  getAlbumIconPng,
  getCornerIconPng,
  getGlobeIconPng,
  getSettingsCogPng,
} from "../lib/iconPng";
import {
  useGamepadNavigation,
  type GridHomeFocusArea,
  type HeroSplashInlineSubFocus,
} from "../hooks/useGamepadNavigation";
import {
  registerAppLaunch,
  useLastPlayedApplicationId,
} from "../settings/lastPlayedStore";
import { setSettings, useSettings } from "../settings/settingsStore";
import { setCustomOrder, useCustomOrder } from "../settings/customSortStore";
import { useLaunchCountsRevision } from "../settings/launchCountsStore";
import { sortApplicationsForMode } from "../lib/sortApplications";
import {
  getInstalledTitlesRevision,
  subscribeInstalledTitlesRevision,
} from "../lib/richDetailsBundledCatalog";
import { useHiddenGameIdSet } from "../settings/hiddenGamesStore";
import { COLORS } from "../lib/colors";
import {
  DigitalClock,
  TOP_RIGHT_CLOCK_PUSH_PX,
  TOP_RIGHT_CLOCK_SCREEN_INSET_PX,
} from "../components/Clock";
import { HeroSplash } from "../components/HeroSplash";
import { useHeroSplashInlineExperience } from "../hooks/useHeroSplashInlineExperience";
import { easeOutDetailEntrance } from "../lib/easing";
import { requestRichDetailsCatalogHardReload } from "../lib/richDetailsHardReloadStore";
import { openSwitchWebApplet } from "../lib/switchWebApplet";
import { richTrailerWatchUrl } from "../lib/richTrailerUrl";

const GRID_GAP = 48;
const GRID_ICON_SIZE = 256;
const GRID_SIDE_MARGIN = 24;

export function GridHome() {
  const settings = useSettings();
  const customOrder = useCustomOrder();
  const installedTitlesRevision = useSyncExternalStore(
    subscribeInstalledTitlesRevision,
    getInstalledTitlesRevision,
    getInstalledTitlesRevision,
  );
  const launchCountsRevision = useLaunchCountsRevision();
  const hiddenGameIds = useHiddenGameIdSet();
  const lastPlayedId = useLastPlayedApplicationId();
  const [rawApps, setRawApps] = useState<Switch.Application[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [focusArea, setFocusArea] = useState<GridHomeFocusArea>("apps");
  const [selectedNavButton, setSelectedNavButton] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [showAlbum, setShowAlbum] = useState(false);
  const [showCustomSort, setShowCustomSort] = useState(false);
  const [detailsApp, setDetailsApp] = useState<Switch.Application | null>(null);
  const [heroSplashInlineOpen, setHeroSplashInlineOpen] = useState(false);
  const [heroInlineSubFocus, setHeroInlineSubFocus] =
    useState<HeroSplashInlineSubFocus>("content");
  const [heroTrailerIndex, setHeroTrailerIndex] = useState(0);
  const [heroPanT, setHeroPanT] = useState(0);
  const [cornerIconSrc, setCornerIconSrc] = useState<string | null>(null);
  const [settingsCogDefaultSrc, setSettingsCogDefaultSrc] = useState<
    string | null
  >(null);
  const [settingsCogFocusedSrc, setSettingsCogFocusedSrc] = useState<
    string | null
  >(null);
  const [albumIconDefaultSrc, setAlbumIconDefaultSrc] = useState<string | null>(
    null,
  );
  const [albumIconFocusedSrc, setAlbumIconFocusedSrc] = useState<string | null>(
    null,
  );
  const [globeIconDefaultSrc, setGlobeIconDefaultSrc] = useState<string | null>(
    null,
  );
  const [globeIconFocusedSrc, setGlobeIconFocusedSrc] = useState<string | null>(
    null,
  );

  const sortedApps = useMemo(
    () => sortApplicationsForMode(rawApps, settings.sortingMode, customOrder),
    [
      rawApps,
      settings.sortingMode,
      customOrder,
      installedTitlesRevision,
      launchCountsRevision,
    ],
  );

  const apps = useMemo(
    () => sortedApps.filter((a) => !hiddenGameIds.has(a.id.toString())),
    [sortedApps, hiddenGameIds],
  );

  const appCount = apps.length;

  const richDetailsExperienceEnabled = !settings.disableRichDetails;
  const heroSplashOnGridEnabled =
    richDetailsExperienceEnabled && settings.heroSplashInlineGrid;

  const gridViewportWidth = screen.width - GRID_SIDE_MARGIN * 2;
  const gridViewportX = GRID_SIDE_MARGIN;
  const gridViewportRight = gridViewportX + gridViewportWidth;

  const jumpStep = useMemo(
    () =>
      Math.max(1, Math.floor(gridViewportWidth / (GRID_ICON_SIZE + GRID_GAP))),
    [gridViewportWidth],
  );

  const handleRefreshRichCatalog = useCallback(() => {
    setShowSettings(false);
    requestRichDetailsCatalogHardReload();
  }, []);

  useEffect(() => {
    const loaded = Array.from(Switch.Application).filter((app) => app.icon);
    setRawApps(loaded);
  }, []);

  useEffect(() => {
    let active = true;

    Promise.all([
      getCornerIconPng(COLORS.gray[0]),
      getAlbumIconPng(COLORS.gray[400]),
      getAlbumIconPng(COLORS.gray[0]),
      getGlobeIconPng(COLORS.gray[400]),
      getGlobeIconPng(COLORS.gray[0]),
      getSettingsCogPng(COLORS.gray[400]),
      getSettingsCogPng(COLORS.gray[0]),
    ]).then(
      ([
        corner,
        albumDefault,
        albumFocused,
        globeDefault,
        globeFocused,
        settingsDefault,
        settingsFocused,
      ]) => {
        if (!active) return;
        setCornerIconSrc(corner);
        setAlbumIconDefaultSrc(albumDefault);
        setAlbumIconFocusedSrc(albumFocused);
        setGlobeIconDefaultSrc(globeDefault);
        setGlobeIconFocusedSrc(globeFocused);
        setSettingsCogDefaultSrc(settingsDefault);
        setSettingsCogFocusedSrc(settingsFocused);
      },
    );

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (settings.sortingMode !== "alphabetical") return;
    const alphabeticalOrder = [...rawApps]
      .sort((a, b) =>
        a.name.localeCompare(b.name, undefined, {
          sensitivity: "base",
        }),
      )
      .map((app) => app.id.toString());
    setCustomOrder(alphabeticalOrder);
  }, [settings.sortingMode, rawApps]);

  useEffect(() => {
    if (appCount === 0) {
      if (selectedIndex !== 0) setSelectedIndex(0);
      return;
    }
    if (selectedIndex >= appCount) {
      setSelectedIndex(appCount - 1);
    }
  }, [appCount, selectedIndex]);

  useEffect(() => {
    if (!settings.disableRichDetails) {
      setDetailsApp(null);
    }
  }, [settings.disableRichDetails]);

  useEffect(() => {
    if (!heroSplashOnGridEnabled) {
      setHeroSplashInlineOpen(false);
    }
  }, [heroSplashOnGridEnabled]);

  useEffect(() => {
    if (heroSplashOnGridEnabled && focusArea === "navigation") {
      setFocusArea("apps");
    }
  }, [heroSplashOnGridEnabled, focusArea]);

  const onStepPrev = useCallback(() => {
    setSelectedIndex((i) => Math.max(0, i - 1));
  }, []);

  const onStepNext = useCallback(() => {
    setSelectedIndex((i) => Math.min(Math.max(0, appCount - 1), i + 1));
  }, [appCount]);

  const openHeroSplashInline = useCallback(() => {
    setHeroSplashInlineOpen(true);
    setHeroInlineSubFocus("content");
    setHeroTrailerIndex(0);
  }, []);

  const closeHeroSplashInline = useCallback(() => {
    setHeroSplashInlineOpen(false);
    setHeroInlineSubFocus("content");
    setHeroTrailerIndex(0);
  }, []);

  const selectedApp = appCount > 0 ? (apps[selectedIndex] ?? null) : null;
  const heroSplashInlineActive =
    heroSplashOnGridEnabled && heroSplashInlineOpen && selectedApp !== null;

  const { fetchState, backgroundImageUrl, fallbackImageUrl } =
    useHeroSplashInlineExperience(selectedApp, heroSplashInlineActive);

  const heroTrailerCount = useMemo(() => {
    if (!heroSplashInlineActive) return 0;
    if (fetchState.status !== "ok" || !fetchState.data?.trailers) return 0;
    return fetchState.data.trailers.length;
  }, [heroSplashInlineActive, fetchState]);

  const onHeroTrailerActivate = useCallback(() => {
    if (fetchState.status !== "ok" || !fetchState.data?.trailers) return;
    const t = fetchState.data.trailers[heroTrailerIndex];
    if (t) openSwitchWebApplet(richTrailerWatchUrl(t));
  }, [fetchState, heroTrailerIndex]);

  useEffect(() => {
    if (!heroSplashInlineOpen) return;
    setHeroInlineSubFocus("content");
    setHeroTrailerIndex(0);
  }, [selectedApp?.id, heroSplashInlineOpen]);

  useEffect(() => {
    if (!heroSplashInlineActive) return;
    if (heroInlineSubFocus !== "trailers") return;
    if (heroTrailerCount === 0) {
      setHeroInlineSubFocus("content");
    }
  }, [heroSplashInlineActive, heroInlineSubFocus, heroTrailerCount]);

  useEffect(() => {
    if (heroTrailerCount <= 0) return;
    setHeroTrailerIndex((i) => Math.min(i, heroTrailerCount - 1));
  }, [heroTrailerCount]);

  useEffect(() => {
    if (!heroSplashInlineActive) {
      setHeroPanT(0);
      return;
    }
    setHeroPanT(0);
    const t0 = performance.now();
    const durationMs = 520;
    let raf = 0;
    const step = (now: number) => {
      const linearT = Math.min(1, (now - t0) / durationMs);
      setHeroPanT(easeOutDetailEntrance(linearT));
      if (linearT < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [heroSplashInlineActive]);

  useGamepadNavigation({
    apps,
    jumpStep,
    onStepPrev,
    onStepNext,
    setSelectedIndex,
    selectedIndex,
    focusArea,
    setFocusArea,
    navButtonIndex: selectedNavButton,
    setNavButtonIndex: setSelectedNavButton,
    isActive: !showSettings && !showCustomSort && !detailsApp && !showAlbum,
    onOpenSettings: () => setShowSettings(true),
    onOpenAlbum: () => setShowAlbum(true),
    onOpenWebBrowser: () => openSwitchWebApplet(),
    onMinus: settings.disableRichDetails
      ? () => {
          const app = apps[selectedIndex];
          if (app) setDetailsApp(app);
        }
      : undefined,
    replaceBottomNavWithHeroSplash: heroSplashOnGridEnabled,
    inlineDetailsOpen: heroSplashInlineOpen,
    onOpenInlineDetails: openHeroSplashInline,
    onCloseInlineDetails: closeHeroSplashInline,
    heroInlineSubFocus,
    setHeroInlineSubFocus,
    heroTrailerCount,
    setHeroTrailerIndex,
    onHeroTrailerActivate,
  });

  const handleAppSelect = (index: number) => {
    const picked = apps[index];
    if (!picked) return;
    if (index === selectedIndex) {
      registerAppLaunch(picked);
      picked.launch();
    } else {
      setSelectedIndex(index);
    }
  };

  const iconW = GRID_ICON_SIZE;
  const iconH = GRID_ICON_SIZE;
  const quarterScreenH = Math.floor(screen.height / 4);
  const iconLiftY = heroSplashInlineActive ? -quarterScreenH * heroPanT : 0;
  const iconBaseY = screen.height / 2 - iconH / 2 + iconLiftY;
  const totalRowWidth =
    appCount > 0 ? appCount * (iconW + GRID_GAP) - GRID_GAP : 0;
  const selectedCenterX = selectedIndex * (iconW + GRID_GAP) + iconW / 2;
  const idealScrollX = selectedCenterX - gridViewportWidth / 2;
  const maxScrollX = Math.max(0, totalRowWidth - gridViewportWidth);
  const scrollX = Math.max(0, Math.min(idealScrollX, maxScrollX));

  if (showAlbum) {
    return <AlbumPage onClose={() => setShowAlbum(false)} />;
  }

  if (showSettings) {
    return (
      <SettingsMenu
        onClose={() => setShowSettings(false)}
        onCustomSort={() => {
          setSettings({ sortingMode: "custom" });
          setShowSettings(false);
          setShowCustomSort(true);
        }}
        onRefreshRichCatalog={handleRefreshRichCatalog}
      />
    );
  }

  if (showCustomSort) {
    return (
      <CustomSortMode
        apps={sortedApps}
        compact={false}
        onDone={(newOrder) => {
          setCustomOrder(newOrder);
          setShowCustomSort(false);
        }}
        onCancel={() => setShowCustomSort(false)}
      />
    );
  }

  const settingsBtnCenterX = screen.width - 62 - TOP_RIGHT_CLOCK_PUSH_PX;
  const settingsBtnCenterY = 50;
  const settingsBtnW = 80;
  const settingsBtnH = 58;
  const settingsCogSize = 36;
  const settingsCogLeft = settingsBtnCenterX - settingsCogSize / 2;
  const topBarIconGap = 16;
  const albumIconSize = 48;
  const globeIconSize = 48;
  const albumIconX = settingsCogLeft - topBarIconGap - albumIconSize;
  const albumIconY = settingsBtnCenterY - albumIconSize / 2;
  const albumIconHitW = 56;
  const albumIconHitH = 56;
  const globeIconX = albumIconX - topBarIconGap - globeIconSize;
  const globeIconY = settingsBtnCenterY - globeIconSize / 2;
  const globeIconHitW = 56;
  const globeIconHitH = 56;
  const cornerIconSize = 48;
  const cornerIconX = 32;
  const cornerIconY = settingsBtnCenterY - cornerIconSize / 2;

  const navCenterLabel =
    appCount > 0 ? `${selectedIndex + 1} / ${appCount}` : undefined;

  return (
    <>
      <Rect
        x={0}
        y={0}
        width={screen.width}
        height={screen.height}
        fill={COLORS.background}
      />

      <DigitalClock
        x={screen.width - GRID_SIDE_MARGIN - TOP_RIGHT_CLOCK_SCREEN_INSET_PX}
        y={settingsBtnCenterY}
        fontSize={26}
      />

      {heroSplashInlineActive && selectedApp && (
        <HeroSplash
          panT={heroPanT}
          backgroundImageUrl={backgroundImageUrl}
          fallbackImageUrl={fallbackImageUrl}
          app={selectedApp}
          fetchState={fetchState}
          heroInlineSubFocus={heroInlineSubFocus}
          heroTrailerIndex={heroTrailerIndex}
        />
      )}

      {!heroSplashInlineActive && cornerIconSrc && (
        <Image
          src={cornerIconSrc}
          x={cornerIconX}
          y={cornerIconY}
          width={cornerIconSize}
          height={cornerIconSize}
        />
      )}

      {!heroSplashInlineActive &&
        globeIconDefaultSrc &&
        globeIconFocusedSrc && (
          <Image
            src={
              focusArea === "globe" ? globeIconFocusedSrc : globeIconDefaultSrc
            }
            x={globeIconX}
            y={globeIconY}
            width={globeIconSize}
            height={globeIconSize}
          />
        )}
      {!heroSplashInlineActive && (
        <Rect
          x={globeIconX + globeIconSize / 2 - globeIconHitW / 2}
          y={globeIconY + globeIconSize / 2 - globeIconHitH / 2}
          width={globeIconHitW}
          height={globeIconHitH}
          fill="transparent"
          onTouchStart={() => openSwitchWebApplet()}
        />
      )}

      {!heroSplashInlineActive &&
        albumIconDefaultSrc &&
        albumIconFocusedSrc && (
          <Image
            src={
              focusArea === "album" ? albumIconFocusedSrc : albumIconDefaultSrc
            }
            x={albumIconX}
            y={albumIconY}
            width={albumIconSize}
            height={albumIconSize}
          />
        )}
      {!heroSplashInlineActive && (
        <Rect
          x={albumIconX + albumIconSize / 2 - albumIconHitW / 2}
          y={albumIconY + albumIconSize / 2 - albumIconHitH / 2}
          width={albumIconHitW}
          height={albumIconHitH}
          fill="transparent"
          onTouchStart={() => setShowAlbum(true)}
        />
      )}

      {!heroSplashInlineActive &&
        settingsCogDefaultSrc &&
        settingsCogFocusedSrc && (
          <Image
            src={
              focusArea === "settings"
                ? settingsCogFocusedSrc
                : settingsCogDefaultSrc
            }
            x={settingsCogLeft}
            y={settingsBtnCenterY - settingsCogSize / 2}
            width={settingsCogSize}
            height={settingsCogSize}
          />
        )}
      {!heroSplashInlineActive && (
        <Rect
          x={settingsBtnCenterX - settingsBtnW / 2}
          y={settingsBtnCenterY - settingsBtnH / 2}
          width={settingsBtnW}
          height={settingsBtnH}
          fill="transparent"
          onTouchStart={() => setShowSettings(true)}
        />
      )}

      {apps.map((app, i) => {
        const baseX = i * (iconW + GRID_GAP);
        const renderX = gridViewportX + baseX - scrollX;

        if (renderX + iconW < gridViewportX || renderX > gridViewportRight) {
          return null;
        }

        return (
          <AppIcon
            key={app.id.toString()}
            app={app}
            x={renderX}
            y={iconBaseY}
            width={iconW}
            height={iconH}
            truncate={truncate}
            isSelected={
              focusArea === "apps" &&
              i === selectedIndex &&
              (!heroSplashInlineOpen || heroInlineSubFocus !== "trailers")
            }
            onSelect={() => handleAppSelect(i)}
            showTitle={settings.showAppTitles}
            showLastPlayedEyebrow={
              settings.showLastPlayed &&
              lastPlayedId !== null &&
              app.id.toString() === lastPlayedId
            }
          />
        );
      })}

      {!heroSplashOnGridEnabled && (
        <Navigation
          currentPage={selectedIndex}
          totalPages={appCount}
          onPrevPage={onStepPrev}
          onNextPage={onStepNext}
          isNavigationFocused={focusArea === "navigation"}
          selectedNavButton={selectedNavButton}
          navigationStyle={settings.navigationStyle}
          centerLabel={navCenterLabel}
        />
      )}

      {detailsApp && settings.disableRichDetails && (
        <Modal
          visible
          title="Application details"
          onClose={() => setDetailsApp(null)}
          maxPanelHeight={340}
        >
          {(layout) => (
            <ApplicationDetailsContent app={detailsApp} layout={layout} />
          )}
        </Modal>
      )}
    </>
  );
}
