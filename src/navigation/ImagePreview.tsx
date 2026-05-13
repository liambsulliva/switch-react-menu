import React, { useEffect } from "react";
import { Image, Rect, Text } from "react-tela";
import { Button } from "@nx.js/constants";
import { COLORS } from "../lib/colors";

const PREVIEW_ASPECT = 16 / 9;
const OVERLAY_ALPHA = 0.82;
const MARGIN = 48;
const HOLD_REPEAT_INITIAL_DELAY_MS = 250;
const HOLD_REPEAT_INTERVAL_MS = 110;

interface ImagePreviewProps {
  visible: boolean;
  src: string | null;
  placeholderSrc?: string | null;
  showLoadingHint?: boolean;
  hasPrev: boolean;
  hasNext: boolean;
  onStepPreview: (delta: -1 | 1) => void;
  onRequestDelete: () => void;
  onClose: () => void;
  suspendGamepad?: boolean;
}

export function ImagePreview({
  visible,
  src,
  placeholderSrc = null,
  showLoadingHint = false,
  hasPrev,
  hasNext,
  onStepPreview,
  onRequestDelete,
  onClose,
  suspendGamepad = false,
}: ImagePreviewProps) {
  useEffect(() => {
    if (!visible) return;

    const canRepeat = (startedAt: number | null, now: number): boolean => {
      if (startedAt === null) return true;
      const heldFor = now - startedAt;
      if (heldFor < HOLD_REPEAT_INITIAL_DELAY_MS) return false;
      return heldFor % HOLD_REPEAT_INTERVAL_MS < 16;
    };

    let rafId: number;
    let armed = false;
    let bWasPressed = false;
    let minusWasPressed = false;
    let leftWasPressed = false;
    let rightWasPressed = false;
    let xWasPressed = false;
    let leftHoldStart: number | null = null;
    let rightHoldStart: number | null = null;

    const loop = () => {
      const now = Date.now();
      const gamepad = navigator.getGamepads()[0];
      if (suspendGamepad) {
        rafId = requestAnimationFrame(loop);
        return;
      }
      if (gamepad) {
        const isLeft =
          gamepad.buttons[Button.Left].pressed ||
          (Math.abs(gamepad.axes[0]) > 0.5 && gamepad.axes[0] < -0.5);
        const isRight =
          gamepad.buttons[Button.Right].pressed ||
          (Math.abs(gamepad.axes[0]) > 0.5 && gamepad.axes[0] > 0.5);
        const isB = gamepad.buttons[Button.B].pressed;
        const isMinus = gamepad.buttons[Button.Minus].pressed;
        const isX = gamepad.buttons[Button.X].pressed;

        if (!armed) {
          if (!isB && !isMinus && !isLeft && !isRight && !isX) {
            armed = true;
            leftHoldStart = null;
            rightHoldStart = null;
          }
        } else {
          if (isB && !bWasPressed) onClose();
          if (isMinus && !minusWasPressed) onClose();

          if (hasPrev) {
            if (isLeft && !leftWasPressed) {
              onStepPreview(-1);
              leftHoldStart = now;
            } else if (
              isLeft &&
              leftWasPressed &&
              canRepeat(leftHoldStart, now)
            ) {
              onStepPreview(-1);
            } else if (!isLeft && leftWasPressed) {
              leftHoldStart = null;
            }
          } else if (!isLeft) {
            leftHoldStart = null;
          }

          if (hasNext) {
            if (isRight && !rightWasPressed) {
              onStepPreview(1);
              rightHoldStart = now;
            } else if (
              isRight &&
              rightWasPressed &&
              canRepeat(rightHoldStart, now)
            ) {
              onStepPreview(1);
            } else if (!isRight && rightWasPressed) {
              rightHoldStart = null;
            }
          } else if (!isRight) {
            rightHoldStart = null;
          }

          if (isX && !xWasPressed) {
            onRequestDelete();
          }
        }
        bWasPressed = isB;
        minusWasPressed = isMinus;
        leftWasPressed = isLeft;
        rightWasPressed = isRight;
        xWasPressed = isX;
      }
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [
    visible,
    onClose,
    hasPrev,
    hasNext,
    onStepPreview,
    onRequestDelete,
    suspendGamepad,
  ]);

  if (!visible) return null;

  const maxW = screen.width - MARGIN * 2;
  const maxH = screen.height - MARGIN * 2;
  let imgW = maxW;
  let imgH = imgW / PREVIEW_ASPECT;
  if (imgH > maxH) {
    imgH = maxH;
    imgW = imgH * PREVIEW_ASPECT;
  }
  const imgX = (screen.width - imgW) / 2;
  const imgY = (screen.height - imgH) / 2;

  return (
    <>
      <Rect
        x={0}
        y={0}
        width={screen.width}
        height={screen.height}
        fill={`rgba(0,0,0,${OVERLAY_ALPHA})`}
      />
      {src ? (
        <Image src={src} x={imgX} y={imgY} width={imgW} height={imgH} />
      ) : placeholderSrc ? (
        <Image
          src={placeholderSrc}
          x={imgX}
          y={imgY}
          width={imgW}
          height={imgH}
        />
      ) : (
        <Rect
          x={imgX}
          y={imgY}
          width={imgW}
          height={imgH}
          fill={COLORS.gray[800]}
          borderRadius={6}
        />
      )}
      {showLoadingHint && (
        <Text
          x={screen.width / 2}
          y={imgY + imgH / 2}
          fill={COLORS.gray[400]}
          fontSize={22}
          fontFamily="SourceSansPro-Regular"
          textAlign="center"
          textBaseline="middle"
        >
          Loading full image...
        </Text>
      )}
      <Text
        x={screen.width / 2}
        y={imgY + imgH + 56}
        fill={COLORS.gray[200]}
        fontSize={20}
        fontFamily="SourceSansPro-Regular"
        textAlign="center"
        textBaseline="middle"
      >
        X Delete
      </Text>
      <Text
        x={screen.width / 2}
        y={imgY + imgH + 82}
        fill={COLORS.gray[200]}
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
