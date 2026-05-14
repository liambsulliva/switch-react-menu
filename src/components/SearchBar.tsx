import React from "react";
import { Rect, Text } from "react-tela";
import { COLORS } from "../lib/colors";

export interface SearchBarProps {
  x: number;
  y: number;
  width: number;
  height: number;
  query: string;
  visible: boolean;
  inputFocused?: boolean;
  /** Defaults to 22. */
  fontSize?: number;
  /** Max characters before ellipsis; default 42. */
  displayMaxChars?: number;
  onBarPress?: () => void;
}

export function SearchBar({
  x,
  y,
  width,
  height,
  query,
  visible,
  inputFocused = false,
  fontSize = 22,
  displayMaxChars = 42,
  onBarPress,
}: SearchBarProps) {
  if (!visible || width <= 0) return null;

  const display = query.trim() ? query : "Search…";
  const displayColor = query.trim() ? COLORS.gray[0] : COLORS.gray[500];
  const fill = inputFocused ? COLORS.rowSelectedBg : COLORS.gray[800];
  const stroke = inputFocused ? COLORS.gray[0] : COLORS.gray[600];
  const strokeW = inputFocused ? 2 : 1;
  const displayText =
    display.length > displayMaxChars
      ? `${display.slice(0, displayMaxChars - 1)}…`
      : display;

  return (
    <>
      <Rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={fill}
        stroke={stroke}
        lineWidth={strokeW}
        borderRadius={height / 2}
        onTouchStart={onBarPress}
        onClick={onBarPress}
      />
      <Text
        x={x + 20}
        y={y + height / 2}
        fill={displayColor}
        fontSize={fontSize}
        fontFamily="SourceSansPro-Regular"
        textBaseline="middle"
      >
        {displayText}
      </Text>
    </>
  );
}
