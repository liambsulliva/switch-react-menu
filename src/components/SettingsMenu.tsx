import React, { useEffect, useRef, useState } from "react";
import { Rect, Text } from "react-tela";
import { Button } from "@nx.js/constants";
import {
  SETTING_LABELS,
  SETTING_ORDER,
  toggleSetting,
  useSettings,
} from "../settings/settingsStore";

interface SettingsMenuProps {
  onClose: () => void;
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
const LIST_TOP = 130;
const PADDING_X = 64;
const FOOTER_HEIGHT = 80;

const listHeight = screen.height - LIST_TOP - FOOTER_HEIGHT;
const visibleCount = Math.floor(listHeight / ITEM_HEIGHT);
const panelWidth = screen.width - PADDING_X * 2;
const settingCount = SETTING_ORDER.length;

const TRACK_W = 56;
const TRACK_H = 28;
const KNOB_SIZE = 22;
const KNOB_PAD = 3;
const TRACK_X = PADDING_X + panelWidth - TRACK_W - 48;
const HOLD_REPEAT_INITIAL_DELAY_MS = 250;
const HOLD_REPEAT_INTERVAL_MS = 110;

function ensureVisible(index: number, offset: number): number {
  if (index < offset) return index;
  if (index >= offset + visibleCount) return index - visibleCount + 1;
  return offset;
}

export function SettingsMenu({ onClose }: SettingsMenuProps) {
  const settings = useSettings();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [buttonState, setButtonState] = useState<ButtonState>({
    upPressed: false,
    downPressed: false,
    aPressed: false,
    bPressed: false,
  });
  const holdRepeatRef = useRef<HoldRepeatState>({ up: null, down: null });

  useEffect(() => {
    let rafId: number;

    const canRepeat = (startedAt: number | null, now: number): boolean => {
      if (startedAt === null) {
        return true;
      }
      const heldFor = now - startedAt;
      if (heldFor < HOLD_REPEAT_INITIAL_DELAY_MS) {
        return false;
      }
      return heldFor % HOLD_REPEAT_INTERVAL_MS < 16;
    };

    const moveSelection = (direction: "up" | "down") => {
      setSelectedIndex((prev) => {
        const next =
          direction === "up"
            ? Math.max(0, prev - 1)
            : Math.min(settingCount - 1, prev + 1);
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
        toggleSetting(SETTING_ORDER[selectedIndex]);
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
  }, [buttonState, selectedIndex, onClose]);

  const toggleItem = (index: number) => {
    toggleSetting(SETTING_ORDER[index]);
    setSelectedIndex(index);
  };

  const scrollbarTrackHeight = listHeight;
  const scrollbarThumbHeight = Math.max(
    24,
    (visibleCount / settingCount) * scrollbarTrackHeight,
  );
  const scrollbarThumbY =
    LIST_TOP +
    (scrollOffset / (settingCount - visibleCount)) *
      (scrollbarTrackHeight - scrollbarThumbHeight);

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
        Settings
      </Text>

      {/* Header: back hint — text centered inside its touch target */}
      <Text
        x={screen.width - PADDING_X - 60}
        y={80}
        fill="#666"
        fontSize={24}
        fontFamily="SourceSansPro-Regular"
        textAlign="center"
        textBaseline="middle"
      >
        B Back
      </Text>
      {/* Back button hitbox — centered on the text above */}
      <Rect
        x={screen.width - PADDING_X - 120}
        y={50}
        width={120}
        height={60}
        fill="transparent"
        onTouchStart={onClose}
      />

      {/* Header divider */}
      <Rect x={PADDING_X} y={112} width={panelWidth} height={1} fill="#222" />

      {/* Settings rows */}
      {SETTING_ORDER.slice(
        scrollOffset,
        scrollOffset + visibleCount,
      ).map((settingKey, i) => {
        const absoluteIndex = scrollOffset + i;
        const isSelected = absoluteIndex === selectedIndex;
        const value = settings[settingKey];
        const label = SETTING_LABELS[settingKey];
        const rowY = LIST_TOP + i * ITEM_HEIGHT;
        const trackY = rowY + (ITEM_HEIGHT - TRACK_H) / 2;
        const knobX =
          TRACK_X + (value ? TRACK_W - KNOB_SIZE - KNOB_PAD : KNOB_PAD);
        const knobY = trackY + (TRACK_H - KNOB_SIZE) / 2;

        return (
          <React.Fragment key={absoluteIndex}>
            {/* Selection highlight */}
            {isSelected && (
              <Rect
                x={PADDING_X}
                y={rowY}
                width={panelWidth}
                height={ITEM_HEIGHT}
                fill="#1a1a1a"
              />
            )}

            {/* Row separator */}
            <Rect
              x={PADDING_X}
              y={rowY + ITEM_HEIGHT - 1}
              width={panelWidth}
              height={1}
              fill="#1e1e1e"
            />

            {/* Touch target — full row, centered on the row */}
            <Rect
              x={PADDING_X}
              y={rowY}
              width={panelWidth}
              height={ITEM_HEIGHT}
              fill="transparent"
              onTouchStart={() => toggleItem(absoluteIndex)}
            />

            {/* Label — vertically centered in row */}
            <Text
              x={PADDING_X + 24}
              y={rowY + ITEM_HEIGHT / 2}
              fill={isSelected ? "white" : "#999"}
              fontSize={26}
              fontFamily={
                isSelected ? "SourceSansPro-Bold" : "SourceSansPro-Regular"
              }
              textBaseline="middle"
            >
              {label}
            </Text>

            {/* Toggle track */}
            <Rect
              x={TRACK_X}
              y={trackY}
              width={TRACK_W}
              height={TRACK_H}
              fill={value ? "#4a9eff" : "#333"}
            />

            {/* Toggle knob */}
            <Rect
              x={knobX}
              y={knobY}
              width={KNOB_SIZE}
              height={KNOB_SIZE}
              fill={value ? "white" : "#666"}
            />
          </React.Fragment>
        );
      })}

      {/* Scrollbar track */}
      {settingCount > visibleCount && (
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
        {"A  Toggle      B  Back"}
      </Text>
    </>
  );
}
