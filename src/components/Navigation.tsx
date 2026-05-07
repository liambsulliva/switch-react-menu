import React from "react";
import { Text, Rect, Circle } from "react-tela";

interface NavigationProps {
  currentPage: number;
  totalPages: number;
  onPrevPage: () => void;
  onNextPage: () => void;
  isNavigationFocused: boolean;
  selectedNavButton: number;
}

export function Navigation({
  currentPage,
  totalPages,
  onPrevPage,
  onNextPage,
  isNavigationFocused,
  selectedNavButton,
}: NavigationProps) {
  return (
    <>
      <Text
        x={50}
        y={screen.height - 50}
        fill={isNavigationFocused && selectedNavButton === 0 ? "#fff" : "#666"}
        fontSize={24}
        fontFamily="SourceSansPro-Bold"
      >
        {"< Prev"}
      </Text>
      <Rect
        x={15}
        y={screen.height - 85}
        width={140}
        height={80}
        fill="transparent"
        onTouchStart={onPrevPage}
      />
      <Text
        x={screen.width - 50}
        y={screen.height - 50}
        fill={isNavigationFocused && selectedNavButton === 1 ? "#fff" : "#666"}
        fontSize={24}
        fontFamily="SourceSansPro-Bold"
        textAlign="right"
      >
        {"Next >"}
      </Text>
      <Rect
        x={screen.width - 155}
        y={screen.height - 85}
        width={140}
        height={80}
        fill="transparent"
        onTouchStart={onNextPage}
      />

      {Array.from({ length: totalPages }, (_, i) => {
        const dotRadius = 5;
        const dotSpacing = 18;
        const totalWidth = (totalPages - 1) * dotSpacing;
        const startX = screen.width / 2 - totalWidth / 2;
        return (
          <Circle
            key={i}
            x={startX + i * dotSpacing}
            y={screen.height - 50}
            radius={dotRadius}
            fill={i === currentPage ? "#fff" : "#666"}
          />
        );
      })}
    </>
  );
}
