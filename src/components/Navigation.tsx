import React, { useEffect, useState } from "react";
import { Rect, Circle, Image, Text } from "react-tela";
import { COLORS } from "../lib/colors";
import {
  getNextArrowPng,
  getPrevArrowPng,
} from "../lib/iconPng";

interface NavigationProps {
  currentPage: number;
  totalPages: number;
  onPrevPage: () => void;
  onNextPage: () => void;
  isNavigationFocused: boolean;
  selectedNavButton: number;
  showPageNumbers?: boolean;
}

export function Navigation({
  currentPage,
  totalPages,
  onPrevPage,
  onNextPage,
  isNavigationFocused,
  selectedNavButton,
  showPageNumbers = true,
}: NavigationProps) {
  const [prevDefaultSrc, setPrevDefaultSrc] = useState<string | null>(null);
  const [prevFocusedSrc, setPrevFocusedSrc] = useState<string | null>(null);
  const [nextDefaultSrc, setNextDefaultSrc] = useState<string | null>(null);
  const [nextFocusedSrc, setNextFocusedSrc] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    Promise.all([
      getPrevArrowPng(COLORS.gray[400]),
      getPrevArrowPng(COLORS.gray[0]),
      getNextArrowPng(COLORS.gray[400]),
      getNextArrowPng(COLORS.gray[0]),
    ]).then(([prevDefault, prevFocused, nextDefault, nextFocused]) => {
      if (!active) return;
      setPrevDefaultSrc(prevDefault);
      setPrevFocusedSrc(prevFocused);
      setNextDefaultSrc(nextDefault);
      setNextFocusedSrc(nextFocused);
    });

    return () => {
      active = false;
    };
  }, []);

  const arrowSize = 36;
  const prevArrowX = 40;
  const nextArrowX = screen.width - 62;
  const arrowY = screen.height - 60;

  return (
    <>
      {prevDefaultSrc && prevFocusedSrc && (
        <Image
          src={
            isNavigationFocused && selectedNavButton === 0
              ? prevFocusedSrc
              : prevDefaultSrc
          }
          x={prevArrowX}
          y={arrowY}
          width={arrowSize}
          height={arrowSize}
        />
      )}
      <Rect
        x={15}
        y={screen.height - 85}
        width={140}
        height={80}
        fill="transparent"
        onTouchStart={onPrevPage}
      />
      {nextDefaultSrc && nextFocusedSrc && (
        <Image
          src={
            isNavigationFocused && selectedNavButton === 1
              ? nextFocusedSrc
              : nextDefaultSrc
          }
          x={nextArrowX}
          y={arrowY}
          width={arrowSize}
          height={arrowSize}
        />
      )}
      <Rect
        x={screen.width - 155}
        y={screen.height - 85}
        width={140}
        height={80}
        fill="transparent"
        onTouchStart={onNextPage}
      />

      {totalPages > 0 &&
        (showPageNumbers ? (
          <Text
            x={screen.width / 2}
            y={screen.height - 50}
            fill={COLORS.gray[0]}
            fontSize={24}
            fontFamily="SourceSansPro-Regular"
            textAlign="center"
            textBaseline="middle"
          >
            {`${currentPage + 1} of ${totalPages}`}
          </Text>
        ) : (
          Array.from({ length: totalPages }, (_, i) => {
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
                fill={i === currentPage ? COLORS.gray[0] : COLORS.gray[400]}
              />
            );
          })
        ))}
    </>
  );
}
