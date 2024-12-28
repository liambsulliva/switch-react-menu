import React from "react";
import { Image, Text } from "react-tela";
import { AppData } from "../types/AppData";

interface AppIconProps {
  displayedApp: AppData;
  truncate: (str: string, maxLength: number) => string;
}

export function AppIcon({ displayedApp, truncate }: AppIconProps) {
  return (
    <>
      {displayedApp.app.icon && (
        <Image
          src={URL.createObjectURL(new Blob([displayedApp.app.icon]))}
          x={displayedApp.x}
          y={displayedApp.y}
          width={displayedApp.width}
          height={displayedApp.height}
          onTouchStart={() => displayedApp.app.launch()}
        />
      )}
      <Text
        x={displayedApp.x + displayedApp.width / 2}
        y={displayedApp.y + displayedApp.height + 20}
        fill="white"
        fontSize={24}
        textAlign="center"
      >
        {truncate(displayedApp.app.name, 17)}
      </Text>
    </>
  );
}
