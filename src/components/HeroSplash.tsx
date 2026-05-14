import React, { useMemo } from "react";
import { Image, Rect, Text } from "react-tela";
import { Button } from "./Button";
import { COLORS } from "../lib/colors";
import type { HeroSplashInlineFetchState } from "../hooks/useHeroSplashInlineExperience";
import type { HeroSplashInlineSubFocus } from "../hooks/useGamepadNavigation";
import { formatRichReleaseDate, type RichTrailer } from "../lib/richGameDetails";
import { richTrailerWatchUrl } from "../lib/richTrailerUrl";
import { openSwitchWebApplet } from "../lib/switchWebApplet";
import { canFetchRemoteRichAssets } from "../lib/remoteRichAssets";

const iconUrlCache = new Map<string, string>();

function getIconObjectUrl(app: { id: bigint }, icon: ArrayBuffer): string {
  const key = app.id.toString();
  let url = iconUrlCache.get(key);
  if (!url) {
    url = URL.createObjectURL(new Blob([icon]));
    iconUrlCache.set(key, url);
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
  backgroundImageUrl: string | null;
  fallbackImageUrl: string | null;
  app: Switch.Application;
  fetchState: HeroSplashInlineFetchState;
  /** When `"trailers"`, the trailer row shows a gamepad selection ring. */
  heroInlineSubFocus?: HeroSplashInlineSubFocus;
  /** Index of the highlighted trailer when `heroInlineSubFocus === "trailers"`. */
  heroTrailerIndex?: number;
};

const IMAGE_EXTRA = 1.55;

export function HeroSplash({
  panT,
  backgroundImageUrl,
  fallbackImageUrl,
  app,
  fetchState,
  heroInlineSubFocus = "content",
  heroTrailerIndex = 0,
}: HeroSplashProps) {
  const pan = Math.max(0, Math.min(1, panT));
  const HERO_H = Math.min(screen.height - 48, Math.floor(screen.height * 0.56));
  const finalTop = screen.height - HERO_H;
  const slideDistance = Math.floor(HERO_H * 0.95 + 100);
  const heroTop = Math.round(finalTop + (1 - pan) * slideDistance);

  const imgH = Math.floor(HERO_H * IMAGE_EXTRA);
  const imgY = heroTop + HERO_H - imgH;

  const state = fetchState;
  const fallbackIconSrc = useMemo(
    () => (app.icon ? getIconObjectUrl(app, app.icon) : null),
    [app],
  );

  const canUseRemoteImages = canFetchRemoteRichAssets();
  const coverSrc =
    state.status === "ok" && state.data?.coverUrl && canUseRemoteImages
      ? state.data.coverUrl
      : (fallbackImageUrl ?? fallbackIconSrc);
  const backgroundSrc =
    state.status === "ok" && state.data?.backgroundUrl && canUseRemoteImages
      ? state.data.backgroundUrl
      : (backgroundImageUrl ?? coverSrc);

  const title =
    state.status === "ok" && state.data?.name ? state.data.name : app.name;
  const release =
    state.status === "ok" && state.data
      ? formatRichReleaseDate(state.data.firstReleaseDate)
      : null;

  const padding = 18;
  const coverW = 96;
  const coverH = 128;
  const textX = padding + coverW + 16;
  const textW = screen.width - textX - padding;
  const charsPerLine = Math.max(20, Math.floor(textW / 10));

  const yTitle = heroTop + padding;
  const yAfterTitle = yTitle + 34;
  const summaryStartY =
    state.status === "ok" && state.data !== null
      ? yAfterTitle + 26
      : yAfterTitle + 6;
  const maxSummaryLines = Math.max(
    3,
    Math.min(10, Math.floor((heroTop + HERO_H - summaryStartY - 48) / 20)),
  );

  const summaryLines =
    state.status === "ok" && state.data?.summary
      ? wrapSummary(state.data.summary, charsPerLine, maxSummaryLines)
      : [];
  const trailers: RichTrailer[] =
    state.status === "ok" && state.data?.trailers ? state.data.trailers : [];

  const trailerBtnH = 38;
  const trailerBtnGap = 10;
  const trailerBlockTop =
    summaryStartY +
    summaryLines.length * 20 +
    (summaryLines.length > 0 ? 14 : 8);

  const trailerRowLayout = useMemo(() => {
    const n = trailers.length;
    if (n === 0) return null;
    const fixedW = 168;
    const totalFixed = n * fixedW + (n - 1) * trailerBtnGap;
    let btnW: number;
    let rowScroll = 0;
    if (totalFixed <= textW) {
      btnW = (textW - (n - 1) * trailerBtnGap) / n;
    } else {
      btnW = fixedW;
      const rowW = n * btnW + (n - 1) * trailerBtnGap;
      const maxScroll = Math.max(0, rowW - textW);
      const focusLeft = heroTrailerIndex * (btnW + trailerBtnGap);
      const idealScroll = focusLeft + btnW / 2 - textW / 2;
      rowScroll = Math.max(0, Math.min(idealScroll, maxScroll));
    }
    return { btnW, rowScroll };
  }, [
    trailers,
    textW,
    heroTrailerIndex,
    trailerBtnGap,
  ]);

  return (
    <>
      {backgroundSrc ? (
        <Image
          src={backgroundSrc}
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

      <Rect
        x={0}
        y={heroTop}
        width={screen.width}
        height={HERO_H}
        fill="rgba(6,6,10,0.5)"
      />
      <Rect
        x={0}
        y={heroTop + Math.floor(HERO_H * 0.25)}
        width={screen.width}
        height={HERO_H - Math.floor(HERO_H * 0.25)}
        fill="rgba(6,6,10,0.62)"
      />
      <Rect
        x={0}
        y={heroTop + HERO_H - 2}
        width={screen.width}
        height={2}
        fill="rgba(255,255,255,0.07)"
      />

      {coverSrc ? (
        <Image
          src={coverSrc}
          x={padding}
          y={heroTop + padding}
          width={coverW}
          height={coverH}
        />
      ) : (
        <Rect
          x={padding}
          y={heroTop + padding}
          width={coverW}
          height={coverH}
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

      {(state.status === "loading" || state.status === "idle") && (
        <Text
          x={textX}
          y={yAfterTitle}
          fill={COLORS.gray[400]}
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
          y={yAfterTitle}
          fill={COLORS.gray[400]}
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
          y={yAfterTitle}
          fill={COLORS.gray[500]}
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
            y={yAfterTitle}
            fill={COLORS.gray[400]}
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
              fill={COLORS.gray[200]}
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
              fill={COLORS.gray[500]}
              fontSize={17}
              fontFamily="SourceSansPro-Regular"
              textAlign="left"
              textBaseline="top"
            >
              No description in the DB for this search.
            </Text>
          )}
          {trailers.length > 0 &&
            trailerRowLayout &&
            trailers.map((t, i) => {
              const { btnW, rowScroll } = trailerRowLayout;
              const bx =
                textX +
                i * (btnW + trailerBtnGap) -
                rowScroll;
              if (bx + btnW < textX - 2 || bx > textX + textW + 2) {
                return null;
              }
              const labelMax = Math.max(6, Math.floor((btnW - 24) / 9));
              const label = truncateEnd(
                t.name?.trim() || "Watch trailer",
                labelMax,
              );
              const highlighted =
                heroInlineSubFocus === "trailers" && i === heroTrailerIndex;
              return (
                <Button
                  key={`tr-${t.youtubeId}-${i}`}
                  x={bx}
                  y={trailerBlockTop}
                  width={btnW}
                  height={trailerBtnH}
                  label={label}
                  isHighlighted={highlighted}
                  onPress={() => openSwitchWebApplet(richTrailerWatchUrl(t))}
                />
              );
            })}
        </>
      )}
    </>
  );
}
