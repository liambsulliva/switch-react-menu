import React from "react";
import { Rect, Text } from "react-tela";
import { COLORS } from "../lib/colors";

export type RichDetailsLoadingOverlayProps = {
  progress: number;
  message?: string;
  error?: string | null;
};

const BAR_W = 560;
const BAR_H = 10;
const BAR_RADIUS = 5;

export function RichDetailsLoadingOverlay({
  progress,
  message = "Loading…",
  error = null,
}: RichDetailsLoadingOverlayProps) {
  const p = Math.max(0, Math.min(1, progress));
  const cx = screen.width / 2;
  const cy = screen.height / 2;
  const barLeft = cx - BAR_W / 2;
  const fillW = Math.max(0, BAR_W * p);

  return (
    <>
      <Rect
        x={0}
        y={0}
        width={screen.width}
        height={screen.height}
        fill={COLORS.background}
      />
      <Text
        x={cx}
        y={cy - 36}
        fill={COLORS.gray[200]}
        fontSize={26}
        fontFamily="SourceSansPro-Regular"
        textAlign="center"
        textBaseline="middle"
      >
        {message}
      </Text>
      {error ? (
        <Text
          x={cx}
          y={cy + 42}
          fill={COLORS.gray[400]}
          fontSize={16}
          fontFamily="SourceSansPro-Regular"
          textAlign="center"
          textBaseline="middle"
        >
          {error}
        </Text>
      ) : null}
      <Rect
        x={barLeft}
        y={cy - BAR_H / 2}
        width={BAR_W}
        height={BAR_H}
        fill={COLORS.gray[700]}
        borderRadius={BAR_RADIUS}
      />
      <Rect
        x={barLeft}
        y={cy - BAR_H / 2}
        width={fillW}
        height={BAR_H}
        fill={COLORS.accent}
        borderRadius={BAR_RADIUS}
      />
    </>
  );
}
