import React, { useEffect, useMemo } from "react";
import { Image, Rect, Text } from "react-tela";
import { Button } from "@nx.js/constants";
import { COLORS } from "../lib/colors";

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

interface AppDetailsPaneProps {
  app: Switch.Application;
  onClose: () => void;
}

const PANEL_PAD = 32;
const ICON_SIZE = 180;
const ROW_GAP = 8;
const LABEL_W = 200;
const ROW_H = 30;

export function AppDetailsPane({ app, onClose }: AppDetailsPaneProps) {
  const hasSaveData = useMemo(() => readHasSaveData(app), [app]);

  useEffect(() => {
    let rafId: number;
    let armed = false;
    let bWasPressed = false;
    let minusWasPressed = false;

    const loop = () => {
      const gamepad = navigator.getGamepads()[0];
      if (gamepad) {
        const isB = gamepad.buttons[Button.B].pressed;
        const isMinus = gamepad.buttons[Button.Minus].pressed;
        if (!armed) {
          if (!isB && !isMinus) armed = true;
        } else {
          if (isB && !bWasPressed) onClose();
          if (isMinus && !minusWasPressed) onClose();
        }
        bWasPressed = isB;
        minusWasPressed = isMinus;
      }
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [onClose]);

  const panelSize = useMemo(() => {
    const panelW = Math.min(820, screen.width - 48);
    const panelH = Math.min(340, screen.height - 48);
    return { panelW, panelH };
  }, []);

  const { panelW, panelH } = panelSize;
  const panelX = (screen.width - panelW) / 2;
  const panelY = (screen.height - panelH) / 2;

  const titleBlockH = 40;
  const textLeft = panelX + PANEL_PAD + ICON_SIZE + 24;
  const rowY0 = panelY + PANEL_PAD + titleBlockH + 8;
  const rows: { label: string; value: string }[] = [
    { label: "Name", value: app.name },
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
      <Rect
        x={0}
        y={0}
        width={screen.width}
        height={screen.height}
        fill="rgba(0,0,0,0.72)"
        onTouchStart={onClose}
      />
      <Rect
        x={panelX}
        y={panelY}
        width={panelW}
        height={panelH}
        fill={COLORS.gray[900]}
        stroke={COLORS.gray[600]}
        lineWidth={2}
        onTouchStart={() => {}}
      />
      <Text
        x={panelX + PANEL_PAD}
        y={panelY + PANEL_PAD}
        fill={COLORS.gray[100]}
        fontSize={24}
        fontFamily="SourceSansPro-Bold"
        textBaseline="top"
      >
        Application details
      </Text>
      {app.icon ? (
        <Image
          src={getIconObjectUrl(app, app.icon)}
          x={panelX + PANEL_PAD}
          y={rowY0}
          width={ICON_SIZE}
          height={ICON_SIZE}
        />
      ) : (
        <Rect
          x={panelX + PANEL_PAD}
          y={rowY0}
          width={ICON_SIZE}
          height={ICON_SIZE}
          fill={COLORS.gray[700]}
        />
      )}
      {rows.map((row, i) => {
        const y = rowY0 + i * (ROW_H + ROW_GAP);
        return (
          <React.Fragment key={row.label}>
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
          </React.Fragment>
        );
      })}
      <Text
        x={screen.width / 2}
        y={panelY + panelH - 22}
        fill={COLORS.gray[400]}
        fontSize={20}
        fontFamily="SourceSansPro-Regular"
        textAlign="center"
        textBaseline="middle"
      >
        B / − Close
      </Text>
    </>
  );
}
