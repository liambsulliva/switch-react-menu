import React, { useEffect, useMemo, useState } from "react";
import { Image, Rect } from "react-tela";
import { AppData } from "../types/AppData";
import { truncate } from "../lib/truncate";
import { AppIcon } from "../components/AppIcon";
import { AppDetailsPane } from "../components/AppDetailsPane";
import { Navigation } from "../components/Navigation";
import { AlbumPage } from "./AlbumPage";
import { CustomSortMode } from "./CustomSortMode";
import { SettingsMenu } from "./SettingsMenu";
import {
  getAlbumIconPng,
  getCornerIconPng,
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
import { COLORS } from "../lib/colors";

export function GridHome() {
  const settings = useSettings();
  const customOrder = useCustomOrder();
  const lastPlayedId = useLastPlayedApplicationId();
  const [rawApps, setRawApps] = useState<AppData[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [focusArea, setFocusArea] = useState<GridHomeFocusArea>("apps");
  const [selectedNavButton, setSelectedNavButton] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [showAlbum, setShowAlbum] = useState(false);
  const [showCustomSort, setShowCustomSort] = useState(false);
  const [detailsApp, setDetailsApp] = useState<Switch.Application | null>(
    null,
  );
  const [cornerIconSrc, setCornerIconSrc] = useState<string | null>(null);
  const [settingsCogDefaultSrc, setSettingsCogDefaultSrc] = useState<
    string | null
  >(null);
  const [settingsCogFocusedSrc, setSettingsCogFocusedSrc] = useState<
    string | null
  >(null);
  const [albumIconDefaultSrc, setAlbumIconDefaultSrc] = useState<
    string | null
  >(null);
  const [albumIconFocusedSrc, setAlbumIconFocusedSrc] = useState<
    string | null
  >(null);
  const gap = 48;

  const apps = useMemo(() => {
    if (settings.alphabeticalSort) {
      return [...rawApps].sort((a, b) =>
        a.app.name.localeCompare(b.app.name, undefined, {
          sensitivity: "base",
        }),
      );
    }
    if (customOrder.length > 0) {
      const orderMap = new Map(customOrder.map((id, i) => [id, i]));
      return [...rawApps].sort((a, b) => {
        const ai = orderMap.get(a.app.id.toString()) ?? Infinity;
        const bi = orderMap.get(b.app.id.toString()) ?? Infinity;
        return ai - bi;
      });
    }
    return rawApps;
  }, [rawApps, settings.alphabeticalSort, customOrder]);

  const calculateItemsPerPage = (firstItemWidth: number) => {
    return Math.floor((screen.width - gap) / (firstItemWidth + gap));
  };

  useEffect(() => {
    const loadApps = async () => {
      const switchApps = Array.from(Switch.Application).filter(
        (app) => app.icon,
      );
      const displayedApps: AppData[] = [];

      let x = gap;
      const y = screen.height / 2 - 128;

      for (const app of switchApps) {
        let img;
        if (app.icon) {
          img = await createImageBitmap(new Blob([app.icon]));
        }
        if (!img) continue;

        displayedApps.push({
          x,
          y,
          width: img.width,
          height: img.height,
          app,
        });

        x += img.width + gap;
      }

      setRawApps(displayedApps);
    };

    loadApps();
  }, []);

  useEffect(() => {
    let active = true;

    Promise.all([
      getCornerIconPng(COLORS.gray[0]),
      getAlbumIconPng(COLORS.gray[400]),
      getAlbumIconPng(COLORS.gray[0]),
      getSettingsCogPng(COLORS.gray[400]),
      getSettingsCogPng(COLORS.gray[0]),
    ]).then(
      ([corner, albumDefault, albumFocused, settingsDefault, settingsFocused]) => {
        if (!active) return;
        setCornerIconSrc(corner);
        setAlbumIconDefaultSrc(albumDefault);
        setAlbumIconFocusedSrc(albumFocused);
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
        a.app.name.localeCompare(b.app.name, undefined, {
          sensitivity: "base",
        }),
      )
      .map((app) => app.app.id.toString());
    setCustomOrder(alphabeticalOrder);
  }, [settings.alphabeticalSort, rawApps]);

  const itemsPerPage =
    apps.length > 0 ? calculateItemsPerPage(apps[0].width) : 0;
  const totalPages =
    itemsPerPage > 0 ? Math.ceil(apps.length / itemsPerPage) : 0;
  const paginatedApps = apps.slice(
    currentPage * itemsPerPage,
    (currentPage + 1) * itemsPerPage,
  );

  useEffect(() => {
    if (totalPages === 0) {
      if (currentPage !== 0) setCurrentPage(0);
      if (selectedIndex !== 0) setSelectedIndex(0);
      return;
    }
    if (currentPage >= totalPages) {
      setCurrentPage(totalPages - 1);
    }
  }, [totalPages, currentPage, selectedIndex]);

  const handlePrevPage = () => {
    if (totalPages <= 1) return;
    setCurrentPage((prev) => (prev > 0 ? prev - 1 : totalPages - 1));
  };

  const handleNextPage = () => {
    if (totalPages <= 1) return;
    setCurrentPage((prev) => (prev < totalPages - 1 ? prev + 1 : 0));
  };

  const rowInnerWidth =
    paginatedApps.reduce((sum, app) => sum + app.width, 0) +
    Math.max(0, paginatedApps.length - 1) * gap;
  const rowStartX =
    paginatedApps.length === 0 ? 0 : (screen.width - rowInnerWidth) / 2;

  let rowX = rowStartX;
  const visibleApps = paginatedApps.map((app) => {
    const placed = { ...app, x: rowX };
    rowX += app.width + gap;
    return placed;
  });
  const visibleAppSlots = Array.from({ length: visibleApps.length }, (_, index) => {
    return visibleApps[index];
  });

  useGamepadNavigation({
    onPrevPage: handlePrevPage,
    onNextPage: handleNextPage,
    setSelectedIndex,
    paginatedApps,
    selectedIndex,
    focusArea,
    setFocusArea,
    navButtonIndex: selectedNavButton,
    setNavButtonIndex: setSelectedNavButton,
    isActive: !showSettings && !showCustomSort && !detailsApp && !showAlbum,
    onOpenSettings: () => setShowSettings(true),
    onOpenAlbum: () => setShowAlbum(true),
    onMinus: () => {
      const app = paginatedApps[selectedIndex]?.app;
      if (app) setDetailsApp(app);
    },
  });

  const handleAppSelect = (index: number) => {
    const selectedApp = paginatedApps[index];
    if (!selectedApp) return;
    if (index === selectedIndex) {
      const app = selectedApp.app;
      recordLastPlayed(app);
      app.launch();
    } else {
      setSelectedIndex(index);
    }
  };

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
        apps={apps.map((a) => a.app)}
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
  /** Top-right row: album sits immediately left of the settings cog. */
  const albumIconX = settingsCogLeft - topBarIconGap - albumIconSize;
  const albumIconY = settingsBtnCenterY - albumIconSize / 2;
  const albumIconHitW = 56;
  const albumIconHitH = 56;
  const cornerIconSize = 48;
  const cornerIconX = 32;
  const cornerIconY = settingsBtnCenterY - cornerIconSize / 2;

  return (
    <>
      <Rect
        x={0}
        y={0}
        width={screen.width}
        height={screen.height}
        fill={COLORS.background}
      />

      {cornerIconSrc && (
        <Image
          src={cornerIconSrc}
          x={cornerIconX}
          y={cornerIconY}
          width={cornerIconSize}
          height={cornerIconSize}
        />
      )}

      {albumIconDefaultSrc && albumIconFocusedSrc && (
        <Image
          src={
            focusArea === "album"
              ? albumIconFocusedSrc
              : albumIconDefaultSrc
          }
          x={albumIconX}
          y={albumIconY}
          width={albumIconSize}
          height={albumIconSize}
        />
      )}
      <Rect
        x={albumIconX + albumIconSize / 2 - albumIconHitW / 2}
        y={albumIconY + albumIconSize / 2 - albumIconHitH / 2}
        width={albumIconHitW}
        height={albumIconHitH}
        fill="transparent"
        onTouchStart={() => setShowAlbum(true)}
      />

      {settingsCogDefaultSrc && settingsCogFocusedSrc && (
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
      <Rect
        x={settingsBtnCenterX - settingsBtnW / 2}
        y={settingsBtnCenterY - settingsBtnH / 2}
        width={settingsBtnW}
        height={settingsBtnH}
        fill="transparent"
        onTouchStart={() => setShowSettings(true)}
      />

      {visibleAppSlots.map((displayedApp, index) => (
        <AppIcon
          key={`app-slot-${index}`}
          displayedApp={displayedApp}
          truncate={truncate}
          isSelected={focusArea === "apps" && index === selectedIndex}
          onSelect={() => handleAppSelect(index)}
          showTitle={settings.showAppTitles}
          showLastPlayedEyebrow={
            settings.showLastPlayed &&
            lastPlayedId !== null &&
            displayedApp.app.id.toString() === lastPlayedId
          }
        />
      ))}
      <Navigation
        currentPage={currentPage}
        totalPages={totalPages}
        onPrevPage={handlePrevPage}
        onNextPage={handleNextPage}
        isNavigationFocused={focusArea === "navigation"}
        selectedNavButton={selectedNavButton}
        showPageNumbers={settings.showPageNumbers}
      />

      {detailsApp && (
        <AppDetailsPane app={detailsApp} onClose={() => setDetailsApp(null)} />
      )}
    </>
  );
}
