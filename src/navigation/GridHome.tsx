import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { Image, Rect } from "react-tela";
import { truncate } from "../lib/truncate";
import { AppIcon, APP_ICON_SELECTED_FOCUS_SCALE } from "../components/AppIcon";
import { ApplicationDetailsContent } from "../components/ApplicationDetailsContent";
import { handleVirtualKeyboardFaceButton } from "../components/Input";
import { Modal } from "../components/Modal";
import { Navigation } from "../components/Navigation";
import { SearchBar } from "../components/SearchBar";
import { AlbumPage } from "./AlbumPage";
import { CustomSortMode } from "./CustomSortMode";
import { SettingsMenu } from "./SettingsMenu";
import {
  getAlbumIconPng,
  getCornerIconPng,
  getGlobeIconPng,
  getSearchIconPng,
  getSettingsCogPng,
} from "../lib/iconPng";
import {
  HERO_TRAILER_GRID_MAX_CARDS,
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
import { HeroSplash } from "./HeroSplashPage";
import { EditApp } from "./EditAppPage";
import { useHeroSplashInlineExperience } from "../hooks/useHeroSplashInlineExperience";
import { useSwitchVirtualKeyboard } from "../hooks/useSwitchVirtualKeyboard";
import { easeOutDetailEntrance } from "../lib/easing";
import { requestRichDetailsCatalogHardReload } from "../lib/richDetailsHardReloadStore";
import { openSwitchWebApplet } from "../lib/switchWebApplet";
import { richTrailerWatchUrl } from "../lib/richTrailerUrl";
import { filterAppsBySearchQuery } from "../lib/filterAppsBySearchQuery";

const GRID_GAP = 48;
const GRID_ICON_SIZE = 256;
const GRID_SIDE_MARGIN = 24;
const SEARCH_BAR_SIDE_PADDING = 15;
const HOME_TOP_BAR_ROW_CENTER_Y = 50;
const HOME_SEARCH_BAR_HEIGHT_PX = 36;
const SEARCH_LAYOUT_MARGIN_BAR_TO_ICON_ROW_PX = -75;
const APP_ICON_TITLE_GAP_BELOW_DEFAULT_PX = 20;
const APP_ICON_TITLE_GAP_BELOW_SEARCH_PX = 5;
const APP_ICON_TITLE_FONT_DEFAULT_PX = 24;
const APP_ICON_TITLE_FONT_SEARCH_PX = 18;
const APP_ICON_TITLE_MAX_CHARS_DEFAULT = 17;
const APP_ICON_TITLE_MAX_CHARS_SEARCH = 22;
const APP_ICON_TITLE_LINE_BELOW_SLACK_DEFAULT_PX = 36;
const APP_ICON_TITLE_LINE_BELOW_SLACK_SEARCH_PX = 28;
const SEARCH_BAR_FONT_DEFAULT_PX = 22;
const SEARCH_BAR_FONT_SEARCH_INPUT_PX = 18;
const SEARCH_BAR_DISPLAY_MAX_CHARS_DEFAULT = 42;
const SEARCH_BAR_DISPLAY_MAX_CHARS_SEARCH_INPUT = 52;
const switchSearchKeyboardReservePx = () =>
  Math.min(
    Math.max(Math.floor(screen.height * 0.4), 280),
    Math.floor(screen.height * 0.55),
  );

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
  const [editRichDetailsApp, setEditRichDetailsApp] =
    useState<Switch.Application | null>(null);
  const [heroSplashInlineOpen, setHeroSplashInlineOpen] = useState(false);
  const [heroInlineSubFocus, setHeroInlineSubFocus] =
    useState<HeroSplashInlineSubFocus>("content");
  const [heroTrailerIndex, setHeroTrailerIndex] = useState(0);
  const [heroActionIndex, setHeroActionIndex] = useState(0);
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
  const [searchIconDefaultSrc, setSearchIconDefaultSrc] = useState<
    string | null
  >(null);
  const [searchIconFocusedSrc, setSearchIconFocusedSrc] = useState<
    string | null
  >(null);

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

  const {
    text: searchQuery,
    clear: clearSearchKeyboard,
    deleteLastChar: deleteLastSearchChar,
  } = useSwitchVirtualKeyboard(focusArea === "searchInput");

  const searchBarVisible = useMemo(
    () =>
      focusArea === "search" ||
      focusArea === "searchInput" ||
      searchQuery.trim().length > 0,
    [focusArea, searchQuery],
  );

  const appsForGrid = useMemo(
    () => filterAppsBySearchQuery(apps, searchQuery),
    [apps, searchQuery, installedTitlesRevision],
  );

  const appCount = appsForGrid.length;

  const richDetailsExperienceEnabled = !settings.disableRichDetails;
  const heroSplashOnGridEnabled =
    richDetailsExperienceEnabled && settings.heroSplashInlineGrid;

  const gridViewportWidth = screen.width - GRID_SIDE_MARGIN * 2;
  const gridViewportX = GRID_SIDE_MARGIN;
  const gridViewportRight = gridViewportX + gridViewportWidth;

  const selectedApp =
    appCount > 0 ? (appsForGrid[selectedIndex] ?? null) : null;
  const heroSplashInlineActive =
    heroSplashOnGridEnabled && heroSplashInlineOpen && selectedApp !== null;

  const searchLayoutActive =
    focusArea === "searchInput" && !heroSplashInlineActive;
  const showGridTitles = settings.showAppTitles && !heroSplashInlineActive;
  const titleGapBelowIconPx =
    showGridTitles && searchLayoutActive
      ? APP_ICON_TITLE_GAP_BELOW_SEARCH_PX
      : APP_ICON_TITLE_GAP_BELOW_DEFAULT_PX;
  const titleFontSize =
    showGridTitles && searchLayoutActive
      ? APP_ICON_TITLE_FONT_SEARCH_PX
      : APP_ICON_TITLE_FONT_DEFAULT_PX;
  const titleMaxChars =
    showGridTitles && searchLayoutActive
      ? APP_ICON_TITLE_MAX_CHARS_SEARCH
      : APP_ICON_TITLE_MAX_CHARS_DEFAULT;
  const titleLineBelowSlackPx =
    showGridTitles && searchLayoutActive
      ? APP_ICON_TITLE_LINE_BELOW_SLACK_SEARCH_PX
      : APP_ICON_TITLE_LINE_BELOW_SLACK_DEFAULT_PX;
  const titleStackBelowIcons = showGridTitles
    ? titleGapBelowIconPx + titleLineBelowSlackPx
    : 12;
  const searchGridSafeTop =
    HOME_TOP_BAR_ROW_CENTER_Y +
    HOME_SEARCH_BAR_HEIGHT_PX / 2 +
    SEARCH_LAYOUT_MARGIN_BAR_TO_ICON_ROW_PX;
  const searchGridSafeBottom = screen.height - switchSearchKeyboardReservePx();
  const searchGridVerticalBudget = Math.max(
    140,
    searchGridSafeBottom - searchGridSafeTop,
  );
  const searchIconSlotByQuarterScreen = Math.floor(screen.height / 4);
  const gridIconSlotSize = searchLayoutActive
    ? Math.max(
        128,
        Math.min(GRID_ICON_SIZE, searchIconSlotByQuarterScreen),
      )
    : GRID_ICON_SIZE;

  const jumpStep = useMemo(
    () =>
      Math.max(1, Math.floor(gridViewportWidth / (gridIconSlotSize + GRID_GAP))),
    [gridViewportWidth, gridIconSlotSize],
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
      getSearchIconPng(COLORS.gray[400]),
      getSearchIconPng(COLORS.gray[0]),
      getSettingsCogPng(COLORS.gray[400]),
      getSettingsCogPng(COLORS.gray[0]),
    ]).then(
      ([
        corner,
        albumDefault,
        albumFocused,
        globeDefault,
        globeFocused,
        searchDefault,
        searchFocused,
        settingsDefault,
        settingsFocused,
      ]) => {
        if (!active) return;
        setCornerIconSrc(corner);
        setAlbumIconDefaultSrc(albumDefault);
        setAlbumIconFocusedSrc(albumFocused);
        setGlobeIconDefaultSrc(globeDefault);
        setGlobeIconFocusedSrc(globeFocused);
        setSearchIconDefaultSrc(searchDefault);
        setSearchIconFocusedSrc(searchFocused);
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
    setHeroActionIndex(0);
  }, []);

  const closeHeroSplashInline = useCallback(() => {
    setHeroSplashInlineOpen(false);
    setHeroInlineSubFocus("content");
    setHeroTrailerIndex(0);
    setHeroActionIndex(0);
  }, []);

  const { fetchState } = useHeroSplashInlineExperience(
    selectedApp,
    heroSplashInlineActive,
  );

  const heroTrailerCount = useMemo(() => {
    if (!heroSplashInlineActive) return 0;
    if (fetchState.status !== "ok" || !fetchState.data?.trailers) return 0;
    return Math.min(
      HERO_TRAILER_GRID_MAX_CARDS,
      fetchState.data.trailers.length,
    );
  }, [heroSplashInlineActive, fetchState]);

  const onHeroTrailerActivate = useCallback(() => {
    if (fetchState.status !== "ok" || !fetchState.data?.trailers) return;
    const t = fetchState.data.trailers[heroTrailerIndex];
    if (t) openSwitchWebApplet(richTrailerWatchUrl(t));
  }, [fetchState, heroTrailerIndex]);

  const onHeroPlayGame = useCallback(() => {
    const app = selectedApp;
    if (!app) return;
    registerAppLaunch(app);
    app.launch();
  }, [selectedApp]);

  const onHeroEditInfo = useCallback(() => {
    const picked = selectedApp;
    if (!picked) return;
    closeHeroSplashInline();
    setEditRichDetailsApp(picked);
  }, [selectedApp, closeHeroSplashInline]);

  const onHeroActionActivate = useCallback(
    (index: number) => {
      if (index === 0) onHeroPlayGame();
      else onHeroEditInfo();
    },
    [onHeroPlayGame, onHeroEditInfo],
  );

  useEffect(() => {
    if (!heroSplashInlineOpen) return;
    setHeroInlineSubFocus("content");
    setHeroTrailerIndex(0);
    setHeroActionIndex(0);
  }, [selectedApp?.id, heroSplashInlineOpen]);

  useEffect(() => {
    if (!heroSplashInlineActive) return;
    if (heroInlineSubFocus !== "trailers") return;
    if (heroTrailerCount === 0) {
      setHeroInlineSubFocus("actions");
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

  useEffect(() => {
    if (!heroSplashInlineActive) return;
    if (focusArea === "search" || focusArea === "searchInput") {
      setFocusArea("apps");
    }
  }, [heroSplashInlineActive, focusArea]);

  const onActivateSearch = useCallback(() => {
    setFocusArea("searchInput");
  }, []);

  const onSearchSubmit = useCallback(() => {
    const vk = (
      navigator as Navigator & {
        virtualKeyboard?: EventTarget & {
          dispatchEvent?: (e: Event) => boolean;
        };
      }
    ).virtualKeyboard;
    if (vk && typeof vk.dispatchEvent === "function") {
      vk.dispatchEvent(new Event("submit"));
    }
    setFocusArea("apps");
  }, []);

  const onSearchCancel = useCallback(() => {
    clearSearchKeyboard();
    setFocusArea("apps");
  }, [clearSearchKeyboard]);

  const onSearchBarPress = useCallback(() => {
    setFocusArea("searchInput");
    const vk = (
      navigator as Navigator & {
        virtualKeyboard?: { show?: () => void };
      }
    ).virtualKeyboard;
    vk?.show?.();
  }, []);

  const onSearchIconTouch = useCallback(() => {
    if (focusArea === "searchInput" || focusArea === "search") {
      onSearchCancel();
      return;
    }
    setFocusArea("searchInput");
  }, [focusArea, onSearchCancel]);

  const onButtonBPress = useCallback(() => {
    if (focusArea === "searchInput") {
      handleVirtualKeyboardFaceButton("B", {
        valueLength: searchQuery.length,
        deleteLastChar: deleteLastSearchChar,
        onDismiss: onSearchCancel,
      });
      return;
    }
    if (searchQuery.trim()) clearSearchKeyboard();
  }, [
    focusArea,
    searchQuery,
    clearSearchKeyboard,
    deleteLastSearchChar,
    onSearchCancel,
  ]);

  const onButtonXPress = useCallback(() => {
    if (focusArea === "searchInput") {
      handleVirtualKeyboardFaceButton("X", {
        valueLength: searchQuery.length,
        deleteLastChar: deleteLastSearchChar,
        onDismiss: onSearchCancel,
      });
    }
  }, [focusArea, searchQuery, deleteLastSearchChar, onSearchCancel]);

  useGamepadNavigation({
    apps: appsForGrid,
    jumpStep,
    onStepPrev,
    onStepNext,
    setSelectedIndex,
    selectedIndex,
    focusArea,
    setFocusArea,
    navButtonIndex: selectedNavButton,
    setNavButtonIndex: setSelectedNavButton,
    isActive:
      !showSettings &&
      !showCustomSort &&
      !detailsApp &&
      !showAlbum &&
      !editRichDetailsApp,
    onOpenSettings: () => setShowSettings(true),
    onSearchSubmit,
    onSearchCancel,
    onOpenAlbum: () => setShowAlbum(true),
    onOpenWebBrowser: () => openSwitchWebApplet(),
    onActivateSearch,
    onMinus: settings.disableRichDetails
      ? () => {
          const app = appsForGrid[selectedIndex];
          if (app) setDetailsApp(app);
        }
      : undefined,
    onButtonBPress,
    onButtonXPress,
    replaceBottomNavWithHeroSplash: heroSplashOnGridEnabled,
    inlineDetailsOpen: heroSplashInlineOpen,
    onOpenInlineDetails: openHeroSplashInline,
    onCloseInlineDetails: closeHeroSplashInline,
    heroInlineSubFocus,
    setHeroInlineSubFocus,
    heroTrailerCount,
    heroTrailerIndex,
    setHeroTrailerIndex,
    onHeroTrailerActivate,
    heroActionIndex,
    setHeroActionIndex,
    heroActionCount: 2,
    onHeroActionActivate,
  });

  const handleAppSelect = (index: number) => {
    setFocusArea("apps");
    const picked = appsForGrid[index];
    if (!picked) return;
    if (index === selectedIndex) {
      registerAppLaunch(picked);
      picked.launch();
    } else {
      setSelectedIndex(index);
    }
  };

  const iconW = gridIconSlotSize;
  const iconH = gridIconSlotSize;
  const quarterScreenH = Math.floor(screen.height / 4);
  const iconLiftY = heroSplashInlineActive ? -quarterScreenH * heroPanT : 0;
  const iconBaseY = searchLayoutActive
    ? searchGridSafeTop +
      (searchGridVerticalBudget - (iconH + titleStackBelowIcons)) / 2
    : screen.height / 2 - iconH / 2 + iconLiftY;
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

  if (editRichDetailsApp) {
    return (
      <EditApp
        app={editRichDetailsApp}
        installedAppsForPersistence={rawApps}
        onClose={() => setEditRichDetailsApp(null)}
      />
    );
  }

  const settingsBtnCenterX = screen.width - 62 - TOP_RIGHT_CLOCK_PUSH_PX;
  const settingsBtnCenterY = HOME_TOP_BAR_ROW_CENTER_Y;
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
  const searchIconSize = 44;
  const searchIconX = globeIconX - topBarIconGap - searchIconSize;
  const searchIconY = settingsBtnCenterY - searchIconSize / 2;
  const searchBarLeft =
    cornerIconX + cornerIconSize + topBarIconGap + SEARCH_BAR_SIDE_PADDING;
  const searchBarRight = searchIconX - 8 - SEARCH_BAR_SIDE_PADDING;
  const searchBarWidth = Math.max(0, searchBarRight - searchBarLeft);
  const searchBarHeight = HOME_SEARCH_BAR_HEIGHT_PX;
  const searchBarY = settingsBtnCenterY - searchBarHeight / 2;

  const navCenterLabel =
    appCount > 0 ? `${selectedIndex + 1} / ${appCount}` : undefined;
  const searchFieldLocksNavigation = focusArea === "searchInput";

  return (
    <>
      <Rect
        x={0}
        y={0}
        width={screen.width}
        height={screen.height}
        fill={COLORS.background}
      />

      {!heroSplashInlineActive && (
        <DigitalClock
          x={screen.width - GRID_SIDE_MARGIN - TOP_RIGHT_CLOCK_SCREEN_INSET_PX}
          y={settingsBtnCenterY}
          fontSize={26}
        />
      )}

      {heroSplashInlineActive && selectedApp && (
        <HeroSplash
          panT={heroPanT}
          app={selectedApp}
          fetchState={fetchState}
          heroInlineSubFocus={heroInlineSubFocus}
          heroTrailerIndex={heroTrailerIndex}
          heroActionIndex={heroActionIndex}
          onPlayGame={onHeroPlayGame}
          onEditInfo={onHeroEditInfo}
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

      {!heroSplashInlineActive && searchBarVisible && (
        <SearchBar
          x={searchBarLeft}
          y={searchBarY}
          width={searchBarWidth}
          height={searchBarHeight}
          query={searchQuery}
          visible
          inputFocused={focusArea === "searchInput"}
          fontSize={
            focusArea === "searchInput"
              ? SEARCH_BAR_FONT_SEARCH_INPUT_PX
              : SEARCH_BAR_FONT_DEFAULT_PX
          }
          displayMaxChars={
            focusArea === "searchInput"
              ? SEARCH_BAR_DISPLAY_MAX_CHARS_SEARCH_INPUT
              : SEARCH_BAR_DISPLAY_MAX_CHARS_DEFAULT
          }
          onBarPress={onSearchBarPress}
        />
      )}

      {!heroSplashInlineActive &&
        searchIconDefaultSrc &&
        searchIconFocusedSrc && (
          <Image
            src={
              focusArea === "search" || focusArea === "searchInput"
                ? searchIconFocusedSrc
                : searchIconDefaultSrc
            }
            x={searchIconX}
            y={searchIconY}
            width={searchIconSize}
            height={searchIconSize}
          />
        )}
      {!heroSplashInlineActive && searchIconDefaultSrc && (
        <Rect
          x={searchIconX + searchIconSize / 2 - 28}
          y={searchIconY + searchIconSize / 2 - 28}
          width={56}
          height={56}
          fill="transparent"
          onTouchStart={onSearchIconTouch}
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
          onTouchStart={() => {
            if (!searchFieldLocksNavigation) openSwitchWebApplet();
          }}
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
          onTouchStart={() => {
            if (!searchFieldLocksNavigation) setShowAlbum(true);
          }}
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
          onTouchStart={() => {
            if (!searchFieldLocksNavigation) setShowSettings(true);
          }}
        />
      )}

      {appsForGrid.map((app, i) => {
        const baseX = i * (iconW + GRID_GAP);
        const renderX = gridViewportX + baseX - scrollX;

        const appIconSelected =
          focusArea === "apps" &&
          i === selectedIndex &&
          (!heroSplashInlineOpen ||
            (heroInlineSubFocus !== "trailers" &&
              heroInlineSubFocus !== "actions"));
        const focusScaleSlopX =
          (iconW * (APP_ICON_SELECTED_FOCUS_SCALE - 1)) / 2;
        const cullSlopX = appIconSelected ? focusScaleSlopX : 0;
        if (
          renderX + iconW + cullSlopX < gridViewportX ||
          renderX - cullSlopX > gridViewportRight
        ) {
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
            isSelected={appIconSelected}
            focusVerticalAlign={heroSplashInlineActive ? "top" : "bottom"}
            onSelect={() => {
              if (!searchFieldLocksNavigation) handleAppSelect(i);
            }}
            showTitle={settings.showAppTitles && !heroSplashInlineActive}
            titleGapBelowIconPx={titleGapBelowIconPx}
            titleFontSize={titleFontSize}
            titleMaxChars={titleMaxChars}
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
          onPrevPage={searchFieldLocksNavigation ? () => {} : onStepPrev}
          onNextPage={searchFieldLocksNavigation ? () => {} : onStepNext}
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
