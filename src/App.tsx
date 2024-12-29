import React, { useEffect, useState } from "react";
import { Rect } from "react-tela";
import { AppData } from "./types/AppData";
import { truncate } from "./lib/truncate";
import { AppIcon } from "./components/AppIcon";
import { Navigation } from "./components/Navigation";
import { useGamepadNavigation } from "./hooks/useGamepadNavigation";

export function App() {
  const [apps, setApps] = useState<AppData[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const gap = 48;

  const calculateItemsPerPage = (firstItemWidth: number) => {
    return Math.floor((screen.width - gap) / (firstItemWidth + gap));
  };

  useEffect(() => {
    const loadApps = async () => {
      const switchApps = Array.from(Switch.Application).filter(
        (app) => app.icon
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

      setApps(displayedApps);
    };

    loadApps();
  }, []);

  const itemsPerPage =
    apps.length > 0 ? calculateItemsPerPage(apps[0].width) : 0;
  const totalPages = Math.ceil(apps.length / itemsPerPage);
  const paginatedApps = apps.slice(
    currentPage * itemsPerPage,
    (currentPage + 1) * itemsPerPage
  );

  const handlePrevPage = () => {
    setCurrentPage((prev) => (prev > 0 ? prev - 1 : totalPages - 1));
  };

  const handleNextPage = () => {
    setCurrentPage((prev) => (prev < totalPages - 1 ? prev + 1 : 0));
  };

  const visibleApps = paginatedApps.map((app, index) => ({
    ...app,
    x: gap + index * (app.width + gap),
  }));

  useGamepadNavigation({
    onPrevPage: handlePrevPage,
    onNextPage: handleNextPage,
    setSelectedIndex,
    paginatedApps,
    selectedIndex,
  });

  return (
    <>
      <Rect
        x={0}
        y={0}
        width={screen.width}
        height={screen.height}
        fill="#0f0f0f"
      />
      {visibleApps.map((displayedApp, index) => (
        <AppIcon
          key={index}
          displayedApp={displayedApp}
          truncate={truncate}
          isSelected={index === selectedIndex}
        />
      ))}
      <Navigation
        currentPage={currentPage}
        totalPages={totalPages}
        onPrevPage={handlePrevPage}
        onNextPage={handleNextPage}
      />
    </>
  );
}
