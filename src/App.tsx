import React, { useEffect, useState } from "react";
import { Image, Text } from "react-tela";

interface AppData {
  x: number;
  y: number;
  width: number;
  height: number;
  app: Switch.Application;
}

export function App() {
  const [apps, setApps] = useState<AppData[]>([]);

  useEffect(() => {
    const gap = 48;
    const itemsPerPage = Math.floor((screen.height - gap * 2) / (64 + gap));
    const itemsPerRow = Math.floor((screen.width - gap) / (64 + gap));

    const loadApps = async () => {
      const switchApps = Array.from(Switch.Application).filter(
        (app) => app.icon
      );
      const displayedApps: AppData[] = [];

      let x = gap;
      let y = gap;

      for (const app of switchApps) {
        let img;
        if (app.icon) {
          img = await createImageBitmap(new Blob([app.icon]));
        }
        if (!img) continue;

        if (x + img.width >= screen.width) {
          x = gap;
          y += img.height + 40 + gap;
        }

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

  return (
    <>
      {apps.map((displayedApps, index) => (
        <React.Fragment key={index}>
          {displayedApps.app.icon && (
            <Image
              src={URL.createObjectURL(new Blob([displayedApps.app.icon]))}
              x={displayedApps.x}
              y={displayedApps.y}
              width={displayedApps.width}
              height={displayedApps.height}
              onTouchStart={() => displayedApps.app.launch()}
            />
          )}
          <Text
            x={displayedApps.x + displayedApps.width / 2}
            y={displayedApps.y + displayedApps.height + 20}
            fill="white"
            fontSize={24}
            textAlign="center"
          >
            {displayedApps.app.name}
          </Text>
        </React.Fragment>
      ))}
    </>
  );
}
