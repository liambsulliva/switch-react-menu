import React, { useEffect, useMemo, useRef, useState } from "react";
import { Text } from "react-tela";
import { Button } from "@nx.js/constants";
import { truncate } from "../lib/truncate";
import { CustomSortMode } from "./CustomSortMode";
import { SettingsMenu } from "./SettingsMenu";
import { COLORS } from "../lib/colors";
import { List } from "../components/List";
import { HEADER_LAYOUT, HeaderLayout } from "../layouts/HeaderLayout";
import type { ListElementModel } from "../components/ListElement";
import {
  recordLastPlayed,
  useLastPlayedApplicationId,
} from "../settings/lastPlayedStore";
import { setSettings, useSettings } from "../settings/settingsStore";
import { setCustomOrder, useCustomOrder } from "../settings/customSortStore";

const ROW_HEIGHT = 84;
const listHeight =
  screen.height - HEADER_LAYOUT.contentTop - HEADER_LAYOUT.footerHeight;
const visibleRowCount = Math.floor(listHeight / ROW_HEIGHT);
const panelWidth = screen.width - HEADER_LAYOUT.paddingX * 2;

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
  const customOrder = useCustomOrder();
  const lastPlayedId = useLastPlayedApplicationId();
  const [apps, setApps] = useState<Switch.Application[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [focusArea, setFocusArea] = useState<ListFocusArea>("apps");
  const [showSettings, setShowSettings] = useState(false);
  const [showCustomSort, setShowCustomSort] = useState(false);

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

  useEffect(() => {
    if (!settings.alphabeticalSort) return;
    const alphabeticalOrder = [...apps]
      .sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
      )
      .map((app) => app.id.toString());
    setCustomOrder(alphabeticalOrder);
  }, [settings.alphabeticalSort, apps]);

  const sortedApps = useMemo(() => {
    if (settings.alphabeticalSort) {
      return [...apps].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
      );
    }
    if (customOrder.length > 0) {
      const orderMap = new Map(customOrder.map((id, i) => [id, i]));
      return [...apps].sort((a, b) => {
        const ai = orderMap.get(a.id.toString()) ?? Infinity;
        const bi = orderMap.get(b.id.toString()) ?? Infinity;
        return ai - bi;
      });
    }
    return apps;
  }, [apps, settings.alphabeticalSort, customOrder]);

  const appCount = sortedApps.length;

  const listItems = useMemo<ListElementModel[]>(
    () =>
      sortedApps.map((app, index) => {
        const isSelected = focusArea === "apps" && index === selectedIndex;
        const isLastPlayed =
          settings.showLastPlayed &&
          lastPlayedId !== null &&
          app.id.toString() === lastPlayedId;
        return {
          id: app.id.toString(),
          label: settings.showAppTitles ? truncate(app.name, 38) : "",
          variant: "game" as const,
          gameIconSrc: app.icon ? getIconUrl(app, app.icon) : undefined,
          gameVersion: `v${app.version}`,
          gameEyebrow: isLastPlayed ? "Last Played!" : undefined,
          valueColorOverride: isSelected ? COLORS.gray[0] : COLORS.gray[200],
        };
      }),
    [
      sortedApps,
      focusArea,
      selectedIndex,
      settings.showLastPlayed,
      settings.showAppTitles,
      lastPlayedId,
    ],
  );

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
    if (showSettings || showCustomSort) return;
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
  }, [
    buttonState,
    sortedApps,
    selectedIndex,
    focusArea,
    appCount,
    showSettings,
    showCustomSort,
  ]);

  useEffect(() => {
    if (showSettings || showCustomSort) {
      gamepadArmedRef.current = false;
    }
  }, [showSettings, showCustomSort]);

  if (showSettings) {
    return (
      <SettingsMenu
        onClose={() => setShowSettings(false)}
        onCustomSort={() => {
          setSettings({ alphabeticalSort: false });
          setShowSettings(false);
          setShowCustomSort(true);
        }}
      />
    );
  }

  if (showCustomSort) {
    return (
      <CustomSortMode
        apps={sortedApps}
        compact={true}
        onDone={(newOrder) => {
          setCustomOrder(newOrder);
          setShowCustomSort(false);
        }}
        onCancel={() => setShowCustomSort(false)}
      />
    );
  }

  return (
    <HeaderLayout
      title="All Applications"
      rightActionLabel="Settings"
      rightActionActive={focusArea === "settings"}
      onRightActionTouchStart={() => setShowSettings(true)}
      footerHint="A  Launch      +  Settings"
    >
      <List
        x={HEADER_LAYOUT.paddingX}
        top={HEADER_LAYOUT.contentTop}
        width={panelWidth}
        rowHeight={ROW_HEIGHT}
        visibleCount={visibleRowCount}
        items={listItems}
        selectedIndex={selectedIndex}
        isFocused={focusArea === "apps"}
        scrollOffset={scrollOffset}
        onItemTouchStart={(absoluteIndex) => {
          const app = sortedApps[absoluteIndex];
          if (!app) return;
          setFocusArea("apps");
          if (selectedIndex !== absoluteIndex) {
            setSelectedIndex(absoluteIndex);
            setScrollOffset((off) => ensureVisible(absoluteIndex, off));
            return;
          }
          recordLastPlayed(app);
          app.launch();
        }}
      />

      {appCount === 0 && (
        <Text
          x={screen.width / 2}
          y={HEADER_LAYOUT.contentTop + listHeight / 2}
          fill={COLORS.gray[600]}
          fontSize={26}
          fontFamily="SourceSansPro-Regular"
          textAlign="center"
          textBaseline="middle"
        >
          No applications installed.
        </Text>
      )}
    </HeaderLayout>
  );
}
