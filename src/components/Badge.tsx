import React from "react";
import { Rect, Text } from "react-tela";
import { COLORS } from "../lib/colors";

export type BadgeVariant = "default" | "muted" | "accent";

const VARIANT_STYLES: Record<
  BadgeVariant,
  { fill: string; textFill: string }
> = {
  default: { fill: COLORS.gray[600], textFill: COLORS.gray[100] },
  muted: { fill: COLORS.gray[700], textFill: COLORS.gray[400] },
  accent: { fill: COLORS.gray[500], textFill: COLORS.gray[0] },
};

export type BadgeStyleOverrides = {
  fill?: string;
  textFill?: string;
  fontSize?: number;
  padX?: number;
  padY?: number;
  radius?: number;
};

export type BadgeLayoutInput = {
  label: string;
  fontSize?: number;
  padX?: number;
  padY?: number;
  maxWidth?: number;
  maxLabelChars?: number;
  width?: number;
  height?: number;
};

export type BadgeProps = {
  x: number;
  y: number;
  label: string;
  variant?: BadgeVariant;
  maxWidth?: number;
  width?: number;
  height?: number;
  maxLabelChars?: number;
  style?: BadgeStyleOverrides;
  stroke?: string;
  strokeWidth?: number;
};

const DEFAULT_FONT = 13;
const DEFAULT_PAD_X = 10;
const DEFAULT_PAD_Y = 4;
const DEFAULT_RADIUS = 4;
const DEFAULT_MAX_LABEL_CHARS = 22;

function truncateLabel(s: string, maxChars: number): string {
  const t = s.trim() || "—";
  if (t.length <= maxChars) return t;
  if (maxChars <= 1) return "…";
  return `${t.slice(0, maxChars - 1)}…`;
}

function charWidth(fontSize: number): number {
  return fontSize * 0.52;
}

type BadgeMetricsResolved = {
  display: string;
  width: number;
  height: number;
  fontSize: number;
  padX: number;
  padY: number;
};

export function computeBadgeMetrics(input: BadgeLayoutInput): BadgeMetricsResolved {
  const fontSize = input.fontSize ?? DEFAULT_FONT;
  const padX = input.padX ?? DEFAULT_PAD_X;
  const padY = input.padY ?? DEFAULT_PAD_Y;
  const maxLabelChars = input.maxLabelChars ?? DEFAULT_MAX_LABEL_CHARS;
  const cw = charWidth(fontSize);
  const cap =
    input.maxWidth != null
      ? Math.max(
          4,
          Math.floor((input.maxWidth - padX * 2) / Math.max(0.01, cw)),
        )
      : maxLabelChars;
  const display = truncateLabel(input.label, cap);
  const inner = Math.ceil(display.length * cw);
  const naturalW = inner + padX * 2;
  const width =
    input.width ??
    (input.maxWidth != null ? Math.min(input.maxWidth, naturalW) : naturalW);
  const height =
    input.height ??
    Math.max(Math.round(fontSize + padY * 2), DEFAULT_FONT + 10);
  return { display, width, height, fontSize, padX, padY };
}

export function estimateBadgeOuterWidth(
  label: string,
  opts?: Omit<BadgeLayoutInput, "label">,
): number {
  return computeBadgeMetrics({ label, ...opts }).width;
}

export function Badge({
  x,
  y,
  label,
  variant = "default",
  maxWidth,
  width: widthProp,
  height: heightProp,
  maxLabelChars,
  style: styleOverrides,
  stroke,
  strokeWidth = 1,
}: BadgeProps) {
  const fontSize = styleOverrides?.fontSize ?? DEFAULT_FONT;
  const padX = styleOverrides?.padX ?? DEFAULT_PAD_X;
  const padY = styleOverrides?.padY ?? DEFAULT_PAD_Y;
  const radius = styleOverrides?.radius ?? DEFAULT_RADIUS;
  const base = VARIANT_STYLES[variant];
  const fill = styleOverrides?.fill ?? base.fill;
  const textFill = styleOverrides?.textFill ?? base.textFill;

  const { display, width: w, height: h } = computeBadgeMetrics({
    label,
    fontSize,
    padX,
    padY,
    maxWidth,
    maxLabelChars,
    width: widthProp,
    height: heightProp,
  });

  return (
    <>
      <Rect
        x={x}
        y={y}
        width={w}
        height={h}
        fill={fill}
        borderRadius={radius}
        stroke={stroke}
        lineWidth={stroke ? strokeWidth : 0}
      />
      <Text
        x={x + padX}
        y={y + h / 2}
        fill={textFill}
        fontSize={fontSize}
        fontFamily="SourceSansPro-Regular"
        textAlign="left"
        textBaseline="middle"
      >
        {display}
      </Text>
    </>
  );
}
