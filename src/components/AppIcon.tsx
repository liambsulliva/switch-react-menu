import React from "react";
import { Image, Text, Rect } from "react-tela";
import { COLORS } from "../lib/colors";

export const APP_ICON_SELECTED_FOCUS_SCALE = 1.08;
const SELECTED_ICON_SCALE = APP_ICON_SELECTED_FOCUS_SCALE;

export type AppIconFocusVerticalAlign = "bottom" | "top";

interface AppIconProps {
  app: Switch.Application;
  x: number;
  y: number;
  width: number;
  height: number;
  truncate: (str: string, maxLength: number) => string;
  isSelected?: boolean;
  focusVerticalAlign?: AppIconFocusVerticalAlign;
  onSelect: () => void;
  showTitle?: boolean;
  titleGapBelowIconPx?: number;
  titleFontSize?: number;
  titleMaxChars?: number;
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
  focusVerticalAlign = "bottom",
  onSelect,
  showTitle = true,
  titleGapBelowIconPx = 20,
  titleFontSize = 24,
  titleMaxChars = 17,
  showLastPlayedEyebrow = false,
}: AppIconProps) {
  const scale = isSelected ? SELECTED_ICON_SCALE : 1;
  const drawW = width * scale;
  const drawH = height * scale;
  const drawX = x + (width - drawW) / 2;
  const drawY =
    isSelected && focusVerticalAlign === "top"
      ? y
      : isSelected && focusVerticalAlign === "bottom"
        ? y + height - drawH
        : y;

  const iconBottom = y + height;
  const selectionPad = 5;
  const focusFrame =
    isSelected
      ? {
          x: drawX - selectionPad,
          y: drawY - selectionPad,
          w: drawW + selectionPad * 2,
          h: drawH + selectionPad * 2,
        }
      : null;
  const eyebrowX = (focusFrame?.x ?? drawX) - (isSelected ? 3 : 0);
  const eyebrowY = (focusFrame?.y ?? drawY) - (isSelected ? 3 : 0);
  

  return (
    <>
      {showLastPlayedEyebrow && (
        <Text
          x={eyebrowX}
          y={eyebrowY}
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
          {focusFrame && (
            <Rect
              x={focusFrame.x}
              y={focusFrame.y}
              width={focusFrame.w}
              height={focusFrame.h}
              fill="none"
              stroke={COLORS.gray[0]}
              lineWidth={5}
            />
          )}
          <Image
            src={getIconUrl(app, app.icon)}
            x={focusFrame?.x ?? drawX}
            y={focusFrame?.y ?? drawY}
            width={focusFrame?.w ?? drawW}
            height={focusFrame?.h ?? drawH}
            onTouchStart={onSelect}
          />
        </>
      )}
      {showTitle && (
        <Text
          x={x + width / 2}
          y={iconBottom + titleGapBelowIconPx}
          fill={isSelected ? COLORS.gray[0] : COLORS.gray[200]}
          fontSize={titleFontSize}
          fontFamily={
            isSelected ? "SourceSansPro-Bold" : "SourceSansPro-Regular"
          }
          textAlign="center"
        >
          {truncate(app.name, titleMaxChars)}
        </Text>
      )}
    </>
  );
}
