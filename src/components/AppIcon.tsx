import React from "react";
import { Image, Text, Rect } from "react-tela";
import { AppData } from "../types/AppData";
import { COLORS } from "../lib/colors";

interface AppIconProps {
  displayedApp: AppData;
  truncate: (str: string, maxLength: number) => string;
  isSelected?: boolean;
  onSelect: () => void;
  showTitle?: boolean;
  showLastPlayedEyebrow?: boolean;
}

const iconUrlCache = new Map<string, string>();

function getIconUrl(app: { id: bigint }, icon: ArrayBuffer): string {
  const key = app.id.toString();
  let url = iconUrlCache.get(key);
  if (!url) {
    url = URL.createObjectURL(new Blob([icon]));
    iconUrlCache.set(key, url);
  }
  return url;
}

export function AppIcon({
  displayedApp,
  truncate,
  isSelected,
  onSelect,
  showTitle = true,
  showLastPlayedEyebrow = false,
}: AppIconProps) {
  const iconBottom = displayedApp.y + displayedApp.height;

  return (
    <>
      {showLastPlayedEyebrow && (
        <Text
          x={displayedApp.x}
          y={displayedApp.y - 6}
          fill={COLORS.eyebrowLabel}
          fontSize={16}
          fontFamily="SourceSansPro-Bold"
          textAlign="left"
          textBaseline="bottom"
        >
          Last Played!
        </Text>
      )}
      {displayedApp.app.icon && (
        <>
          {isSelected && (
            <Rect
              x={displayedApp.x - 5}
              y={displayedApp.y - 5}
              width={displayedApp.width + 10}
              height={displayedApp.height + 10}
              fill="none"
              stroke={COLORS.gray[0]}
              lineWidth={5}
            />
          )}
          <Image
            src={getIconUrl(displayedApp.app, displayedApp.app.icon)}
            x={displayedApp.x}
            y={displayedApp.y}
            width={displayedApp.width}
            height={displayedApp.height}
            onTouchStart={onSelect}
          />
        </>
      )}
      {showTitle && (
        <Text
          x={displayedApp.x + displayedApp.width / 2}
          y={iconBottom + 20}
          fill={isSelected ? COLORS.gray[0] : COLORS.gray[200]}
          fontSize={24}
          fontFamily={
            isSelected ? "SourceSansPro-Bold" : "SourceSansPro-Regular"
          }
          textAlign="center"
        >
          {truncate(displayedApp.app.name, 17)}
        </Text>
      )}
    </>
  );
}
