import React from "react";
import { Rect, Text } from "react-tela";
import { COLORS } from "../lib/colors";

export const HEADER_LAYOUT = {
  paddingX: 64,
  contentTop: 130,
  footerHeight: 80,
};

interface HeaderLayoutProps {
  title: string;
  rightActionLabel?: string;
  rightActionActive?: boolean;
  onRightActionTouchStart?: () => void;
  onRightActionMouseEnter?: () => void;
  onRightActionMouseLeave?: () => void;
  footerHint: string;
  children: React.ReactNode;
}

export function HeaderLayout({
  title,
  rightActionLabel,
  rightActionActive = false,
  onRightActionTouchStart,
  onRightActionMouseEnter,
  onRightActionMouseLeave,
  footerHint,
  children,
}: HeaderLayoutProps) {
  const panelWidth = screen.width - HEADER_LAYOUT.paddingX * 2;

  return (
    <>
      <Rect
        x={0}
        y={0}
        width={screen.width}
        height={screen.height}
        fill={COLORS.background}
      />

      <Text
        x={HEADER_LAYOUT.paddingX}
        y={80}
        fill={COLORS.gray[0]}
        fontSize={36}
        fontFamily="SourceSansPro-Bold"
        textBaseline="middle"
      >
        {title}
      </Text>

      {rightActionLabel && (
        <>
          <Text
            x={screen.width - HEADER_LAYOUT.paddingX}
            y={80}
            fill={rightActionActive ? COLORS.gray[0] : COLORS.gray[400]}
            fontSize={rightActionActive ? 26 : 24}
            fontFamily={
              rightActionActive ? "SourceSansPro-Bold" : "SourceSansPro-Regular"
            }
            textAlign="right"
            textBaseline="middle"
          >
            {rightActionLabel}
          </Text>
          <Rect
            x={screen.width - HEADER_LAYOUT.paddingX - 120}
            y={50}
            width={120}
            height={60}
            fill="transparent"
            onTouchStart={onRightActionTouchStart}
            onClick={onRightActionTouchStart}
            onMouseEnter={onRightActionMouseEnter}
            onMouseLeave={onRightActionMouseLeave}
          />
        </>
      )}

      <Rect
        x={HEADER_LAYOUT.paddingX}
        y={112}
        width={panelWidth}
        height={1}
        fill={COLORS.gray[700]}
      />

      {children}

      <Rect
        x={HEADER_LAYOUT.paddingX}
        y={screen.height - HEADER_LAYOUT.footerHeight}
        width={panelWidth}
        height={1}
        fill={COLORS.gray[700]}
      />

      <Text
        x={HEADER_LAYOUT.paddingX}
        y={screen.height - HEADER_LAYOUT.footerHeight / 2}
        fill={COLORS.gray[500]}
        fontSize={22}
        fontFamily="SourceSansPro-Regular"
        textBaseline="middle"
      >
        {footerHint}
      </Text>
    </>
  );
}
