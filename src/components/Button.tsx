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
};

export function Button({
  x,
  y,
  width,
  height,
  label,
  onPress,
  isHighlighted = false,
}: ButtonProps) {
  return (
    <>
      {isHighlighted && (
        <Rect
          x={x - 4}
          y={y - 4}
          width={width + 8}
          height={height + 8}
          fill="none"
          stroke={COLORS.gray[0]}
          lineWidth={4}
        />
      )}
      <Rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={isHighlighted ? COLORS.rowSelectedBg : COLORS.gray[600]}
      />
      <Text
        x={x + 14}
        y={y + height / 2}
        fill={COLORS.gray[0]}
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
