import React, { useEffect, useState } from "react";
import { Text } from "react-tela";
import { AppIcon } from "./components/AppIcon";
import { AppData } from "./types/AppData";

function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength) + "...";
}

export function App() {
  const [apps, setApps] = useState<AppData[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
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
      const y = gap;

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

  return (
    <>
      {visibleApps.map((displayedApp, index) => (
        <AppIcon key={index} displayedApp={displayedApp} truncate={truncate} />
      ))}
      <Text
        x={50}
        y={screen.height - 50}
        fill="white"
        fontSize={24}
        onTouchStart={handlePrevPage}
      >
        {"< Prev"}
      </Text>

      <Text
        x={screen.width - 50}
        y={screen.height - 50}
        fill="white"
        fontSize={24}
        textAlign="right"
        onTouchStart={handleNextPage}
      >
        {"Next >"}
      </Text>

      <Text
        x={screen.width / 2}
        y={screen.height - 50}
        fill="white"
        fontSize={24}
        textAlign="center"
      >
        {`${currentPage + 1}/${totalPages}`}
      </Text>
    </>
  );
}
