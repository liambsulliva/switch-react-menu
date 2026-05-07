import React, { useEffect, useMemo, useRef, useState } from "react";
import { Image, Rect, Text } from "react-tela";
import { Button } from "@nx.js/constants";
import { truncate } from "../lib/truncate";
import { SettingsMenu } from "./SettingsMenu";
import {
  recordLastPlayed,
  useLastPlayedApplicationId,
} from "../settings/lastPlayedStore";
import { useSettings } from "../settings/settingsStore";

const ROW_HEIGHT = 84;
const LIST_TOP = 130;
const PADDING_X = 64;
const FOOTER_HEIGHT = 80;
const ICON_SIZE = 60;
const ICON_GUTTER = 24;

const listHeight = screen.height - LIST_TOP - FOOTER_HEIGHT;
const visibleRowCount = Math.floor(listHeight / ROW_HEIGHT);
const panelWidth = screen.width - PADDING_X * 2;

const HOLD_REPEAT_INITIAL_DELAY_MS = 250;
const HOLD_REPEAT_INTERVAL_MS = 110;

type ListFocusArea = "apps" | "settings";

interface ButtonState {
  upPressed: boolean;
  downPressed: boolean;
  leftPressed: boolean;
  rightPressed: boolean;
  aPressed: boolean;
  plusPressed: boolean;
}

interface HoldRepeatState {
  up: number | null;
  down: number | null;
}

// Same per-id cache strategy as `AppIcon`: avoid leaking a fresh blob URL on every render.
const iconUrlCache = new Map<string, string>();

function getIconUrl(app: { id: bigint }, icon: ArrayBuffer): string {
  const key = app.id.toString();
  let url = iconUrlCache.get(key);
  if (!url) {
    url = URL.createObjectURL(new Blob([icon]));
    iconUrlCache.set(key, url);
  }
  return url;
}

function ensureVisible(index: number, offset: number): number {
  if (index < offset) return index;
  if (index >= offset + visibleRowCount) return index - visibleRowCount + 1;
  return offset;
}

