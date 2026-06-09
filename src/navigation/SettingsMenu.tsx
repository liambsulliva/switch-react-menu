import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Button } from "@nx.js/constants";
import {
  getSettings,
  navigationStyleLabel,
  nextNavigationStyle,
  nextSortingMode,
  setSettings,
  sortingModeLabel,
  toggleSetting,
  useSettings,
  type AppSettings,
  type BooleanAppSettingKey,
} from "../settings/settingsStore";
import { List } from "../components/List";
import { HEADER_LAYOUT, HeaderLayout } from "../layouts/HeaderLayout";
import type { ListElementModel } from "../components/ListElement";

interface SettingsMenuProps {
  onClose: () => void;
  onCustomSort?: () => void;
  onEditRawgApiKey?: () => void;
  onRefreshRichDetails?: () => void;
}

type SettingsFocusArea = "list" | "back";

interface ButtonState {
  upPressed: boolean;
  downPressed: boolean;
  leftPressed: boolean;
  rightPressed: boolean;
  aPressed: boolean;
  bPressed: boolean;
  minusPressed: boolean;
}

interface HoldRepeatState {
  up: number | null;
  down: number | null;
  left: number | null;
}

const ITEM_HEIGHT = 72;
const listHeight =
  screen.height - HEADER_LAYOUT.contentTop - HEADER_LAYOUT.footerHeight;
const visibleCount = Math.floor(listHeight / ITEM_HEIGHT);
const panelWidth = screen.width - HEADER_LAYOUT.paddingX * 2;
const HOLD_REPEAT_INITIAL_DELAY_MS = 250;
const HOLD_REPEAT_INTERVAL_MS = 110;

type SettingsActionHandlers = {
  onCustomSort?: () => void;
  onEditRawgApiKey?: () => void;
  onRefreshRichDetails?: () => void;
};

type SettingRowConfig = {
  id: string;
  label: string;
  variant: "knob" | "action" | "caption";
  key?: BooleanAppSettingKey;
  caption?: (settings: AppSettings) => string;
  isDisabled?: (settings: AppSettings) => boolean;
  onSelect?: (handlers: SettingsActionHandlers) => void;
};

const SETTING_ROWS: SettingRowConfig[] = [
  {
    id: "disableRichDetails",
    key: "disableRichDetails",
    label: "Disable Rich Details",
    variant: "knob",
  },
  {
    id: "sortingMode",
    label: "Sorting Mode",
    variant: "caption",
    caption: (s) => sortingModeLabel(s.sortingMode),
    onSelect: (_handlers) => {
      const s = getSettings();
      setSettings({
        sortingMode: nextSortingMode(s.sortingMode, !s.disableRichDetails),
      });
    },
  },
  {
    id: "custom-sort",
    label: "Custom Sort",
    variant: "action",
    isDisabled: (currentSettings) => currentSettings.sortingMode !== "custom",
    onSelect: ({ onCustomSort }) => onCustomSort?.(),
  },
  {
    id: "navigationStyle",
    label: "Pagination Style",
    variant: "caption",
    caption: (s) => navigationStyleLabel(s.navigationStyle),
    isDisabled: (s) => !s.disableRichDetails,
    onSelect: (_handlers) => {
      const s = getSettings();
      setSettings({ navigationStyle: nextNavigationStyle(s.navigationStyle) });
    },
  },
  {
    id: "showAppTitles",
    key: "showAppTitles",
    label: "Show App Titles",
    variant: "knob",
    isDisabled: (s) => !s.disableRichDetails,
  },
  {
    id: "compactView",
    key: "compactView",
    label: "Compact View",
    variant: "knob",
    isDisabled: (s) => !s.disableRichDetails,
  },
  {
    id: "screensaver",
    key: "screensaver",
    label: "Screensaver",
    isDisabled: () => true,
    variant: "knob",
  },
  {
    id: "showLastPlayed",
    key: "showLastPlayed",
    label: "Show Last Played",
    variant: "knob",
  },
  {
    id: "rawgApiKey",
    label: "RAWG API Key",
    variant: "action",
    isDisabled: (s) => s.disableRichDetails,
    onSelect: ({ onEditRawgApiKey }) => onEditRawgApiKey?.(),
  },
  {
    id: "refreshRichDetails",
    label: "Refresh RAWG game details",
    variant: "action",
    isDisabled: (s) => s.disableRichDetails,
    onSelect: ({ onRefreshRichDetails }) => onRefreshRichDetails?.(),
  },
];

