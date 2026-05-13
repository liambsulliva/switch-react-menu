import React, { useEffect } from "react";
import { Image, Rect, Text } from "react-tela";
import { Button } from "@nx.js/constants";
import { COLORS } from "../lib/colors";

const PREVIEW_ASPECT = 16 / 9;

const OVERLAY_ALPHA = 0.82;
const MARGIN = 48;

interface ImagePreviewProps {
  visible: boolean;
  src: string | null;
  onClose: () => void;
}

export function ImagePreview({ visible, src, onClose }: ImagePreviewProps) {
  useEffect(() => {
    if (!visible) return;

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
  }, [visible, onClose]);

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
      <Text
        x={screen.width / 2}
        y={imgY + imgH + 36}
        fill={COLORS.gray[200]}
        fontSize={22}
        fontFamily="SourceSansPro-Regular"
        textAlign="center"
        textBaseline="middle"
      >
        B / − Close
      </Text>
    </>
  );
}
