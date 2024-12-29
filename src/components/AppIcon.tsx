import React from "react";
import { Image, Text, Rect } from "react-tela";
import { AppData } from "../types/AppData";

interface AppIconProps {
  displayedApp: AppData;
  truncate: (str: string, maxLength: number) => string;
  isSelected?: boolean;
  onSelect: () => void;
}

export function AppIcon({
  displayedApp,
  truncate,
  isSelected,
  onSelect,
}: AppIconProps) {
  return (
    <>
      {displayedApp.app.icon && (
        <>
          {isSelected && (
            <Rect
              x={displayedApp.x - 5}
              y={displayedApp.y - 5}
              width={displayedApp.width + 10}
              height={displayedApp.height + 10}
              fill="none"
              stroke="white"
              lineWidth={5}
            />
          )}
          <Image
            src={URL.createObjectURL(new Blob([displayedApp.app.icon]))}
            x={displayedApp.x}
            y={displayedApp.y}
            width={displayedApp.width}
            height={displayedApp.height}
            onTouchStart={onSelect}
          />
        </>
      )}
      <Text
        x={displayedApp.x + displayedApp.width / 2}
        y={displayedApp.y + displayedApp.height + 20}
        fill={isSelected ? "white" : "#ddd"}
        fontSize={24}
        fontFamily={isSelected ? "SourceSansPro-Bold" : "SourceSansPro-Regular"}
        textAlign="center"
      >
        {truncate(displayedApp.app.name, 17)}
      </Text>
    </>
  );
}
