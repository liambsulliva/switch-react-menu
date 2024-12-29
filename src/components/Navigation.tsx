import React from "react";
import { Text } from "react-tela";

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
        fill="white"
        fontSize={24}
        onTouchStart={onPrevPage}
      >
        {"< Prev"}
      </Text>

      <Text
        x={screen.width - 50}
        y={screen.height - 50}
        fill="white"
        fontSize={24}
        textAlign="right"
        onTouchStart={onNextPage}
      >
        {"Next >"}
      </Text>

      <Text
        x={screen.width / 2}
        y={screen.height - 50}
        fill="white"
        fontSize={24}
        textAlign="center"
      >
        {`${currentPage + 1}/${totalPages}`}
      </Text>
    </>
  );
}
