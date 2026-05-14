import React, { useEffect, useState } from "react";
import { Text } from "react-tela";
import { COLORS } from "../lib/colors";

export const TOP_RIGHT_CLOCK_SLOT_PX = 50;
export const TOP_RIGHT_CLOCK_GAP_PX = 24;
export const TOP_RIGHT_CLOCK_SCREEN_INSET_PX = 16;
export const TOP_RIGHT_CLOCK_PUSH_PX =
  TOP_RIGHT_CLOCK_SLOT_PX +
  TOP_RIGHT_CLOCK_GAP_PX +
  TOP_RIGHT_CLOCK_SCREEN_INSET_PX;

export function formatClockHHMM(epochMs: number): string {
  const d = new Date(epochMs);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

interface DigitalClockProps {
  x: number;
  y: number;
  fontSize?: number;
}

export function DigitalClock({ x, y, fontSize = 26 }: DigitalClockProps) {
  const [label, setLabel] = useState(() => formatClockHHMM(Date.now()));

  useEffect(() => {
    const tick = () => setLabel(formatClockHHMM(Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <Text
      x={x}
      y={y}
      fill={COLORS.gray[0]}
      fontSize={fontSize}
      fontFamily="SourceSansPro-Bold"
      textAlign="right"
      textBaseline="middle"
    >
      {label}
    </Text>
  );
}
