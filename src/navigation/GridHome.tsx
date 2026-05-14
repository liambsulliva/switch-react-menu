import React, { useCallback, useEffect, useMemo, useState } from "react";
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
} from "../hooks/useGamepadNavigation";
import {
  recordLastPlayed,
  useLastPlayedApplicationId,
} from "../settings/lastPlayedStore";
import { setSettings, useSettings } from "../settings/settingsStore";
import { setCustomOrder, useCustomOrder } from "../settings/customSortStore";
import { useHiddenGameIdSet } from "../settings/hiddenGamesStore";
import { COLORS } from "../lib/colors";
import { IgdbPs5HeroBackdrop } from "../components/IgdbPs5HeroBackdrop";
import { useIgdbInlineExperience } from "../hooks/useIgdbInlineExperience";
import { easeOutDetailEntrance } from "../lib/easing";

const GRID_HOME_WEB_APPLET_URL = "https://google.com";

const GRID_GAP = 48;
const GRID_ICON_SIZE = 256;
const GRID_SIDE_MARGIN = 24;

function openSwitchWebApplet(url: string = GRID_HOME_WEB_APPLET_URL) {
  void (async () => {
    const applet = new Switch.WebApplet(url);
    await applet.start({ jsExtension: true });
  })();
}

export function GridHome() {
  const settings = useSettings();
  const customOrder = useCustomOrder();
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
  const [inlineIgdbOpen, setInlineIgdbOpen] = useState(false);
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

  const sortedApps = useMemo(() => {
    if (settings.alphabeticalSort) {
      return [...rawApps].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, {
          sensitivity: "base",
        }),
      );
    }
    if (customOrder.length > 0) {
      const orderMap = new Map(customOrder.map((id, i) => [id, i]));
      return [...rawApps].sort((a, b) => {
        const ai = orderMap.get(a.id.toString()) ?? Infinity;
        const bi = orderMap.get(b.id.toString()) ?? Infinity;
        return ai - bi;
      });
    }
    return rawApps;
  }, [rawApps, settings.alphabeticalSort, customOrder]);

  const apps = useMemo(
    () => sortedApps.filter((a) => !hiddenGameIds.has(a.id.toString())),
    [sortedApps, hiddenGameIds],
  );

  const appCount = apps.length;

  const gridViewportWidth = screen.width - GRID_SIDE_MARGIN * 2;
  const gridViewportX = GRID_SIDE_MARGIN;
  const gridViewportRight = gridViewportX + gridViewportWidth;

  const jumpStep = useMemo(
    () =>
      Math.max(1, Math.floor(gridViewportWidth / (GRID_ICON_SIZE + GRID_GAP))),
    [gridViewportWidth],
  );

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
    if (!settings.alphabeticalSort) return;
    const alphabeticalOrder = [...rawApps]
      .sort((a, b) =>
        a.name.localeCompare(b.name, undefined, {
          sensitivity: "base",
        }),
      )
      .map((app) => app.id.toString());
    setCustomOrder(alphabeticalOrder);
  }, [settings.alphabeticalSort, rawApps]);

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
    if (!settings.igdbInlineGridDetails) {
      setInlineIgdbOpen(false);
    }
  }, [settings.igdbInlineGridDetails]);

  useEffect(() => {
    if (settings.igdbInlineGridDetails && focusArea === "navigation") {
      setFocusArea("apps");
    }
  }, [settings.igdbInlineGridDetails, focusArea]);

  const onStepPrev = useCallback(() => {
    setSelectedIndex((i) => Math.max(0, i - 1));
  }, []);

  const onStepNext = useCallback(() => {
    setSelectedIndex((i) => Math.min(Math.max(0, appCount - 1), i + 1));
  }, [appCount]);

  const openInlineIgdb = useCallback(() => setInlineIgdbOpen(true), []);
  const closeInlineIgdb = useCallback(() => setInlineIgdbOpen(false), []);

  const selectedApp = appCount > 0 ? (apps[selectedIndex] ?? null) : null;
  const igdbInlineActive =
    settings.igdbInlineGridDetails && inlineIgdbOpen && selectedApp !== null;

  const { fetchState, heroImageUrl } = useIgdbInlineExperience(
    selectedApp,
    igdbInlineActive,
  );

  useEffect(() => {
    if (!igdbInlineActive) {
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
  }, [igdbInlineActive]);

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
    onMinus: () => {
      const app = apps[selectedIndex];
      if (app) setDetailsApp(app);
    },
    replaceBottomNavWithIgdb: settings.igdbInlineGridDetails,
    inlineDetailsOpen: inlineIgdbOpen,
    onOpenInlineDetails: openInlineIgdb,
    onCloseInlineDetails: closeInlineIgdb,
  });

  const handleAppSelect = (index: number) => {
    const picked = apps[index];
    if (!picked) return;
    if (index === selectedIndex) {
      recordLastPlayed(picked);
      picked.launch();
    } else {
      setSelectedIndex(index);
    }
  };

  const iconW = GRID_ICON_SIZE;
  const iconH = GRID_ICON_SIZE;
  const quarterScreenH = Math.floor(screen.height / 4);
  const iconLiftY = igdbInlineActive ? -quarterScreenH * heroPanT : 0;
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
          setSettings({ alphabeticalSort: false });
          setShowSettings(false);
          setShowCustomSort(true);
        }}
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

  const settingsBtnCenterX = screen.width - 62;
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

      {igdbInlineActive && selectedApp && (
        <IgdbPs5HeroBackdrop
          panT={heroPanT}
          imageUrl={heroImageUrl}
          app={selectedApp}
          fetchState={fetchState}
        />
      )}

      {!igdbInlineActive && cornerIconSrc && (
        <Image
          src={cornerIconSrc}
          x={cornerIconX}
          y={cornerIconY}
          width={cornerIconSize}
          height={cornerIconSize}
        />
      )}

      {!igdbInlineActive && globeIconDefaultSrc && globeIconFocusedSrc && (
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
      {!igdbInlineActive && (
        <Rect
          x={globeIconX + globeIconSize / 2 - globeIconHitW / 2}
          y={globeIconY + globeIconSize / 2 - globeIconHitH / 2}
          width={globeIconHitW}
          height={globeIconHitH}
          fill="transparent"
          onTouchStart={() => openSwitchWebApplet()}
        />
      )}

      {!igdbInlineActive && albumIconDefaultSrc && albumIconFocusedSrc && (
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
      {!igdbInlineActive && (
        <Rect
          x={albumIconX + albumIconSize / 2 - albumIconHitW / 2}
          y={albumIconY + albumIconSize / 2 - albumIconHitH / 2}
          width={albumIconHitW}
          height={albumIconHitH}
          fill="transparent"
          onTouchStart={() => setShowAlbum(true)}
        />
      )}

      {!igdbInlineActive && settingsCogDefaultSrc && settingsCogFocusedSrc && (
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
      {!igdbInlineActive && (
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
            isSelected={focusArea === "apps" && i === selectedIndex}
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

      {!settings.igdbInlineGridDetails && (
        <Navigation
          currentPage={selectedIndex}
          totalPages={appCount}
          onPrevPage={onStepPrev}
          onNextPage={onStepNext}
          isNavigationFocused={focusArea === "navigation"}
          selectedNavButton={selectedNavButton}
          showPageNumbers={settings.showPageNumbers}
          centerLabel={navCenterLabel}
        />
      )}

      {detailsApp && (
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
