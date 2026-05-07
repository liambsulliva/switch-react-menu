import React, { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@nx.js/constants";
import {
  toggleSetting,
  useSettings,
  type AppSettings,
} from "../settings/settingsStore";
import { List } from "../components/List";
import { HEADER_LAYOUT, HeaderLayout } from "../layouts/HeaderLayout";
import type { ListElementModel } from "../components/ListElement";

interface SettingsMenuProps {
  onClose: () => void;
  onCustomSort?: () => void;
}

interface ButtonState {
  upPressed: boolean;
  downPressed: boolean;
  aPressed: boolean;
  bPressed: boolean;
}

interface HoldRepeatState {
  up: number | null;
  down: number | null;
}

const ITEM_HEIGHT = 72;
const listHeight =
  screen.height - HEADER_LAYOUT.contentTop - HEADER_LAYOUT.footerHeight;
const visibleCount = Math.floor(listHeight / ITEM_HEIGHT);
const panelWidth = screen.width - HEADER_LAYOUT.paddingX * 2;
const HOLD_REPEAT_INITIAL_DELAY_MS = 250;
const HOLD_REPEAT_INTERVAL_MS = 110;

type SettingRowConfig = {
  id: string;
  label: string;
  variant: "knob" | "action";
  key?: keyof AppSettings;
  isDisabled?: (settings: AppSettings) => boolean;
  onSelect?: (onCustomSort?: () => void) => void;
};

const SETTING_ROWS: SettingRowConfig[] = [
  {
    id: "showAppTitles",
    key: "showAppTitles",
    label: "Show App Titles",
    variant: "knob",
  },
  {
    id: "enableHaptics",
    key: "enableHaptics",
    label: "Enable Haptics",
    isDisabled: () => true,
    variant: "knob",
  },
  {
    id: "showPageNumbers",
    key: "showPageNumbers",
    label: "Show Page Numbers",
    isDisabled: () => true,
    variant: "knob",
  },
  {
    id: "alphabeticalSort",
    key: "alphabeticalSort",
    label: "Alphabetical Sort",
    variant: "knob",
  },
  {
    id: "compactView",
    key: "compactView",
    label: "Compact View",
    variant: "knob",
  },
  {
    id: "showLastPlayed",
    key: "showLastPlayed",
    label: "Show Last Played",
    variant: "knob",
    isDisabled: (currentSettings) => !currentSettings.showAppTitles,
  },
  {
    id: "enableSounds",
    key: "enableSounds",
    label: "Enable Sounds",
    isDisabled: () => true,
    variant: "knob",
  },
  {
    id: "screensaver",
    key: "screensaver",
    label: "Screensaver",
    isDisabled: () => true,
    variant: "knob",
  },
  {
    id: "custom-sort",
    label: "Custom Sort",
    variant: "action",
    isDisabled: (currentSettings) => currentSettings.alphabeticalSort,
    onSelect: (onCustomSort) => onCustomSort?.(),
  },
];

function ensureVisible(index: number, offset: number): number {
  if (index < offset) return index;
  if (index >= offset + visibleCount) return index - visibleCount + 1;
  return offset;
}

export function SettingsMenu({ onClose, onCustomSort }: SettingsMenuProps) {
  const settings = useSettings();
  const listElements = useMemo<ListElementModel[]>(
    () =>
      SETTING_ROWS.map((row) => ({
        id: row.id,
        label: row.label,
        variant: row.variant,
        knobValue: row.key ? settings[row.key] : undefined,
        disabled: row.isDisabled?.(settings) ?? false,
        onSelect: () => {
          if (row.key) {
            toggleSetting(row.key);
            return;
          }
          row.onSelect?.(onCustomSort);
        },
      })),
    [settings, onCustomSort],
  );
  const selectableIndexes = useMemo(
    () =>
      listElements
        .map((item, index) => ({ item, index }))
        .filter(({ item }) => !item.disabled)
        .map(({ index }) => index),
    [listElements],
  );
  const totalItemCount = listElements.length;
  const [selectedIndex, setSelectedIndex] = useState(
    () => selectableIndexes[0] ?? 0,
  );
  const [scrollOffset, setScrollOffset] = useState(0);
  const [buttonState, setButtonState] = useState<ButtonState>({
    upPressed: false,
    downPressed: false,
    aPressed: false,
    bPressed: false,
  });
  const holdRepeatRef = useRef<HoldRepeatState>({ up: null, down: null });
  const gamepadArmedRef = useRef(false);

  const getNextSelectableIndex = (
    current: number,
    direction: "up" | "down",
  ): number => {
    if (selectableIndexes.length === 0) return current;
    if (!selectableIndexes.includes(current)) {
      return selectableIndexes[0];
    }
    let candidate = current;
    while (true) {
      candidate += direction === "up" ? -1 : 1;
      if (candidate < 0 || candidate >= totalItemCount) return current;
      if (!listElements[candidate].disabled) return candidate;
    }
  };

  useEffect(() => {
    if (selectableIndexes.length === 0) return;
    if (!selectableIndexes.includes(selectedIndex)) {
      const next = selectableIndexes[0];
      setSelectedIndex(next);
      setScrollOffset((off) => ensureVisible(next, off));
    }
  }, [selectableIndexes, selectedIndex]);

  useEffect(() => {
    let rafId: number;

    const canRepeat = (startedAt: number | null, now: number): boolean => {
      if (startedAt === null) return true;
      const heldFor = now - startedAt;
      if (heldFor < HOLD_REPEAT_INITIAL_DELAY_MS) return false;
      return heldFor % HOLD_REPEAT_INTERVAL_MS < 16;
    };

    const moveSelection = (direction: "up" | "down") => {
      setSelectedIndex((prev) => {
        const next = getNextSelectableIndex(prev, direction);
        setScrollOffset((off) => ensureVisible(next, off));
        return next;
      });
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
      const isA = gamepad.buttons[Button.A].pressed;
      const isB = gamepad.buttons[Button.B].pressed;

      if (!gamepadArmedRef.current) {
        if (!isA && !isB && !isUp && !isDown) {
          gamepadArmedRef.current = true;
          holdRepeatRef.current = { up: null, down: null };
        }
        rafId = requestAnimationFrame(loop);
        return;
      }

      if (isUp && !buttonState.upPressed) {
        setButtonState((prev) => ({ ...prev, upPressed: true }));
        holdRepeatRef.current.up = now;
        moveSelection("up");
      } else if (
        isUp &&
        buttonState.upPressed &&
        canRepeat(holdRepeatRef.current.up, now)
      ) {
        moveSelection("up");
      } else if (!isUp && buttonState.upPressed) {
        setButtonState((prev) => ({ ...prev, upPressed: false }));
        holdRepeatRef.current.up = null;
      }

      if (isDown && !buttonState.downPressed) {
        setButtonState((prev) => ({ ...prev, downPressed: true }));
        holdRepeatRef.current.down = now;
        moveSelection("down");
      } else if (
        isDown &&
        buttonState.downPressed &&
        canRepeat(holdRepeatRef.current.down, now)
      ) {
        moveSelection("down");
      } else if (!isDown && buttonState.downPressed) {
        setButtonState((prev) => ({ ...prev, downPressed: false }));
        holdRepeatRef.current.down = null;
      }

      if (isA && !buttonState.aPressed) {
        setButtonState((prev) => ({ ...prev, aPressed: true }));
        listElements[selectedIndex]?.onSelect?.();
      } else if (!isA && buttonState.aPressed) {
        setButtonState((prev) => ({ ...prev, aPressed: false }));
      }

      if (isB && !buttonState.bPressed) {
        setButtonState((prev) => ({ ...prev, bPressed: true }));
        onClose();
      } else if (!isB && buttonState.bPressed) {
        setButtonState((prev) => ({ ...prev, bPressed: false }));
      }

      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [buttonState, selectedIndex, onClose, listElements]);

  const toggleItem = (index: number) => {
    if (listElements[index]?.disabled) return;
    setSelectedIndex(index);
    listElements[index]?.onSelect?.();
  };

  return (
    <HeaderLayout
      title="Settings"
      rightActionLabel="B Back"
      onRightActionTouchStart={onClose}
      footerHint="A  Select      B  Back"
    >
      <List
        x={HEADER_LAYOUT.paddingX}
        top={HEADER_LAYOUT.contentTop}
        width={panelWidth}
        rowHeight={ITEM_HEIGHT}
        visibleCount={visibleCount}
        items={listElements}
        selectedIndex={selectedIndex}
        scrollOffset={scrollOffset}
        onItemTouchStart={toggleItem}
      />
    </HeaderLayout>
  );
}
