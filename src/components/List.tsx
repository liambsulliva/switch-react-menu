import React from "react";
import { Rect } from "react-tela";
import { COLORS } from "../lib/colors";
import { ListElement, type ListElementModel } from "./ListElement";

interface ListProps {
  x: number;
  top: number;
  width: number;
  rowHeight: number;
  visibleCount: number;
  items: ListElementModel[];
  selectedIndex: number;
  scrollOffset: number;
  onItemTouchStart?: (index: number) => void;
}

export function List({
  x,
  top,
  width,
  rowHeight,
  visibleCount,
  items,
  selectedIndex,
  scrollOffset,
  onItemTouchStart,
}: ListProps) {
  const visibleItems = items.slice(scrollOffset, scrollOffset + visibleCount);

  const showScrollbar = items.length > visibleCount;
  const listHeight = rowHeight * visibleCount;
  const scrollbarThumbHeight = Math.max(
    24,
    (visibleCount / Math.max(1, items.length)) * listHeight,
  );
  const scrollbarThumbY =
    top +
    (scrollOffset / Math.max(1, items.length - visibleCount)) *
      (listHeight - scrollbarThumbHeight);

  return (
    <>
      {visibleItems.map((item, i) => {
        const absoluteIndex = scrollOffset + i;
        const rowY = top + i * rowHeight;
        return (
          <ListElement
            key={item.id}
            x={x}
            y={rowY}
            width={width}
            height={rowHeight}
            isSelected={absoluteIndex === selectedIndex}
            onTouchStart={() => onItemTouchStart?.(absoluteIndex)}
            {...item}
          />
        );
      })}

      {showScrollbar && (
        <>
          <Rect
            x={x + width + 8}
            y={top}
            width={4}
            height={listHeight}
            fill={COLORS.gray[700]}
          />
          <Rect
            x={x + width + 8}
            y={scrollbarThumbY}
            width={4}
            height={scrollbarThumbHeight}
            fill={COLORS.gray[500]}
          />
        </>
      )}
    </>
  );
}
