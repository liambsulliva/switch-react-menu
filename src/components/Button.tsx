import React from "react";
import { Rect, Text } from "react-tela";
import { COLORS } from "../lib/colors";

export type ButtonProps = {
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  onPress: () => void;
  isHighlighted?: boolean;
  fill?: string;
  labelFill?: string;
  ringStroke?: string;
};

export function Button({
  x,
  y,
  width,
  height,
  label,
  onPress,
  isHighlighted = false,
  fill,
  labelFill,
  ringStroke,
}: ButtonProps) {
  const bg =
    fill ?? (isHighlighted ? COLORS.rowSelectedBg : COLORS.gray[600]);
  const textFill = labelFill ?? COLORS.gray[0];
  const ring = ringStroke ?? COLORS.gray[0];
  return (
    <>
      {isHighlighted && (
        <Rect
          x={x - 4}
          y={y - 4}
          width={width + 8}
          height={height + 8}
          fill="none"
          stroke={ring}
          lineWidth={4}
        />
      )}
      <Rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={bg}
      />
      <Text
        x={x + 14}
        y={y + height / 2}
        fill={textFill}
        fontSize={17}
        fontFamily="SourceSansPro-Regular"
        textAlign="left"
        textBaseline="middle"
      >
        {label}
      </Text>
      <Rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill="transparent"
        onTouchStart={onPress}
      />
    </>
  );
}
