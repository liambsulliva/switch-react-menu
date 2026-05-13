import React, { Fragment, useMemo } from "react";
import { Image, Rect, Text } from "react-tela";
import { COLORS } from "../lib/colors";
import { truncate } from "../lib/truncate";
import type { ModalLayout } from "./Modal";

const TITLE_MAX_LEN = 30;
const ICON_SIZE = 180;
const ROW_GAP = 8;
const LABEL_W = 200;
const ROW_H = 30;

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

function formatApplicationId(id: bigint): string {
  const hex = id.toString(16);
  return `0x${hex}`;
}

function readHasSaveData(app: Switch.Application): boolean {
  const found =
    typeof app.findSaveData === "function" ? app.findSaveData() : undefined;
  return found !== undefined;
}

export interface ApplicationDetailsContentProps {
  app: Switch.Application;
  layout: ModalLayout;
}

export function ApplicationDetailsContent({
  app,
  layout,
}: ApplicationDetailsContentProps) {
  const hasSaveData = useMemo(() => readHasSaveData(app), [app]);

  const { panelX, contentTop } = layout;
  const textLeft = panelX + 32 + ICON_SIZE + 24;

  const rows: { label: string; value: string }[] = [
    { label: "Name", value: truncate(app.name, TITLE_MAX_LEN) },
    { label: "Application ID", value: formatApplicationId(app.id) },
    { label: "Author", value: app.author },
    { label: "Version", value: app.version },
    {
      label: "Save data",
      value: hasSaveData ? "Present" : "None",
    },
  ];

  return (
    <>
      {app.icon ? (
        <Image
          src={getIconObjectUrl(app, app.icon)}
          x={panelX + 32}
          y={contentTop}
          width={ICON_SIZE}
          height={ICON_SIZE}
        />
      ) : (
        <Rect
          x={panelX + 32}
          y={contentTop}
          width={ICON_SIZE}
          height={ICON_SIZE}
          fill={COLORS.gray[700]}
        />
      )}
      {rows.map((row, i) => {
        const y = contentTop + i * (ROW_H + ROW_GAP);
        return (
          <Fragment key={row.label}>
            <Text
              x={textLeft}
              y={y}
              fill={COLORS.gray[400]}
              fontSize={22}
              fontFamily="SourceSansPro-Regular"
              textAlign="left"
              textBaseline="top"
            >
              {row.label}
            </Text>
            <Text
              x={textLeft + LABEL_W}
              y={y}
              fill={COLORS.gray[0]}
              fontSize={22}
              fontFamily="SourceSansPro-Regular"
              textAlign="left"
              textBaseline="top"
            >
              {row.value}
            </Text>
          </Fragment>
        );
      })}
    </>
  );
}
