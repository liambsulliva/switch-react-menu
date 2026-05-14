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
  onBarPress,
}: SearchBarProps) {
  if (!visible || width <= 0) return null;

  const display = query.trim() ? query : "Search…";
  const displayColor = query.trim() ? COLORS.gray[0] : COLORS.gray[500];
  const fill = inputFocused ? COLORS.rowSelectedBg : COLORS.gray[800];
  const stroke = inputFocused ? COLORS.gray[0] : COLORS.gray[600];
  const strokeW = inputFocused ? 2 : 1;

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
        fontSize={22}
        fontFamily="SourceSansPro-Regular"
        textBaseline="middle"
      >
        {display.length > 42 ? `${display.slice(0, 39)}…` : display}
      </Text>
    </>
  );
}
