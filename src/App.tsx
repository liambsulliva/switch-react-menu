import React, { useEffect, useMemo, useState } from "react";
import { Image, Rect, Text } from "react-tela";
import { AppData } from "./types/AppData";
import { truncate } from "./lib/truncate";
import { AppIcon } from "./components/AppIcon";
import { CompactHome } from "./components/CompactHome";
import { Navigation } from "./components/Navigation";
import { SettingsMenu } from "./components/SettingsMenu";
import { getCornerIconPng, getSettingsCogPng } from "./lib/iconPng";
import { useGamepadNavigation } from "./hooks/useGamepadNavigation";
import {
  recordLastPlayed,
  useLastPlayedApplicationId,
} from "./settings/lastPlayedStore";
import { useSettings } from "./settings/settingsStore";

export function App() {
  const settings = useSettings();

  if (settings.compactView) {
    return <CompactHome />;
  }

  return <GridHome />;
}

function GridHome() {
  const settings = useSettings();
  const lastPlayedId = useLastPlayedApplicationId();
  const [rawApps, setRawApps] = useState<AppData[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [focusArea, setFocusArea] = useState<
    "apps" | "navigation" | "settings"
  >("apps");
  const [selectedNavButton, setSelectedNavButton] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [cornerIconSrc, setCornerIconSrc] = useState<string | null>(null);
  const [settingsCogDefaultSrc, setSettingsCogDefaultSrc] = useState<
    string | null
  >(null);
  const [settingsCogFocusedSrc, setSettingsCogFocusedSrc] = useState<
    string | null
  >(null);
  const gap = 48;

  const apps = useMemo(() => {
    if (!settings.alphabeticalSort) {
      return rawApps;
    }
    return [...rawApps].sort((a, b) =>
      a.app.name.localeCompare(b.app.name, undefined, { sensitivity: "base" }),
    );
  }, [rawApps, settings.alphabeticalSort]);

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
      getCornerIconPng("#fff"),
      getSettingsCogPng("#666"),
      getSettingsCogPng("#fff"),
    ]).then(([corner, settingsDefault, settingsFocused]) => {
      if (!active) return;
      setCornerIconSrc(corner);
      setSettingsCogDefaultSrc(settingsDefault);
      setSettingsCogFocusedSrc(settingsFocused);
    });

    return () => {
      active = false;
    };
  }, []);

  const itemsPerPage =
    apps.length > 0 ? calculateItemsPerPage(apps[0].width) : 0;
  const totalPages = Math.ceil(apps.length / itemsPerPage);
  const paginatedApps = apps.slice(
    currentPage * itemsPerPage,
    (currentPage + 1) * itemsPerPage,
  );

  const handlePrevPage = () => {
    setCurrentPage((prev) => (prev > 0 ? prev - 1 : totalPages - 1));
  };

  const handleNextPage = () => {
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
    isActive: !showSettings,
    onOpenSettings: () => setShowSettings(true),
  });

  const handleAppSelect = (index: number) => {
    if (index === selectedIndex) {
      const app = paginatedApps[selectedIndex].app;
      recordLastPlayed(app);
      app.launch();
    } else {
      setSelectedIndex(index);
    }
  };

  if (showSettings) {
    return <SettingsMenu onClose={() => setShowSettings(false)} />;
  }

  // Settings button layout constants
  const settingsBtnCenterX = screen.width - 62;
  const settingsBtnCenterY = 50;
  const settingsBtnW = 80;
  const settingsBtnH = 58;
  const settingsCogSize = 36;
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
        fill="#0f0f0f"
      />

      {/* Settings button — top right */}
      {settingsCogDefaultSrc && settingsCogFocusedSrc && (
        <Image
          src={
            focusArea === "settings"
              ? settingsCogFocusedSrc
              : settingsCogDefaultSrc
          }
          x={settingsBtnCenterX - settingsCogSize / 2}
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
      {cornerIconSrc && (
        <Image
          src={cornerIconSrc}
          x={cornerIconX}
          y={cornerIconY}
          width={cornerIconSize}
          height={cornerIconSize}
        />
      )}

      {visibleApps.map((displayedApp, index) => (
        <AppIcon
          key={displayedApp.app.id.toString()}
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
    </>
  );
}