function ensureVisible(index: number, offset: number): number {
  if (index < offset) return index;
  if (index >= offset + visibleCount) return index - visibleCount + 1;
  return offset;
}

export function SettingsMenu({
  onClose,
  onCustomSort,
  onEditRawgApiKey,
  onRefreshRichDetails,
}: SettingsMenuProps) {
  const settings = useSettings();
  const listElements = useMemo<ListElementModel[]>(
    () =>
      SETTING_ROWS.map((row) => ({
        id: row.id,
        label: row.label,
        variant: row.variant,
        knobValue: row.key ? Boolean(settings[row.key]) : undefined,
        caption: row.caption?.(settings),
        disabled: row.isDisabled?.(settings) ?? false,
        onSelect: () => {
          if (row.key) {
            toggleSetting(row.key);
            return;
          }
          row.onSelect?.({
            onCustomSort,
            onEditRawgApiKey,
            onRefreshRichDetails,
          });
        },
      })),
    [settings, onCustomSort, onEditRawgApiKey, onRefreshRichDetails],
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
  const [focusArea, setFocusArea] = useState<SettingsFocusArea>("list");
  const [buttonState, setButtonState] = useState<ButtonState>({
    upPressed: false,
    downPressed: false,
    leftPressed: false,
    rightPressed: false,
    aPressed: false,
    bPressed: false,
    minusPressed: false,
  });
  const holdRepeatRef = useRef<HoldRepeatState>({
    up: null,
    down: null,
    left: null,
  });
  const gamepadArmedRef = useRef(false);

  const getNextSelectableIndex = useCallback(
    (current: number, direction: "up" | "down"): number => {
      if (selectableIndexes.length === 0) return current;
      if (!selectableIndexes.includes(current)) {
        return selectableIndexes[0]!;
      }
      let candidate = current;
      while (true) {
        candidate += direction === "up" ? -1 : 1;
        if (candidate < 0 || candidate >= totalItemCount) return current;
        if (!listElements[candidate]!.disabled) return candidate;
      }
    },
    [selectableIndexes, listElements, totalItemCount],
  );

  useEffect(() => {
    if (selectableIndexes.length === 0) return;
    if (!selectableIndexes.includes(selectedIndex)) {
      const next = selectableIndexes[0]!;
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
      const isLeft =
        gamepad.buttons[Button.Left].pressed ||
        (Math.abs(gamepad.axes[0]) > 0.5 && gamepad.axes[0] < -0.5);
      const isRight =
        gamepad.buttons[Button.Right].pressed ||
        (Math.abs(gamepad.axes[0]) > 0.5 && gamepad.axes[0] > 0.5);
      const isA = gamepad.buttons[Button.A].pressed;
      const isB = gamepad.buttons[Button.B].pressed;
      const isMinus = gamepad.buttons[Button.Minus].pressed;

      if (!gamepadArmedRef.current) {
        if (
          !isA &&
          !isB &&
          !isMinus &&
          !isUp &&
          !isDown &&
          !isLeft &&
          !isRight
        ) {
          gamepadArmedRef.current = true;
          holdRepeatRef.current = { up: null, down: null, left: null };
        }
        rafId = requestAnimationFrame(loop);
        return;
      }

      if (focusArea === "back") {
        if (isUp && !buttonState.upPressed) {
          setButtonState((prev) => ({ ...prev, upPressed: true }));
        } else if (!isUp && buttonState.upPressed) {
          setButtonState((prev) => ({ ...prev, upPressed: false }));
        }

        if (isDown && !buttonState.downPressed) {
          setButtonState((prev) => ({ ...prev, downPressed: true }));
          holdRepeatRef.current.down = now;
          gamepadArmedRef.current = false;
          setFocusArea("list");
        } else if (!isDown && buttonState.downPressed) {
          setButtonState((prev) => ({ ...prev, downPressed: false }));
          holdRepeatRef.current.down = null;
        }

        if (isLeft && !buttonState.leftPressed) {
          setButtonState((prev) => ({ ...prev, leftPressed: true }));
          holdRepeatRef.current.left = now;
          gamepadArmedRef.current = false;
          setFocusArea("list");
        } else if (
          isLeft &&
          buttonState.leftPressed &&
          canRepeat(holdRepeatRef.current.left, now)
        ) {
          /* no-op */
        } else if (!isLeft && buttonState.leftPressed) {
          setButtonState((prev) => ({ ...prev, leftPressed: false }));
          holdRepeatRef.current.left = null;
        }

        if (isRight && !buttonState.rightPressed) {
          setButtonState((prev) => ({ ...prev, rightPressed: true }));
        } else if (!isRight && buttonState.rightPressed) {
          setButtonState((prev) => ({ ...prev, rightPressed: false }));
        }

        if (isA && !buttonState.aPressed) {
          setButtonState((prev) => ({ ...prev, aPressed: true }));
          onClose();
        } else if (!isA && buttonState.aPressed) {
          setButtonState((prev) => ({ ...prev, aPressed: false }));
        }
      } else {
        const atTopOfList =
          selectableIndexes.length === 0 ||
          getNextSelectableIndex(selectedIndex, "up") === selectedIndex;

        if (isUp && !buttonState.upPressed) {
          setButtonState((prev) => ({ ...prev, upPressed: true }));
          holdRepeatRef.current.up = now;
          if (atTopOfList) {
            setFocusArea("back");
          } else {
            moveSelection("up");
          }
        } else if (
          isUp &&
          buttonState.upPressed &&
          canRepeat(holdRepeatRef.current.up, now)
        ) {
          if (!atTopOfList) moveSelection("up");
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
      }

      if (isB && !buttonState.bPressed) {
        setButtonState((prev) => ({ ...prev, bPressed: true }));
        onClose();
      } else if (!isB && buttonState.bPressed) {
        setButtonState((prev) => ({ ...prev, bPressed: false }));
      }

      if (isMinus && !buttonState.minusPressed) {
        setButtonState((prev) => ({ ...prev, minusPressed: true }));
        onClose();
      } else if (!isMinus && buttonState.minusPressed) {
        setButtonState((prev) => ({ ...prev, minusPressed: false }));
      }

      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [
    buttonState,
    focusArea,
    getNextSelectableIndex,
    listElements,
    onClose,
    selectableIndexes,
    selectedIndex,
  ]);

  const toggleItem = (index: number) => {
    if (listElements[index]?.disabled) return;
    setFocusArea("list");
    setSelectedIndex(index);
    listElements[index]?.onSelect?.();
  };

  const focusListRow = (index: number) => {
    setFocusArea("list");
    if (listElements[index]?.disabled) return;
    setSelectedIndex(index);
    setScrollOffset((off) => ensureVisible(index, off));
  };

  return (
    <HeaderLayout
      title="Settings"
      rightActionLabel="Back"
      rightActionActive={focusArea === "back"}
      onRightActionTouchStart={onClose}
      onRightActionMouseEnter={() => setFocusArea("back")}
      onRightActionMouseLeave={() => setFocusArea("list")}
      footerHint="A  Select      B / −  Back"
    >
      <List
        x={HEADER_LAYOUT.paddingX}
        top={HEADER_LAYOUT.contentTop}
        width={panelWidth}
        rowHeight={ITEM_HEIGHT}
        visibleCount={visibleCount}
        items={listElements}
        selectedIndex={selectedIndex}
        isFocused={focusArea === "list"}
        scrollOffset={scrollOffset}
        onItemTouchStart={toggleItem}
        onItemMouseEnter={focusListRow}
      />
    </HeaderLayout>
  );
}
