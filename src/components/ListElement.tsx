import React from "react";
import { Image, Rect, Text } from "react-tela";
import { COLORS } from "../lib/colors";

export type ListElementVariant = "knob" | "dropdown" | "action" | "game";

export interface ListElementModel {
  id: string;
  label: string;
  variant: ListElementVariant;
  disabled?: boolean;
  onSelect?: () => void;
  knobValue?: boolean;
  gameIconSrc?: string;
  gameVersion?: string;
  gameEyebrow?: string;
  valueColorOverride?: string;
  rowSelectedFill?: string;
}

interface ListElementProps extends ListElementModel {
  x: number;
  y: number;
  width: number;
  height: number;
  isSelected: boolean;
  onTouchStart?: () => void;
  onMouseEnter?: () => void;
}

const TRACK_W = 56;
const TRACK_H = 28;
const KNOB_SIZE = 22;
const KNOB_PAD = 3;
const GAME_ICON_SIZE = 60;
const GAME_ICON_GUTTER = 24;

export function ListElement({
  x,
  y,
  width,
  height,
  label,
  variant,
  isSelected,
  disabled = false,
  knobValue = false,
  gameIconSrc,
  gameVersion,
  gameEyebrow,
  valueColorOverride,
  rowSelectedFill,
  onTouchStart,
  onMouseEnter,
}: ListElementProps) {
  const rightX = x + width - 76;
  const labelColor = disabled
    ? COLORS.gray[500]
    : isSelected
      ? COLORS.gray[0]
      : COLORS.gray[300];
  const valueColor = disabled
    ? COLORS.gray[500]
    : isSelected
      ? COLORS.accent
      : COLORS.gray[400];
  const selectedFill = rowSelectedFill ?? COLORS.rowSelected;

  const trackY = y + (height - TRACK_H) / 2;
  const knobX =
    rightX + (knobValue ? TRACK_W - KNOB_SIZE - KNOB_PAD : KNOB_PAD);
  const knobY = trackY + (TRACK_H - KNOB_SIZE) / 2;

  return (
    <>
      {isSelected && !disabled && (
        <Rect x={x} y={y} width={width} height={height} fill={selectedFill} />
      )}
      <Rect
        x={x}
        y={y + height - 1}
        width={width}
        height={1}
        fill={COLORS.gray[800]}
      />
      <Rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill="transparent"
        onTouchStart={disabled ? undefined : onTouchStart}
        onMouseEnter={disabled ? undefined : onMouseEnter}
      />
      {variant !== "game" && (
        <Text
          x={x + 24}
          y={y + height / 2}
          fill={labelColor}
          fontSize={26}
          fontFamily={
            isSelected && !disabled
              ? "SourceSansPro-Bold"
              : "SourceSansPro-Regular"
          }
          textBaseline="middle"
        >
          {label}
        </Text>
      )}

      {variant === "knob" && (
        <>
          <Rect
            x={rightX}
            y={trackY}
            width={TRACK_W}
            height={TRACK_H}
            fill={
              disabled
                ? COLORS.gray[700]
                : knobValue
                  ? COLORS.accent
                  : COLORS.gray[600]
            }
          />
          <Rect
            x={knobX}
            y={knobY}
            width={KNOB_SIZE}
            height={KNOB_SIZE}
            fill={
              disabled
                ? COLORS.gray[500]
                : knobValue
                  ? COLORS.gray[0]
                  : COLORS.gray[400]
            }
          />
        </>
      )}

      {variant === "action" && (
        <Text
          x={rightX + TRACK_W / 2}
          y={y + height / 2}
          fill={valueColor}
          fontSize={28}
          fontFamily={
            isSelected && !disabled
              ? "SourceSansPro-Bold"
              : "SourceSansPro-Regular"
          }
          textAlign="center"
          textBaseline="middle"
        >
          Edit
        </Text>
      )}

      {variant === "dropdown" && (
        <Text
          x={rightX + TRACK_W / 2}
          y={y + height / 2}
          fill={valueColor}
          fontSize={28}
          fontFamily="SourceSansPro-Bold"
          textAlign="center"
          textBaseline="middle"
        >
          {"›"}
        </Text>
      )}

      {variant === "game" && (
        <>
          {gameIconSrc && (
            <Image
              src={gameIconSrc}
              x={x + GAME_ICON_GUTTER}
              y={y + (height - GAME_ICON_SIZE) / 2}
              width={GAME_ICON_SIZE}
              height={GAME_ICON_SIZE}
            />
          )}
          {gameEyebrow && (
            <Text
              x={x + GAME_ICON_GUTTER + GAME_ICON_SIZE + 24}
              y={y + height / 2 - 16}
              fill={COLORS.eyebrowLabel}
              fontSize={16}
              fontFamily="SourceSansPro-Bold"
              textBaseline="middle"
            >
              {gameEyebrow}
            </Text>
          )}
          <Text
            x={x + GAME_ICON_GUTTER + GAME_ICON_SIZE + 24}
            y={gameEyebrow ? y + height / 2 + 6 : y + height / 2}
            fill={
              valueColorOverride ??
              (isSelected ? COLORS.gray[0] : COLORS.gray[200])
            }
            fontSize={26}
            fontFamily={
              isSelected ? "SourceSansPro-Bold" : "SourceSansPro-Regular"
            }
            textBaseline="middle"
          >
            {label}
          </Text>
          {gameVersion && (
            <Text
              x={x + width - 24}
              y={y + height / 2}
              fill={isSelected ? COLORS.gray[200] : COLORS.gray[500]}
              fontSize={20}
              fontFamily="SourceSansPro-Regular"
              textAlign="right"
              textBaseline="middle"
            >
              {gameVersion}
            </Text>
          )}
        </>
      )}
    </>
  );
}
