import React from "react";
import { Rect, Text } from "react-tela";
import { COLORS } from "../lib/colors";
import { truncate } from "../lib/truncate";

const GUTTER_Y = 4;

export type InputProps = {
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  value: string;
  isFocused: boolean;
  isEditing?: boolean;
  valueMaxChars?: number;
  onPress?: () => void;
  onMouseEnter?: () => void;
};

export function Input({
  x,
  y,
  width,
  height,
  label,
  value,
  isFocused,
  isEditing = false,
  valueMaxChars = 48,
  onPress,
  onMouseEnter,
}: InputProps) {
  const ring = isFocused || isEditing;
  const labelColor = ring ? COLORS.gray[0] : COLORS.gray[400];
  const valueColor = isEditing ? COLORS.accent : COLORS.gray[200];
  const display = truncate(value.replace(/\s+/g, " ").trim() || "—", valueMaxChars);

  let gutterY = GUTTER_Y;
  let innerH = height - 2 * gutterY;
  if (innerH < 36) {
    gutterY = 0;
    innerH = height;
  }
  const innerY = y + gutterY;

  return (
    <>
      {ring && (
        <Rect
          x={x - 3}
          y={innerY - 3}
          width={width + 6}
          height={innerH + 6}
          fill="none"
          stroke={COLORS.gray[0]}
          lineWidth={isEditing ? 3 : 2}
        />
      )}
      <Rect
        x={x}
        y={innerY}
        width={width}
        height={innerH}
        fill={COLORS.gray[800]}
      />
      <Text
        x={x + 12}
        y={innerY + 14}
        fill={labelColor}
        fontSize={16}
        fontFamily="SourceSansPro-Bold"
        textAlign="left"
        textBaseline="middle"
      >
        {label}
      </Text>
      <Text
        x={x + 12}
        y={innerY + innerH / 2 + 8}
        fill={valueColor}
        fontSize={20}
        fontFamily="SourceSansPro-Regular"
        textAlign="left"
        textBaseline="middle"
      >
        {display}
      </Text>
      <Rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill="transparent"
        onTouchStart={onPress}
        onMouseEnter={onMouseEnter}
      />
    </>
  );
}
