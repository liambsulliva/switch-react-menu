import React from "react";
import { Image, Text, Rect } from "react-tela";
import { COLORS } from "../lib/colors";

interface AppIconProps {
  app: Switch.Application;
  x: number;
  y: number;
  width: number;
  height: number;
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
  app,
  x,
  y,
  width,
  height,
  truncate,
  isSelected,
  onSelect,
  showTitle = true,
  showLastPlayedEyebrow = false,
}: AppIconProps) {
  const iconBottom = y + height;

  return (
    <>
      {showLastPlayedEyebrow && (
        <Text
          x={x}
          y={y - 6}
          fill={COLORS.eyebrowLabel}
          fontSize={16}
          fontFamily="SourceSansPro-Bold"
          textAlign="left"
          textBaseline="bottom"
        >
          Last Played!
        </Text>
      )}
      {app.icon && (
        <>
          {isSelected && (
            <Rect
              x={x - 5}
              y={y - 5}
              width={width + 10}
              height={height + 10}
              fill="none"
              stroke={COLORS.gray[0]}
              lineWidth={5}
            />
          )}
          <Image
            src={getIconUrl(app, app.icon)}
            x={x}
            y={y}
            width={width}
            height={height}
            onTouchStart={onSelect}
          />
        </>
      )}
      {showTitle && (
        <Text
          x={x + width / 2}
          y={iconBottom + 20}
          fill={isSelected ? COLORS.gray[0] : COLORS.gray[200]}
          fontSize={24}
          fontFamily={
            isSelected ? "SourceSansPro-Bold" : "SourceSansPro-Regular"
          }
          textAlign="center"
        >
          {truncate(app.name, 17)}
        </Text>
      )}
    </>
  );
}
