import React from "react";
import { Rect, Text } from "react-tela";
import { COLORS } from "../lib/colors";

export type CardProps = {
  x: number;
  y: number;
  width: number;
  height: number;
  title: string;
  onPress: () => void;
  isHighlighted?: boolean;
  accentRgb?: { r: number; g: number; b: number };
};

export function Card({
  x,
  y,
  width,
  height,
  title,
  onPress,
  isHighlighted = false,
  accentRgb = { r: 51, g: 153, b: 255 },
}: CardProps) {
  const ring = COLORS.gray[0];
  const thumbH = Math.max(52, Math.floor(height * 0.58));
  const titleY = y + thumbH + 8;
  const titleH = height - thumbH - 8;
  const { r: ar, g: ag, b: ab } = accentRgb;
  const deep = COLORS.gray[900];
  const mid = COLORS.gray[800];

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
      <Rect x={x} y={y} width={width} height={thumbH} fill={deep} />
      <Rect
        x={x}
        y={y}
        width={width}
        height={Math.floor(thumbH * 0.45)}
        fill={`rgba(${ar},${ag},${ab},0.22)`}
      />
      <Rect
        x={x}
        y={y + Math.floor(thumbH * 0.35)}
        width={width}
        height={thumbH - Math.floor(thumbH * 0.35)}
        fill={`rgba(0,0,0,0.42)`}
      />
      <Rect
        x={x + width * 0.55}
        y={y}
        width={Math.ceil(width * 0.45)}
        height={thumbH}
        fill={`rgba(${Math.min(255, ar + 40)},${Math.min(255, ag + 20)},${ab},0.12)`}
      />
      <Rect
        x={x}
        y={y + thumbH}
        width={width}
        height={height - thumbH}
        fill={mid}
      />
      <Text
        x={x + 8}
        y={titleY + Math.min(18, titleH / 2)}
        fill={COLORS.gray[0]}
        fontSize={14}
        fontFamily="SourceSansPro-Regular"
        textAlign="left"
        textBaseline="middle"
      >
        {title}
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
