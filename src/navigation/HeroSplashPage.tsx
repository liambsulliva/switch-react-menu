import React, { useEffect, useMemo, useRef, useState } from "react";
import { Image, Rect, Text } from "react-tela";
import {
  Badge,
  computeBadgeMetrics,
  estimateBadgeOuterWidth,
} from "../components/Badge";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { COLORS } from "../lib/colors";
import type { HeroSplashInlineFetchState } from "../hooks/useHeroSplashInlineExperience";
import {
  HERO_TRAILER_GRID_MAX_CARDS,
  type HeroSplashInlineSubFocus,
} from "../hooks/useGamepadNavigation";
import {
  formatRichReleaseDate,
  type RichTrailer,
} from "../lib/richGameDetails";
import { richTrailerWatchUrl } from "../lib/richTrailerUrl";
import { openSwitchWebApplet } from "../lib/switchWebApplet";
import {
  getCachedIconHeroRgbPair,
  renderHeroGradientObjectUrl,
} from "../lib/iconHeroGradientPalette";
import { getUpArrowPng } from "../lib/iconPng";
import { getBrowserDocument } from "../browser/dom";

const heroSplashIconUrlCache = new Map<string, string>();

function getHeroSplashIconObjectUrl(
  app: { id: bigint },
  icon: ArrayBuffer,
): string {
  const key = app.id.toString();
  let url = heroSplashIconUrlCache.get(key);
  if (!url) {
    url = URL.createObjectURL(new Blob([icon]));
    heroSplashIconUrlCache.set(key, url);
  }
  return url;
}

