import React from "react";
import { Text, Rect } from "react-tela";

interface NavigationProps {
  currentPage: number;
  totalPages: number;
  onPrevPage: () => void;
  onNextPage: () => void;
}

export function Navigation({
  currentPage,
  totalPages,
  onPrevPage,
  onNextPage,
}: NavigationProps) {
  return (
    <>
      <Text
        x={50}
        y={screen.height - 50}
        fill="#ddd"
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
        fill="#ddd"
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

      <Text
        x={screen.width / 2}
        y={screen.height - 50}
        fill="#ddd"
        fontSize={24}
        fontFamily="SourceSansPro-Regular"
        textAlign="center"
      >
        {`${currentPage + 1}/${totalPages}`}
      </Text>
    </>
  );
}
