import React, { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Rect, Text } from "react-tela";
import { Button } from "@nx.js/constants";
import { COLORS } from "../lib/colors";

const PANEL_PAD = 32;
const OVERLAY_ALPHA = 0.72;
const ACTION_ROW_GAP = 12;
const ACTION_BTN_MIN_W = 140;
const ACTION_BTN_H = 48;
const ACTION_BTN_RADIUS = 6;

export interface ModalLayout {
  readonly panelX: number;
  readonly panelY: number;
  readonly panelW: number;
  readonly panelH: number;
  /** Y coord ref to start custom body content. */
  readonly contentTop: number;
}

export interface ModalAction {
  id: string;
  label: string;
  onPress: () => void;
  variant?: "default" | "destructive";
}

export interface ModalProps {
  visible: boolean;
  title: string;
  description?: React.ReactNode;
  /** Custom body (if needed) */
  children?: React.ReactNode | ((layout: ModalLayout) => React.ReactNode);
  actions?: ModalAction[];
  onClose: () => void;
  closeOnBackdropPress?: boolean;
  maxPanelWidth?: number;
  maxPanelHeight?: number;
  initialActionIndex?: number;
}

export function Modal({
  visible,
  title,
  description,
  children,
  actions = [],
  onClose,
  closeOnBackdropPress = true,
  maxPanelWidth = 820,
  maxPanelHeight = 520,
  initialActionIndex = 0,
}: ModalProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selectedRef = useRef(0);
  const actionsRef = useRef(actions);

  selectedRef.current = selectedIndex;
  actionsRef.current = actions;

  useEffect(() => {
    if (!visible) return;
    const len = actions.length;
    if (len === 0) {
      setSelectedIndex(0);
      return;
    }
    const start = Math.min(Math.max(0, initialActionIndex), len - 1);
    setSelectedIndex(start);
  }, [visible, initialActionIndex, actions.length]);

  useEffect(() => {
    if (!visible) return;

    let rafId: number;
    let armed = false;
    let bWas = false;
    let minusWas = false;
    let aWas = false;
    let leftWas = false;
    let rightWas = false;

    const loop = () => {
      const gamepad = navigator.getGamepads()[0];
      if (gamepad) {
        const isB = gamepad.buttons[Button.B].pressed;
        const isMinus = gamepad.buttons[Button.Minus].pressed;
        const isA = gamepad.buttons[Button.A].pressed;
        const isLeft =
          gamepad.buttons[Button.Left].pressed ||
          (Math.abs(gamepad.axes[0]) > 0.5 && gamepad.axes[0] < -0.5);
        const isRight =
          gamepad.buttons[Button.Right].pressed ||
          (Math.abs(gamepad.axes[0]) > 0.5 && gamepad.axes[0] > 0.5);

        const anyPressed = isB || isMinus || isA || isLeft || isRight;

        if (!armed) {
          if (!anyPressed) armed = true;
        } else {
          if (isB && !bWas) onClose();
          if (isMinus && !minusWas) onClose();

          const len = actionsRef.current.length;
          if (len > 0) {
            if (isLeft && !leftWas) {
              setSelectedIndex((p) => (((p - 1) % len) + len) % len);
            }
            if (isRight && !rightWas) {
              setSelectedIndex((p) => (((p + 1) % len) + len) % len);
            }
            if (isA && !aWas) {
              const act = actionsRef.current[selectedRef.current];
              act?.onPress();
            }
          }
        }
        bWas = isB;
        minusWas = isMinus;
        aWas = isA;
        leftWas = isLeft;
        rightWas = isRight;
      }
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [visible, onClose]);

  const panelSize = useMemo(() => {
    const panelW = Math.min(maxPanelWidth, screen.width - 48);
    const panelH = Math.min(maxPanelHeight, screen.height - 48);
    return { panelW, panelH };
  }, [maxPanelWidth, maxPanelHeight]);

  if (!visible) return null;

  const { panelW, panelH } = panelSize;
  const panelX = (screen.width - panelW) / 2;
  const panelY = (screen.height - panelH) / 2;

  const descText =
    typeof description === "string"
      ? description
      : typeof description === "number"
        ? String(description)
        : null;
  const hasDesc = descText != null && descText.trim() !== "";
  const descBlockH = hasDesc ? 52 : 0;
  const contentTop = panelY + PANEL_PAD + 40 + (hasDesc ? descBlockH + 8 : 8);

  const layout: ModalLayout = {
    panelX,
    panelY,
    panelW,
    panelH,
    contentTop,
  };

  const hasActions = actions.length > 0;
  const footerY = panelY + panelH - 24;

  const body = typeof children === "function" ? children(layout) : children;

  return (
    <>
      <Rect
        x={0}
        y={0}
        width={screen.width}
        height={screen.height}
        fill={`rgba(0,0,0,${OVERLAY_ALPHA})`}
        onTouchStart={closeOnBackdropPress ? onClose : undefined}
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
        {title}
      </Text>
      {hasDesc && (
        <Text
          x={panelX + PANEL_PAD}
          y={panelY + PANEL_PAD + 36}
          fill={COLORS.gray[300]}
          fontSize={20}
          fontFamily="SourceSansPro-Regular"
          textBaseline="top"
        >
          {descText.trim()}
        </Text>
      )}
      {body}
      {hasActions && (
        <ActionRow
          panelX={panelX}
          panelY={panelY}
          panelW={panelW}
          panelH={panelH}
          actions={actions}
          selectedIndex={selectedIndex}
          onSelectIndex={setSelectedIndex}
        />
      )}
      <Text
        x={screen.width / 2}
        y={footerY}
        fill={COLORS.gray[400]}
        fontSize={18}
        fontFamily="SourceSansPro-Regular"
        textAlign="center"
        textBaseline="middle"
      >
        {hasActions ? "A Confirm   B / − Cancel" : "B / − Close"}
      </Text>
    </>
  );
}

function ActionRow({
  panelX,
  panelY,
  panelW,
  panelH,
  actions,
  selectedIndex,
  onSelectIndex,
}: {
  panelX: number;
  panelY: number;
  panelW: number;
  panelH: number;
  actions: ModalAction[];
  selectedIndex: number;
  onSelectIndex: (i: number) => void;
}) {
  const totalW =
    actions.length * ACTION_BTN_MIN_W +
    Math.max(0, actions.length - 1) * ACTION_ROW_GAP;
  let x0 = panelX + (panelW - totalW) / 2;
  const y = panelY + panelH - PANEL_PAD - ACTION_BTN_H - 36;

  return (
    <>
      {actions.map((action, i) => {
        const x = x0;
        x0 += ACTION_BTN_MIN_W + ACTION_ROW_GAP;
        const selected = i === selectedIndex;
        const fill =
          action.variant === "destructive"
            ? selected
              ? COLORS.gray[700]
              : COLORS.gray[800]
            : selected
              ? COLORS.gray[700]
              : COLORS.gray[800];
        const stroke = selected ? COLORS.gray[0] : COLORS.gray[600];
        return (
          <Fragment key={action.id}>
            <Rect
              x={x}
              y={y}
              width={ACTION_BTN_MIN_W}
              height={ACTION_BTN_H}
              fill={fill}
              stroke={stroke}
              lineWidth={selected ? 2 : 1}
              borderRadius={ACTION_BTN_RADIUS}
              onTouchStart={() => onSelectIndex(i)}
              onClick={() => {
                onSelectIndex(i);
                action.onPress();
              }}
            />
            <Text
              x={x + ACTION_BTN_MIN_W / 2}
              y={y + ACTION_BTN_H / 2}
              fill={
                action.variant === "destructive"
                  ? COLORS.gray[100]
                  : COLORS.gray[200]
              }
              fontSize={20}
              fontFamily="SourceSansPro-Regular"
              textAlign="center"
              textBaseline="middle"
            >
              {action.label}
            </Text>
          </Fragment>
        );
      })}
    </>
  );
}