export function CompactHome() {
  const settings = useSettings();
  const lastPlayedId = useLastPlayedApplicationId();
  const [apps, setApps] = useState<Switch.Application[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [focusArea, setFocusArea] = useState<ListFocusArea>("apps");
  const [showSettings, setShowSettings] = useState(false);

  const [buttonState, setButtonState] = useState<ButtonState>({
    upPressed: false,
    downPressed: false,
    leftPressed: false,
    rightPressed: false,
    aPressed: false,
    plusPressed: false,
  });
  const holdRepeatRef = useRef<HoldRepeatState>({ up: null, down: null });
  const gamepadArmedRef = useRef(false);

  useEffect(() => {
    const loaded = Array.from(Switch.Application).filter((app) => app.icon);
    setApps(loaded);
  }, []);

  const sortedApps = useMemo(() => {
    if (!settings.alphabeticalSort) return apps;
    return [...apps].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
    );
  }, [apps, settings.alphabeticalSort]);

  const appCount = sortedApps.length;

  // Keep selection within the bounds of the (possibly shrinking) app list.
  useEffect(() => {
    if (appCount === 0) {
      if (selectedIndex !== 0) setSelectedIndex(0);
      if (scrollOffset !== 0) setScrollOffset(0);
      return;
    }
    if (selectedIndex >= appCount) {
      const next = appCount - 1;
      setSelectedIndex(next);
      setScrollOffset((off) => ensureVisible(next, off));
    }
  }, [appCount, selectedIndex, scrollOffset]);

  useEffect(() => {
    if (showSettings) return;
    let rafId: number;

    const canRepeat = (startedAt: number | null, now: number): boolean => {
      if (startedAt === null) return true;
      const heldFor = now - startedAt;
      if (heldFor < HOLD_REPEAT_INITIAL_DELAY_MS) return false;
      return heldFor % HOLD_REPEAT_INTERVAL_MS < 16;
    };

    const moveSelection = (direction: "up" | "down") => {
      if (appCount === 0) return;
      setFocusArea("apps");
      setSelectedIndex((prev) => {
        const next =
          direction === "up"
            ? Math.max(0, prev - 1)
            : Math.min(appCount - 1, prev + 1);
        setScrollOffset((off) => ensureVisible(next, off));
        return next;
      });
    };

    const launchSelected = () => {
      const app = sortedApps[selectedIndex];
      if (!app) return;
      recordLastPlayed(app);
      app.launch();
    };

    const loop = () => {
      const now = Date.now();
      const gamepad = navigator.getGamepads()[0];
      if (!gamepad) {
        rafId = requestAnimationFrame(loop);
        return;
      }

      const isUp =
        gamepad.buttons[Button.Up].pressed ||
        (Math.abs(gamepad.axes[1]) > 0.5 && gamepad.axes[1] < -0.5);
      const isDown =
        gamepad.buttons[Button.Down].pressed ||
        (Math.abs(gamepad.axes[1]) > 0.5 && gamepad.axes[1] > 0.5);
      const isLeft =
        gamepad.buttons[Button.Left].pressed ||
        (Math.abs(gamepad.axes[0]) > 0.5 && gamepad.axes[0] < -0.5);
      const isRight =
        gamepad.buttons[Button.Right].pressed ||
        (Math.abs(gamepad.axes[0]) > 0.5 && gamepad.axes[0] > 0.5);
      const isA = gamepad.buttons[Button.A].pressed;
      const isPlus = gamepad.buttons[Button.Plus].pressed;

      if (!gamepadArmedRef.current) {
        if (!isA && !isPlus && !isUp && !isDown && !isLeft && !isRight) {
          gamepadArmedRef.current = true;
          holdRepeatRef.current = { up: null, down: null };
        }
        rafId = requestAnimationFrame(loop);
        return;
      }

      if (isUp && !buttonState.upPressed) {
        setButtonState((prev) => ({ ...prev, upPressed: true }));
        holdRepeatRef.current.up = now;
        if (focusArea === "settings") {
          // already at the top... should stay focused on Settings
        } else {
          if (selectedIndex === 0) {
            setFocusArea("settings");
          } else {
            moveSelection("up");
          }
        }
      } else if (
        isUp &&
        buttonState.upPressed &&
        canRepeat(holdRepeatRef.current.up, now)
      ) {
        if (focusArea !== "settings") moveSelection("up");
      } else if (!isUp && buttonState.upPressed) {
        setButtonState((prev) => ({ ...prev, upPressed: false }));
        holdRepeatRef.current.up = null;
      }

      if (isDown && !buttonState.downPressed) {
        setButtonState((prev) => ({ ...prev, downPressed: true }));
        holdRepeatRef.current.down = now;
        if (focusArea === "settings") {
          setFocusArea("apps");
        } else {
          moveSelection("down");
        }
      } else if (
        isDown &&
        buttonState.downPressed &&
        canRepeat(holdRepeatRef.current.down, now)
      ) {
        if (focusArea !== "settings") moveSelection("down");
      } else if (!isDown && buttonState.downPressed) {
        setButtonState((prev) => ({ ...prev, downPressed: false }));
        holdRepeatRef.current.down = null;
      }

      if (isRight && !buttonState.rightPressed) {
        setButtonState((prev) => ({ ...prev, rightPressed: true }));
        if (focusArea === "apps" && selectedIndex < 2) {
          setFocusArea("settings");
        }
      } else if (!isRight && buttonState.rightPressed) {
        setButtonState((prev) => ({ ...prev, rightPressed: false }));
      }

      if (isLeft && !buttonState.leftPressed) {
        setButtonState((prev) => ({ ...prev, leftPressed: true }));
        if (focusArea === "settings") {
          setFocusArea("apps");
        }
      } else if (!isLeft && buttonState.leftPressed) {
        setButtonState((prev) => ({ ...prev, leftPressed: false }));
      }

      if (isA && !buttonState.aPressed) {
        setButtonState((prev) => ({ ...prev, aPressed: true }));
        if (focusArea === "settings") {
          setShowSettings(true);
        } else {
          launchSelected();
        }
      } else if (!isA && buttonState.aPressed) {
        setButtonState((prev) => ({ ...prev, aPressed: false }));
      }

      if (isPlus && !buttonState.plusPressed) {
        setButtonState((prev) => ({ ...prev, plusPressed: true }));
        setShowSettings(true);
      } else if (!isPlus && buttonState.plusPressed) {
        setButtonState((prev) => ({ ...prev, plusPressed: false }));
      }

      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [buttonState, sortedApps, selectedIndex, focusArea, appCount, showSettings]);

  useEffect(() => {
    if (showSettings) {
      gamepadArmedRef.current = false;
    }
  }, [showSettings]);

  if (showSettings) {
    return <SettingsMenu onClose={() => setShowSettings(false)} />;
  }

  const showScrollbar = appCount > visibleRowCount;
  const visibleRows = sortedApps.slice(
    scrollOffset,
    scrollOffset + visibleRowCount,
  );

  const scrollDenominator = Math.max(1, appCount - visibleRowCount);
  const scrollbarTrackHeight = listHeight;
  const scrollbarThumbHeight = Math.max(
    24,
    (visibleRowCount / Math.max(1, appCount)) * scrollbarTrackHeight,
  );
  const scrollbarThumbY =
    LIST_TOP +
    (scrollOffset / scrollDenominator) *
      (scrollbarTrackHeight - scrollbarThumbHeight);

  const labelLeftX = PADDING_X + ICON_GUTTER + ICON_SIZE + 24;
  const versionRightX =
    PADDING_X + panelWidth - (showScrollbar ? 32 : 24);

  return (
    <>
      {/* Background */}
      <Rect
        x={0}
        y={0}
        width={screen.width}
        height={screen.height}
        fill="#0f0f0f"
      />

      {/* Header: title */}
      <Text
        x={PADDING_X}
        y={80}
        fill="white"
        fontSize={36}
        fontFamily="SourceSansPro-Bold"
        textBaseline="middle"
      >
        All Applications
      </Text>

      {/* Header: settings target — same hit-target shape as the home page */}
      <Text
        x={screen.width - PADDING_X - 60}
        y={80}
        fill={focusArea === "settings" ? "#fff" : "#666"}
        fontSize={26}
        fontFamily={
          focusArea === "settings"
            ? "SourceSansPro-Bold"
            : "SourceSansPro-Regular"
        }
        textAlign="center"
        textBaseline="middle"
      >
        Settings
      </Text>
      <Rect
        x={screen.width - PADDING_X - 120}
        y={50}
        width={120}
        height={60}
        fill="transparent"
        onTouchStart={() => setShowSettings(true)}
      />

      {/* Header divider */}
      <Rect x={PADDING_X} y={112} width={panelWidth} height={1} fill="#222" />

      {/* App rows */}
      {visibleRows.map((app, i) => {
        const absoluteIndex = scrollOffset + i;
        const isSelected =
          focusArea === "apps" && absoluteIndex === selectedIndex;
        const rowY = LIST_TOP + i * ROW_HEIGHT;
        const iconY = rowY + (ROW_HEIGHT - ICON_SIZE) / 2;
        const isLastPlayed =
          settings.showLastPlayed &&
          lastPlayedId !== null &&
          app.id.toString() === lastPlayedId;
        const labelCenterY = isLastPlayed
          ? rowY + ROW_HEIGHT / 2 + 6
          : rowY + ROW_HEIGHT / 2;

        const onRowTouch = () => {
          setFocusArea("apps");
          if (selectedIndex !== absoluteIndex) {
            setSelectedIndex(absoluteIndex);
            setScrollOffset((off) => ensureVisible(absoluteIndex, off));
            return;
          }
          recordLastPlayed(app);
          app.launch();
        };

        return (
          <React.Fragment key={app.id.toString()}>
            {isSelected && (
              <Rect
                x={PADDING_X}
                y={rowY}
                width={panelWidth}
                height={ROW_HEIGHT}
                fill="#1a1a1a"
              />
            )}

            {/* Row separator */}
            <Rect
              x={PADDING_X}
              y={rowY + ROW_HEIGHT - 1}
              width={panelWidth}
              height={1}
              fill="#1e1e1e"
            />

            {/* Touch target — full row */}
            <Rect
              x={PADDING_X}
              y={rowY}
              width={panelWidth}
              height={ROW_HEIGHT}
              fill="transparent"
              onTouchStart={onRowTouch}
            />

            {app.icon && (
              <Image
                src={getIconUrl(app, app.icon)}
                x={PADDING_X + ICON_GUTTER}
                y={iconY}
                width={ICON_SIZE}
                height={ICON_SIZE}
              />
            )}

            {isLastPlayed && (
              <Text
                x={labelLeftX}
                y={rowY + ROW_HEIGHT / 2 - 16}
                fill="#8ec5ff"
                fontSize={16}
                fontFamily="SourceSansPro-Bold"
                textBaseline="middle"
              >
                Last Played!
              </Text>
            )}

            {settings.showAppTitles && (
              <Text
                x={labelLeftX}
                y={labelCenterY}
                fill={isSelected ? "white" : "#ddd"}
                fontSize={26}
                fontFamily={
                  isSelected
                    ? "SourceSansPro-Bold"
                    : "SourceSansPro-Regular"
                }
                textBaseline="middle"
              >
                {truncate(app.name, 38)}
              </Text>
            )}

            <Text
              x={versionRightX}
              y={rowY + ROW_HEIGHT / 2}
              fill={isSelected ? "#bbb" : "#555"}
              fontSize={20}
              fontFamily="SourceSansPro-Regular"
              textAlign="right"
              textBaseline="middle"
            >
              {`v${app.version}`}
            </Text>
          </React.Fragment>
        );
      })}

      {/* Empty-state message */}
      {appCount === 0 && (
        <Text
          x={screen.width / 2}
          y={LIST_TOP + listHeight / 2}
          fill="#555"
          fontSize={26}
          fontFamily="SourceSansPro-Regular"
          textAlign="center"
          textBaseline="middle"
        >
          No applications installed.
        </Text>
      )}

      {/* Scrollbar */}
      {showScrollbar && (
        <>
          <Rect
            x={screen.width - PADDING_X + 8}
            y={LIST_TOP}
            width={4}
            height={scrollbarTrackHeight}
            fill="#222"
          />
          <Rect
            x={screen.width - PADDING_X + 8}
            y={scrollbarThumbY}
            width={4}
            height={scrollbarThumbHeight}
            fill="#555"
          />
        </>
      )}

      {/* Footer divider */}
      <Rect
        x={PADDING_X}
        y={screen.height - FOOTER_HEIGHT}
        width={panelWidth}
        height={1}
        fill="#222"
      />

      {/* Footer hints */}
      <Text
        x={PADDING_X}
        y={screen.height - FOOTER_HEIGHT / 2}
        fill="#555"
        fontSize={22}
        fontFamily="SourceSansPro-Regular"
        textBaseline="middle"
      >
        {"A  Launch      +  Settings"}
      </Text>
    </>
  );
}
