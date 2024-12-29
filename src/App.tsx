import React, { useEffect, useState } from "react";
import { Text } from "react-tela";
import { AppIcon } from "./components/AppIcon";
import { AppData } from "./types/AppData";
import { truncate } from "./lib/truncate";
import { Button } from "@nx.js/constants";

export function App() {
  const [apps, setApps] = useState<AppData[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [shouldersPressed, setShouldersPressed] = useState({
    L: false,
    R: false,
  });
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

  useEffect(() => {
    let animationFrameId: number;

    const handleGamepadInput = () => {
      const gamepad = navigator.getGamepads()[0];
      if (!gamepad) {
        return;
      }

      if (gamepad.buttons[Button.L].pressed && !shouldersPressed.L) {
        setShouldersPressed((prev) => ({ ...prev, L: true }));
        handlePrevPage();
      } else if (!gamepad.buttons[Button.L].pressed && shouldersPressed.L) {
        setShouldersPressed((prev) => ({ ...prev, L: false }));
      }

      if (gamepad.buttons[Button.R].pressed && !shouldersPressed.R) {
        setShouldersPressed((prev) => ({ ...prev, R: true }));
        handleNextPage();
      } else if (!gamepad.buttons[Button.R].pressed && shouldersPressed.R) {
        setShouldersPressed((prev) => ({ ...prev, R: false }));
      }

      const horizontalInput =
        Math.abs(gamepad.axes[0]) > 0.5
          ? Math.sign(gamepad.axes[0])
          : gamepad.buttons[Button.Left].pressed
          ? -1
          : gamepad.buttons[Button.Right].pressed
          ? 1
          : 0;

      if (horizontalInput !== 0) {
        setSelectedIndex((prev) => {
          const newIndex = prev + horizontalInput;
          if (newIndex < 0) {
            handlePrevPage();
            return paginatedApps.length - 1;
          }
          if (newIndex >= paginatedApps.length) {
            handleNextPage();
            return 0;
          }
          return newIndex;
        });
      }

      if (gamepad.buttons[Button.A].pressed && visibleApps[selectedIndex]) {
        visibleApps[selectedIndex].app.launch();
      }

      animationFrameId = requestAnimationFrame(handleGamepadInput);
    };

    animationFrameId = requestAnimationFrame(handleGamepadInput);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [
    shouldersPressed,
    totalPages,
    paginatedApps.length,
    selectedIndex,
    visibleApps,
  ]);

  return (
    <>
      {visibleApps.map((displayedApp, index) => (
        <AppIcon
          key={index}
          displayedApp={displayedApp}
          truncate={truncate}
          isSelected={index === selectedIndex}
        />
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
