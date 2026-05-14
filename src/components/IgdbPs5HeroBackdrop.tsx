import React, { useMemo } from "react";
import { Image, Rect, Text } from "react-tela";
import { COLORS } from "../lib/colors";
import { formatIgdbReleaseDate } from "../lib/igdb";
import { canFetchRemoteIgdbUrls } from "../lib/remoteIgdbAssets";
import type { IgdbInlineFetchState } from "../hooks/useIgdbInlineExperience";

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

export type IgdbPs5HeroBackdropProps = {
  panT: number;
  imageUrl: string | null;
  app: Switch.Application;
  fetchState: IgdbInlineFetchState;
};

const IMAGE_EXTRA = 1.55;

export function IgdbPs5HeroBackdrop({
  panT,
  imageUrl,
  app,
  fetchState,
}: IgdbPs5HeroBackdropProps) {
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

  const coverSrc =
    state.status === "ok" && state.data?.coverUrl && canFetchRemoteIgdbUrls()
      ? state.data.coverUrl
      : (imageUrl ?? fallbackIconSrc);

  const title =
    state.status === "ok" && state.data?.name ? state.data.name : app.name;
  const release =
    state.status === "ok" && state.data
      ? formatIgdbReleaseDate(state.data.firstReleaseDate)
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
  const trailers =
    state.status === "ok" && state.data?.trailers
      ? state.data.trailers.slice(0, 3)
      : [];

  return (
    <>
      {coverSrc ? (
        <Image
          src={coverSrc}
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
          Loading IGDB…
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
          {`IGDB: ${state.message}`}
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
          No IGDB result for this title search.
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
              No description in IGDB for this search.
            </Text>
          )}
          {trailers.map((t, i) => (
            <Text
              key={`tr-${t.youtubeId}`}
              x={textX}
              y={summaryStartY + summaryLines.length * 20 + 6 + i * 20}
              fill={COLORS.gray[300]}
              fontSize={16}
              fontFamily="SourceSansPro-Regular"
              textAlign="left"
              textBaseline="top"
            >
              {`${t.name}: youtube.com/watch?v=${t.youtubeId}`}
            </Text>
          ))}
        </>
      )}
    </>
  );
}