function truncateEnd(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, Math.max(0, max - 1))}…`;
}

function wrapSummary(
  text: string,
  maxCharsPerLine: number,
  maxLines: number,
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (next.length <= maxCharsPerLine) {
      line = next;
    } else {
      if (line) lines.push(line);
      line = w;
      if (lines.length >= maxLines) {
        lines[maxLines - 1] = truncateEnd(
          lines[maxLines - 1] ?? "",
          maxCharsPerLine,
        );
        return lines.slice(0, maxLines);
      }
    }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    return lines
      .slice(0, maxLines - 1)
      .concat(truncateEnd(lines[maxLines - 1] ?? "", maxCharsPerLine));
  }
  return lines;
}

export type HeroSplashProps = {
  panT: number;
  app: Switch.Application;
  fetchState: HeroSplashInlineFetchState;
  heroInlineSubFocus?: HeroSplashInlineSubFocus;
  heroTrailerIndex?: number;
  heroActionIndex?: number;
  onPlayGame: () => void;
  onEditInfo: () => void;
  onCloseDetails: () => void;
};

const IMAGE_EXTRA = 1.55;
const HERO_INLINE_CONTENT_DROP_PX = 10;

const HERO_TAG_PILL_FILL = COLORS.gray[900];
const HERO_TAG_TEXT_FILL = COLORS.gray[0];

const HERO_BTN_IDLE = COLORS.gray[900];

const HERO_CLOSE_DETAILS_ARROW_PX = 36;
const HERO_CLOSE_DETAILS_HIT_PX = 56;
const HERO_CLOSE_DETAILS_RIGHT_MARGIN_PX = 18;

function cardAccentRgb(i: number): { r: number; g: number; b: number } {
  const hues = [
    { r: 42, g: 118, b: 210 },
    { r: 120, g: 72, b: 198 },
    { r: 32, g: 150, b: 140 },
    { r: 198, g: 92, b: 62 },
    { r: 72, g: 110, b: 190 },
  ];
  return hues[i % hues.length]!;
}

// nx.js `Text` metrics differ from browser canvas... nudge title up a tad on bare-metal hardware.
const HERO_TITLE_Y_BARE_METAL_NUDGE = -6;

export function HeroSplash({
  panT,
  app,
  fetchState,
  heroInlineSubFocus = "content",
  heroTrailerIndex = 0,
  heroActionIndex = 0,
  onPlayGame,
  onEditInfo,
  onCloseDetails,
}: HeroSplashProps) {
  const pan = Math.max(0, Math.min(1, panT));
  const HERO_H =
    Math.min(screen.height - 48, Math.floor(screen.height * 0.56)) - 10;
  const finalTop = screen.height - HERO_H;
  const slideDistance = Math.floor(HERO_H * 0.95 + 100);
  const heroTop = Math.round(finalTop + (1 - pan) * slideDistance);

  const imgH = Math.floor(HERO_H * IMAGE_EXTRA);
  const imgY = heroTop + HERO_H - imgH;

  const state = fetchState;

  const squareIconSrc = useMemo(
    () => (app.icon ? getHeroSplashIconObjectUrl(app, app.icon) : null),
    [app],
  );

  const useIconBackdropGradient = app.icon != null;

  const iconBackdropPair = useMemo(
    () => getCachedIconHeroRgbPair(app.id, app.icon),
    [app.id, app.icon?.byteLength ?? 0],
  );

  const [heroGradientUrl, setHeroGradientUrl] = useState<string | null>(null);
  const heroGradientUrlRef = useRef<string | null>(null);
  const [closeDetailsArrowSrc, setCloseDetailsArrowSrc] = useState<string | null>(
    null,
  );

  useEffect(() => {
    let active = true;
    void getUpArrowPng(COLORS.gray[0]).then((src) => {
      if (active) setCloseDetailsArrowSrc(src);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!useIconBackdropGradient || !iconBackdropPair) {
      if (heroGradientUrlRef.current) {
        URL.revokeObjectURL(heroGradientUrlRef.current);
        heroGradientUrlRef.current = null;
      }
      setHeroGradientUrl(null);
      return;
    }

    let cancelled = false;
    const gw = Math.min(screen.width, 720);
    const gh = Math.min(imgH, 720);

    void renderHeroGradientObjectUrl({
      width: gw,
      height: gh,
      a: iconBackdropPair.a,
      b: iconBackdropPair.b,
    })
      .then((url) => {
        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }
        if (heroGradientUrlRef.current) {
          URL.revokeObjectURL(heroGradientUrlRef.current);
        }
        heroGradientUrlRef.current = url;
        setHeroGradientUrl(url);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      if (heroGradientUrlRef.current) {
        URL.revokeObjectURL(heroGradientUrlRef.current);
        heroGradientUrlRef.current = null;
      }
      setHeroGradientUrl(null);
    };
  }, [useIconBackdropGradient, iconBackdropPair, imgH]);

  const title =
    state.status === "ok" && state.data?.name ? state.data.name : app.name;
  const release =
    state.status === "ok" && state.data
      ? formatRichReleaseDate(state.data.firstReleaseDate)
      : null;

  const padding = 18;
  const iconTile = 96;
  const textX = padding + iconTile + 16;
  const midGap = 20;
  const minCardLane = 2 * 64 + 12;
  const trailersForLayout: RichTrailer[] =
    state.status === "ok" && state.data?.trailers ? state.data.trailers : [];
  const hasAssetCards = trailersForLayout.length > 0;
  const midWidth = screen.width - textX - padding;
  const maxLeftBody = midWidth - minCardLane - midGap;
  const preferredLeft = Math.floor(midWidth * 0.52) - Math.floor(midGap / 2);
  const textW = hasAssetCards
    ? Math.max(160, Math.min(Math.max(preferredLeft, 200), maxLeftBody))
    : midWidth;
  const cardsColumnX = hasAssetCards ? textX + textW + midGap : 0;
  const cardsPanelW = hasAssetCards
    ? Math.max(0, screen.width - padding - cardsColumnX)
    : 0;
  const charsPerLine = Math.max(20, Math.floor(textW / 10));

  const yTitleRow = heroTop + padding + HERO_INLINE_CONTENT_DROP_PX;
  const isBrowserPolyfillPreview = getBrowserDocument() !== undefined;
  const yTitle =
    yTitleRow + (isBrowserPolyfillPreview ? 0 : HERO_TITLE_Y_BARE_METAL_NUDGE);

  const heroTags =
    state.status === "ok" && state.data?.tags?.length ? state.data.tags : [];

  const badgeLayout = useMemo(() => {
    const MAX_TAGS = 10;
    const ROW_H = computeBadgeMetrics({
      label: "Ag",
      fontSize: 13,
      padX: 10,
      padY: 4,
      maxLabelChars: 18,
    }).height;
    const pad = 6;
    const rowGap = 6;
    const maxRight = textX + textW;
    const maxRows = 2;
    if (heroTags.length === 0) {
      return {
        items: [] as Array<{
          key: string;
          x: number;
          y: number;
          label: string;
        }>,
        blockH: 0,
      };
    }
    const tagsForBadges = heroTags.slice(0, MAX_TAGS);
    const truncated = heroTags.length > MAX_TAGS;
    const ellipsisLabel = "…";
    const ellipsisW = estimateBadgeOuterWidth(ellipsisLabel, {
      fontSize: 13,
      padX: 10,
      maxLabelChars: 3,
    });

    let cx = textX;
    let cy = 0;
    let row = 0;
    const items: Array<{
      key: string;
      x: number;
      y: number;
      label: string;
    }> = [];

    const place = (key: string, label: string, w: number): boolean => {
      if (cx + w > maxRight && cx > textX) {
        row += 1;
        if (row >= maxRows) return false;
        cx = textX;
        cy += ROW_H + rowGap;
      }
      items.push({ key, x: cx, y: cy, label });
      cx += w + pad;
      return true;
    };

    for (let i = 0; i < tagsForBadges.length; i++) {
      const label = tagsForBadges[i]!;
      const w = estimateBadgeOuterWidth(label, {
        fontSize: 13,
        padX: 10,
        maxLabelChars: 18,
      });
      if (!place(`tag-${i}`, label, w)) break;
    }

    if (truncated) {
      place("tag-more", ellipsisLabel, ellipsisW);
    }

    const blockH =
      items.length === 0 ? 0 : Math.max(...items.map((it) => it.y)) + ROW_H;
    return { items, blockH };
  }, [heroTags, textX, textW]);

  const yTagsBase = yTitleRow + 30;
  const yLine2 =
    badgeLayout.items.length > 0
      ? yTagsBase + badgeLayout.blockH + 8
      : yTitleRow + 34;
  const summaryStartY =
    state.status === "ok" && state.data !== null ? yLine2 + 26 : yLine2 + 6;
  const maxSummaryLines = Math.max(
    3,
    Math.min(10, Math.floor((heroTop + HERO_H - summaryStartY - 48) / 20)),
  );

  const summaryLines =
    state.status === "ok" && state.data?.summary
      ? wrapSummary(state.data.summary, charsPerLine, maxSummaryLines)
      : [];
  const trailers: RichTrailer[] = trailersForLayout.slice(
    0,
    HERO_TRAILER_GRID_MAX_CARDS,
  );

  const actionBtnH = 40;
  const actionGap = 12;
  const actionsRowTop =
    summaryStartY +
    summaryLines.length * 20 +
    (summaryLines.length > 0 ? 14 : 8);
  const cardsColGap = 12;
  const cardsRowGap = 12;
  const cardH = 110;
  const cardW = hasAssetCards
    ? Math.max(64, Math.floor((cardsPanelW - cardsColGap) / 2))
    : 0;
  /** Top-align asset column with the title row so cards sit beside the headline block. */
  const cardsGridTop = yTitleRow;

  const actionBtnW = (textW - actionGap) / 2;
  const actionPlayHighlighted =
    heroInlineSubFocus === "actions" && heroActionIndex === 0;
  const actionInfoHighlighted =
    heroInlineSubFocus === "actions" && heroActionIndex === 1;

  const closeDetailsArrowX =
    screen.width -
    HERO_CLOSE_DETAILS_RIGHT_MARGIN_PX -
    HERO_CLOSE_DETAILS_ARROW_PX;
  const closeDetailsArrowY =
    yTitleRow +
    (yTagsBase - yTitleRow) / 2 -
    HERO_CLOSE_DETAILS_ARROW_PX / 2;
  const closeDetailsHitX =
    closeDetailsArrowX +
    HERO_CLOSE_DETAILS_ARROW_PX / 2 -
    HERO_CLOSE_DETAILS_HIT_PX / 2;
  const closeDetailsHitY =
    closeDetailsArrowY +
    HERO_CLOSE_DETAILS_ARROW_PX / 2 -
    HERO_CLOSE_DETAILS_HIT_PX / 2;

  return (
    <>
      {heroGradientUrl ? (
        <Image
          src={heroGradientUrl}
          x={0}
          y={imgY}
          width={screen.width}
          height={imgH}
        />
      ) : (
        <Rect
          x={0}
          y={heroTop}
          width={screen.width}
          height={HERO_H}
          fill={COLORS.gray[800]}
        />
      )}

      {squareIconSrc ? (
        <Image
          src={squareIconSrc}
          x={padding}
          y={yTitleRow}
          width={iconTile}
          height={iconTile}
        />
      ) : (
        <Rect
          x={padding}
          y={yTitleRow}
          width={iconTile}
          height={iconTile}
          fill={COLORS.gray[700]}
        />
      )}

      <Text
        x={textX}
        y={yTitle}
        fill={COLORS.gray[0]}
        fontSize={28}
        fontFamily="SourceSansPro-Bold"
        textAlign="left"
        textBaseline="top"
      >
        {truncateEnd(title, 44)}
      </Text>

      {badgeLayout.items.map((b) => (
        <Badge
          key={b.key}
          x={b.x}
          y={yTagsBase + b.y}
          label={b.label}
          maxLabelChars={18}
          style={{ fill: HERO_TAG_PILL_FILL, textFill: HERO_TAG_TEXT_FILL }}
        />
      ))}

      {closeDetailsArrowSrc && (
        <>
          <Image
            src={closeDetailsArrowSrc}
            x={closeDetailsArrowX}
            y={closeDetailsArrowY}
            width={HERO_CLOSE_DETAILS_ARROW_PX}
            height={HERO_CLOSE_DETAILS_ARROW_PX}
          />
          <Rect
            x={closeDetailsHitX}
            y={closeDetailsHitY}
            width={HERO_CLOSE_DETAILS_HIT_PX}
            height={HERO_CLOSE_DETAILS_HIT_PX}
            fill="transparent"
            onTouchStart={onCloseDetails}
          />
        </>
      )}

      {(state.status === "loading" || state.status === "idle") && (
        <Text
          x={textX}
          y={yLine2}
          fill={COLORS.gray[200]}
          fontSize={19}
          fontFamily="SourceSansPro-Regular"
          textAlign="left"
          textBaseline="top"
        >
          Fetching from DB…
        </Text>
      )}

      {state.status === "error" && (
        <Text
          x={textX}
          y={yLine2}
          fill={COLORS.gray[200]}
          fontSize={17}
          fontFamily="SourceSansPro-Regular"
          textAlign="left"
          textBaseline="top"
        >
          Failed to grab assets from DB.
        </Text>
      )}

      {state.status === "ok" && state.data === null && (
        <Text
          x={textX}
          y={yLine2}
          fill={COLORS.gray[200]}
          fontSize={17}
          fontFamily="SourceSansPro-Regular"
          textAlign="left"
          textBaseline="top"
        >
          No entry in the DB for this title.
        </Text>
      )}

      {state.status === "ok" && state.data !== null && (
        <>
          <Text
            x={textX}
            y={yLine2}
            fill={COLORS.gray[200]}
            fontSize={17}
            fontFamily="SourceSansPro-Regular"
            textAlign="left"
            textBaseline="top"
          >
            {release ? `Released ${release}` : "Release date unknown"}
          </Text>
          {summaryLines.map((line, i) => (
            <Text
              key={`sum-${i}`}
              x={textX}
              y={summaryStartY + i * 20}
              fill={COLORS.gray[0]}
              fontSize={17}
              fontFamily="SourceSansPro-Regular"
              textAlign="left"
              textBaseline="top"
            >
              {line}
            </Text>
          ))}
          {trailers.length === 0 && !state.data.summary && (
            <Text
              x={textX}
              y={summaryStartY}
              fill={COLORS.gray[0]}
              fontSize={17}
              fontFamily="SourceSansPro-Regular"
              textAlign="left"
              textBaseline="top"
            >
              No description in the DB for this search.
            </Text>
          )}
          <Button
            x={textX}
            y={actionsRowTop}
            width={actionBtnW}
            height={actionBtnH}
            label="Play Game"
            isHighlighted={actionPlayHighlighted}
            fill={actionPlayHighlighted ? COLORS.rowSelectedBg : HERO_BTN_IDLE}
            labelFill={COLORS.gray[0]}
            onPress={onPlayGame}
          />
          <Button
            x={textX + actionBtnW + actionGap}
            y={actionsRowTop}
            width={actionBtnW}
            height={actionBtnH}
            label="Edit Info"
            isHighlighted={actionInfoHighlighted}
            fill={actionInfoHighlighted ? COLORS.rowSelectedBg : HERO_BTN_IDLE}
            labelFill={COLORS.gray[0]}
            onPress={onEditInfo}
          />
          {trailers.length > 0 &&
            trailers.map((t, i) => {
              const col = i % 2;
              const row = Math.floor(i / 2);
              const cx = cardsColumnX + col * (cardW + cardsColGap);
              const cy = cardsGridTop + row * (cardH + cardsRowGap);
              const labelMax = Math.max(8, Math.floor((cardW - 16) / 8));
              const label = truncateEnd(
                t.name?.trim() || "Watch trailer",
                labelMax,
              );
              const highlighted =
                heroInlineSubFocus === "trailers" && i === heroTrailerIndex;
              return (
                <Card
                  key={`tr-${t.youtubeId}-${i}`}
                  x={cx}
                  y={cy}
                  width={cardW}
                  height={cardH}
                  title={label}
                  isHighlighted={highlighted}
                  accentRgb={cardAccentRgb(i)}
                  onPress={() => openSwitchWebApplet(richTrailerWatchUrl(t))}
                />
              );
            })}
        </>
      )}
    </>
  );
}
