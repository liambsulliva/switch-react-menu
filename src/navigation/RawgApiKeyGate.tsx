import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { Button } from "@nx.js/constants";
import { Rect, Text } from "react-tela";
import { Button as ActionButton } from "../components/Button";
import {
  Input,
  handleVirtualKeyboardFaceButton,
  INPUT_VIRTUAL_KEYBOARD_FOOTER_HINT,
} from "../components/Input";
import { COLORS } from "../lib/colors";
import { HEADER_LAYOUT, HeaderLayout } from "../layouts/HeaderLayout";
import {
  getNxVirtualKeyboard,
  useSwitchVirtualKeyboard,
} from "../hooks/useSwitchVirtualKeyboard";
import { RawgApiError, validateRawgApiKey } from "../lib/rawgApiClient";
import {
  clearRawgApiKey,
  getRawgApiKey,
  setRawgApiKey,
} from "../settings/rawgApiKeyStore";

export type RawgApiKeyGateMode = "required" | "settings";

export interface RawgApiKeyGateProps {
  mode?: RawgApiKeyGateMode;
  onComplete: () => void;
  onCancel?: () => void;
}

const INPUT_H = 72;
const ACTION_H = 64;
const PANEL_TOP = HEADER_LAYOUT.contentTop + 24;

export function RawgApiKeyGate({
  mode = "required",
  onComplete,
  onCancel,
}: RawgApiKeyGateProps) {
  const [value, setValue] = useState(() => getRawgApiKey());
  const [editing, setEditing] = useState(mode === "required");
  const [focusArea, setFocusArea] = useState<"field" | "continue" | "clear" | "back">(
    "field",
  );
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const valueRef = useRef(value);
  valueRef.current = value;

  const { text: vkText, deleteLastChar: deleteLastVkChar } =
    useSwitchVirtualKeyboard(editing, {
      initialValue: () => valueRef.current,
    });

  useEffect(() => {
    if (!editing) return;
    const vk = getNxVirtualKeyboard();
    if (vk) {
      vk.value = valueRef.current;
    }
  }, [editing]);

  useEffect(() => {
    if (!editing) return;
    setValue(vkText);
  }, [editing, vkText]);

  const panelW = screen.width - HEADER_LAYOUT.paddingX * 2;
  const contentX = HEADER_LAYOUT.paddingX;
  const fieldY = PANEL_TOP + 56;
  const continueY = fieldY + INPUT_H + 28;
  const clearY = continueY + ACTION_H + 16;
  const showClear = mode === "settings" && getRawgApiKey().length > 0;

  const commitField = useCallback(() => {
    const vk = getNxVirtualKeyboard();
    const next = (vk?.value ?? valueRef.current).trim();
    setValue(next);
    setEditing(false);
  }, []);

  const submit = useCallback(async () => {
    if (busy) return;
    const key = (editing ? getNxVirtualKeyboard()?.value ?? value : value).trim();
    if (!key) {
      setStatus("Enter your RAWG API key to continue.");
      return;
    }

    setBusy(true);
    setStatus("Validating key…");
    try {
      const ok = await validateRawgApiKey(key);
      if (!ok) {
        setStatus("Invalid RAWG API key. Check the key and try again.");
        setBusy(false);
        return;
      }
      setRawgApiKey(key);
      setStatus(null);
      setBusy(false);
      onComplete();
    } catch (err) {
      const message =
        err instanceof RawgApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Network error while validating key.";
      setStatus(message);
      setBusy(false);
    }
  }, [busy, editing, onComplete, value]);

  const handleClear = useCallback(() => {
    clearRawgApiKey();
    setValue("");
    setStatus("API key cleared.");
    if (mode === "required") {
      setEditing(true);
    } else {
      onComplete();
    }
  }, [mode, onComplete]);

  const gamepadArmedRef = useRef(false);
  const buttonRef = useRef({
    up: false,
    down: false,
    a: false,
    b: false,
    x: false,
    plus: false,
    minus: false,
  });
  const focusAreaRef = useRef(focusArea);
  const editingRef = useRef(editing);
  focusAreaRef.current = focusArea;
  editingRef.current = editing;

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const gp = navigator.getGamepads()[0];
      const b = buttonRef.current;
      if (!gp) {
        raf = requestAnimationFrame(loop);
        return;
      }

      const isUp =
        gp.buttons[Button.Up].pressed ||
        (Math.abs(gp.axes[1]) > 0.5 && gp.axes[1] < -0.5);
      const isDown =
        gp.buttons[Button.Down].pressed ||
        (Math.abs(gp.axes[1]) > 0.5 && gp.axes[1] > 0.5);
      const isA = gp.buttons[Button.A].pressed;
      const isB = gp.buttons[Button.B].pressed;
      const isX = gp.buttons[Button.X].pressed;
      const isPlus = gp.buttons[Button.Plus].pressed;
      const isMinus = gp.buttons[Button.Minus].pressed;

      if (!gamepadArmedRef.current) {
        if (!isUp && !isDown && !isA && !isB && !isX && !isPlus && !isMinus) {
          gamepadArmedRef.current = true;
        }
        raf = requestAnimationFrame(loop);
        return;
      }

      if (editingRef.current) {
        const vk = getNxVirtualKeyboard();
        const vkLen = (vk?.value ?? valueRef.current).length;
        if (isB && !b.b) {
          handleVirtualKeyboardFaceButton("B", {
            valueLength: vkLen,
            deleteLastChar: deleteLastVkChar,
            onDismiss: commitField,
          });
        }
        if ((isX && !b.x) || (isMinus && !b.minus)) {
          handleVirtualKeyboardFaceButton(isMinus && !b.minus ? "minus" : "X", {
            valueLength: vkLen,
            deleteLastChar: deleteLastVkChar,
            onDismiss: commitField,
          });
        }
        if (isPlus && !b.plus) {
          handleVirtualKeyboardFaceButton("plus", {
            valueLength: vkLen,
            deleteLastChar: deleteLastVkChar,
            onDismiss: commitField,
            onSubmit: () => void submit(),
          });
        }
        b.up = isUp;
        b.down = isDown;
        b.a = isA;
        b.b = isB;
        b.x = isX;
        b.plus = isPlus;
        b.minus = isMinus;
        raf = requestAnimationFrame(loop);
        return;
      }

      const area = focusAreaRef.current;
      if (area === "back") {
        if (isDown && !b.down) setFocusArea("field");
        if (isA && !b.a) onCancel?.();
      } else if (area === "field") {
        if (isUp && !b.up && mode === "settings") setFocusArea("back");
        if (isDown && !b.down) setFocusArea("continue");
        if (isA && !b.a) setEditing(true);
      } else if (area === "continue") {
        if (isUp && !b.up) setFocusArea("field");
        if (isDown && !b.down && showClear) setFocusArea("clear");
        if (isA && !b.a) void submit();
      } else if (area === "clear") {
        if (isUp && !b.up) setFocusArea("continue");
        if (isA && !b.a) handleClear();
      }

      if (mode === "settings" && isB && !b.b) onCancel?.();
      if (mode === "settings" && isMinus && !b.minus) onCancel?.();

      b.up = isUp;
      b.down = isDown;
      b.a = isA;
      b.b = isB;
      b.x = isX;
      b.plus = isPlus;
      b.minus = isMinus;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [
    commitField,
    deleteLastVkChar,
    handleClear,
    mode,
    onCancel,
    showClear,
    submit,
  ]);

  const title = mode === "required" ? "RAWG API Key Required" : "RAWG API Key";
  const subtitle =
    mode === "required"
      ? "Enter your RAWG API key to fetch game details for your installed library."
      : "Update or clear the RAWG API key used for on-device metadata.";

  return (
    <HeaderLayout
      title={title}
      rightActionLabel={mode === "settings" ? "Back" : undefined}
      rightActionActive={focusArea === "back"}
      onRightActionTouchStart={onCancel}
      onRightActionMouseEnter={() => setFocusArea("back")}
      onRightActionMouseLeave={() => setFocusArea("field")}
      footerHint={
        editing
          ? INPUT_VIRTUAL_KEYBOARD_FOOTER_HINT
          : "A  Select      Up/Down  Move focus"
      }
    >
      <Text
        x={contentX}
        y={PANEL_TOP}
        fill={COLORS.gray[300]}
        fontSize={18}
        fontFamily="SourceSansPro-Regular"
        textAlign="left"
        textBaseline="top"
      >
        {subtitle}
      </Text>
      <Text
        x={contentX}
        y={PANEL_TOP + 28}
        fill={COLORS.gray[500]}
        fontSize={15}
        fontFamily="SourceSansPro-Regular"
        textAlign="left"
        textBaseline="top"
      >
        Get a free key at rawg.io/apidocs
      </Text>

      <Input
        x={contentX}
        y={fieldY}
        width={panelW}
        height={INPUT_H}
        label="RAWG API Key"
        value={editing ? vkText : value || "—"}
        isFocused={focusArea === "field"}
        isEditing={editing}
        valueMaxChars={40}
        onPress={() => {
          setFocusArea("field");
          setEditing(true);
        }}
        onMouseEnter={() => setFocusArea("field")}
      />

      <Rect
        x={contentX}
        y={continueY}
        width={panelW}
        height={ACTION_H}
        fill="transparent"
        onMouseEnter={() => setFocusArea("continue")}
      />
      <ActionButton
        x={contentX}
        y={continueY}
        width={panelW}
        height={ACTION_H}
        label={busy ? "Validating…" : mode === "required" ? "Continue" : "Save Key"}
        isHighlighted={focusArea === "continue"}
        onPress={() => void submit()}
      />

      {showClear ? (
        <>
          <Rect
            x={contentX}
            y={clearY}
            width={panelW}
            height={ACTION_H}
            fill="transparent"
            onMouseEnter={() => setFocusArea("clear")}
          />
          <ActionButton
            x={contentX}
            y={clearY}
            width={panelW}
            height={ACTION_H}
            label="Clear API Key"
            isHighlighted={focusArea === "clear"}
            onPress={handleClear}
          />
        </>
      ) : null}

      {status ? (
        <Rect
          x={contentX}
          y={clearY + (showClear ? ACTION_H + 20 : 0)}
          width={panelW}
          height={56}
          fill={COLORS.gray[800]}
          borderRadius={8}
        />
      ) : null}
      {status ? (
        <Text
          x={contentX + 12}
          y={clearY + (showClear ? ACTION_H + 20 : 0) + 28}
          fill={COLORS.gray[200]}
          fontSize={16}
          fontFamily="SourceSansPro-Regular"
          textAlign="left"
          textBaseline="middle"
        >
          {status}
        </Text>
      ) : null}
    </HeaderLayout>
  );
}
