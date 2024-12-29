import React from "react";
import { Image, Text } from "react-tela";
import { AppData } from "../types/AppData";

interface AppIconProps {
  displayedApp: AppData;
  truncate: (str: string, maxLength: number) => string;
  isSelected?: boolean;
}

export function AppIcon({ displayedApp, truncate, isSelected }: AppIconProps) {
  return (
    <>
      {displayedApp.app.icon && (
        <>
          {isSelected && (
            <rect
              x={displayedApp.x - 5}
              y={displayedApp.y - 5}
              width={displayedApp.width + 10}
              height={displayedApp.height + 10}
              fill="none"
              stroke="white"
              strokeWidth={2}
            />
          )}
          <Image
            src={URL.createObjectURL(new Blob([displayedApp.app.icon]))}
            x={displayedApp.x}
            y={displayedApp.y}
            width={displayedApp.width}
            height={displayedApp.height}
            onTouchStart={() => displayedApp.app.launch()}
          />
        </>
      )}
      <Text
        x={displayedApp.x + displayedApp.width / 2}
        y={displayedApp.y + displayedApp.height + 20}
        fill={isSelected ? "#00ff00" : "white"}
        fontSize={24}
        textAlign="center"
      >
        {truncate(displayedApp.app.name, 17)}
      </Text>
    </>
  );
}
