import React, { useMemo } from "react";
import { Rect, Text } from "react-tela";
import { COLORS } from "../lib/colors";
import { Badge, computeBadgeMetrics } from "./Badge";

const SEARCH_TAG_BADGE_FILL = COLORS.gray[900];
const SEARCH_TAG_BADGE_TEXT = COLORS.gray[0];

export interface SearchBarProps {
  x: number;
  y: number;
  width: number;
  height: number;
  query: string;
  committedTags?: readonly string[];
  tagCompletionSuffix?: string | null;
  visible: boolean;
  inputFocused?: boolean;
  fontSize?: number;
  displayMaxChars?: number;
  onBarPress?: () => void;
}

export function SearchBar({
  x,
  y,
  width,
  height,
  query,
  committedTags = [],
  tagCompletionSuffix = null,
  visible,
  inputFocused = false,
  fontSize = 22,
  displayMaxChars = 42,
  onBarPress,
}: SearchBarProps) {
  if (!visible || width <= 0) return null;

  const hasContent = committedTags.length > 0 || query.trim().length > 0;
  const placeholder = "Search…";
  const displayColor = hasContent ? COLORS.gray[0] : COLORS.gray[500];
  const fill = inputFocused ? COLORS.rowSelectedBg : COLORS.gray[800];
  const stroke = inputFocused ? COLORS.gray[0] : COLORS.gray[600];
  const strokeW = inputFocused ? 2 : 1;

  const badgeGap = 6;
  const badgeFontSize = 12;
  const badgePadY = 3;
  const badgeMaxLabelChars = 22;

  const { badgeSlots, draftStartX } = useMemo(() => {
    let cx = x + 20;
    const slots: { x: number; w: number; h: number; label: string }[] = [];
    for (const label of committedTags) {
      const { width: bw, height: bh } = computeBadgeMetrics({
        label,
        fontSize: badgeFontSize,
        padY: badgePadY,
        maxLabelChars: badgeMaxLabelChars,
      });
      slots.push({ x: cx, w: bw, h: bh, label });
      cx += bw + badgeGap;
    }
    return { badgeSlots: slots, draftStartX: cx };
  }, [x, committedTags, badgeFontSize, badgePadY, badgeGap, badgeMaxLabelChars]);

  const badgeCharBudget = committedTags.reduce(
    (acc, t) => acc + Math.min(t.length, badgeMaxLabelChars) + 2,
    0,
  );
  const draftCharCap = Math.max(4, displayMaxChars - badgeCharBudget);
  const displayDraft =
    query.length > draftCharCap ? `${query.slice(0, draftCharCap - 1)}…` : query;

  const showGhost =
    Boolean(tagCompletionSuffix) && displayDraft === query && query.length > 0;

  const textY = y + height / 2;
  const mainText =
    displayDraft || (committedTags.length > 0 ? "" : placeholder);

  const textCommon = {
    x: draftStartX,
    y: textY,
    fontSize,
    fontFamily: "SourceSansPro-Regular" as const,
    textAlign: "left" as const,
    textBaseline: "middle" as const,
  };

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
      />
      {badgeSlots.map((b, i) => (
        <Badge
          key={`${b.label}-${i}`}
          x={b.x}
          y={y + (height - b.h) / 2}
          label={b.label}
          width={b.w}
          height={b.h}
          style={{
            fill: SEARCH_TAG_BADGE_FILL,
            textFill: SEARCH_TAG_BADGE_TEXT,
            fontSize: badgeFontSize,
            padY: badgePadY,
          }}
        />
      ))}
      {showGhost && tagCompletionSuffix ? (
        <>
          <Text {...textCommon} fill={COLORS.gray[500]}>
            {`${displayDraft}${tagCompletionSuffix}`}
          </Text>
          <Text {...textCommon} fill={displayColor}>
            {displayDraft}
          </Text>
        </>
      ) : (
        <Text {...textCommon} fill={displayColor}>
          {mainText}
        </Text>
      )}
    </>
  );
}
