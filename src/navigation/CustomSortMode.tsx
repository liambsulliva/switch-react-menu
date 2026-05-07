import React, { useEffect, useMemo, useRef, useState } from "react";
import { Image, Rect, Text } from "react-tela";
import { Button } from "@nx.js/constants";
import { truncate } from "../lib/truncate";
import { COLORS } from "../lib/colors";
import { List } from "../components/List";
import type { ListElementModel } from "../components/ListElement";

interface CustomSortModeProps {
  apps: Switch.Application[];
  compact: boolean;
  onDone: (newOrder: string[]) => void;
  onCancel: () => void;
}

const PADDING_X = 64;
const FOOTER_HEIGHT = 80;
const HEADER_HEIGHT = 130;
const GRID_GAP = 48;
const GRID_ICON_SIZE = 256;
const GRID_SIDE_MARGIN = 24;
const COMPACT_ROW_HEIGHT = 84;
const HELD_LIFT = 24;
const HOLD_REPEAT_INITIAL_DELAY_MS = 250;
const HOLD_REPEAT_INTERVAL_MS = 110;

const panelWidth = screen.width - PADDING_X * 2;
const listHeight = screen.height - HEADER_HEIGHT - FOOTER_HEIGHT;
const compactVisibleCount = Math.floor(listHeight / COMPACT_ROW_HEIGHT);

const iconUrlCache = new Map<string, string>();

function getIconUrl(app: Switch.Application): string {
  const key = app.id.toString();
  let url = iconUrlCache.get(key);
  if (!url && app.icon) {
    url = URL.createObjectURL(new Blob([app.icon]));
    iconUrlCache.set(key, url);
  }
  return url ?? "";
}

function ensureVisibleCompact(index: number, offset: number): number {
  if (index < offset) return index;
  if (index >= offset + compactVisibleCount)
    return index - compactVisibleCount + 1;
  return offset;
}

export function CustomSortMode({
  apps: initialApps,
  compact,
  onDone,
  onCancel,
}: CustomSortModeProps) {
  const [order, setOrder] = useState<string[]>(() =>
    initialApps.map((a) => a.id.toString()),
  );
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isHolding, setIsHolding] = useState(false);
  const [cancelSnapshot, setCancelSnapshot] = useState<string[]>([]);
  const [scrollOffset, setScrollOffset] = useState(0);

  const [btnState, setBtnState] = useState({
    leftPressed: false,
    rightPressed: false,
    upPressed: false,
    downPressed: false,
    aPressed: false,
    bPressed: false,
    plusPressed: false,
  });
  const holdRepeatRef = useRef<{
    left: number | null;
    right: number | null;
    up: number | null;
    down: number | null;
  }>({ left: null, right: null, up: null, down: null });
  const gamepadArmedRef = useRef(false);

  const appById = useMemo(() => {
    const m = new Map<string, Switch.Application>();
    for (const app of initialApps) m.set(app.id.toString(), app);
    return m;
  }, [initialApps]);

  const orderedApps = useMemo(
    () =>
      order
        .map((id) => appById.get(id))
        .filter((a): a is Switch.Application => !!a),
    [order, appById],
  );

  const appCount = orderedApps.length;

  useEffect(() => {
    let rafId: number;

    const canRepeat = (startedAt: number | null, now: number): boolean => {
      if (startedAt === null) return true;
      const heldFor = now - startedAt;
      if (heldFor < HOLD_REPEAT_INITIAL_DELAY_MS) return false;
      return heldFor % HOLD_REPEAT_INTERVAL_MS < 16;
    };

    const moveSelection = (dir: -1 | 1) => {
      const newPos = selectedIndex + dir;
      if (newPos < 0 || newPos >= appCount) return;
      if (isHolding) {
        setOrder((prev) => {
          const next = [...prev];
          [next[selectedIndex], next[newPos]] = [
            next[newPos],
            next[selectedIndex],
          ];
          return next;
        });
      }
      setSelectedIndex(newPos);
      if (compact) setScrollOffset((off) => ensureVisibleCompact(newPos, off));
    };

    const loop = () => {
      const now = Date.now();
      const gamepad = navigator.getGamepads()[0];
      if (!gamepad) {
        rafId = requestAnimationFrame(loop);
        return;
      }

      const isLeft =
        gamepad.buttons[Button.Left].pressed ||
        (Math.abs(gamepad.axes[0]) > 0.5 && gamepad.axes[0] < -0.5);
      const isRight =
        gamepad.buttons[Button.Right].pressed ||
        (Math.abs(gamepad.axes[0]) > 0.5 && gamepad.axes[0] > 0.5);
      const isUp =
        gamepad.buttons[Button.Up].pressed ||
        (Math.abs(gamepad.axes[1]) > 0.5 && gamepad.axes[1] < -0.5);
      const isDown =
        gamepad.buttons[Button.Down].pressed ||
        (Math.abs(gamepad.axes[1]) > 0.5 && gamepad.axes[1] > 0.5);
      const isA = gamepad.buttons[Button.A].pressed;
      const isB = gamepad.buttons[Button.B].pressed;
      const isPlus = gamepad.buttons[Button.Plus].pressed;

      if (!gamepadArmedRef.current) {
        if (
          !isLeft &&
          !isRight &&
          !isUp &&
          !isDown &&
          !isA &&
          !isB &&
          !isPlus
        ) {
          gamepadArmedRef.current = true;
          holdRepeatRef.current = {
            left: null,
            right: null,
            up: null,
            down: null,
          };
        }
        rafId = requestAnimationFrame(loop);
        return;
      }

      if (!compact) {
        if (isLeft && !btnState.leftPressed) {
          setBtnState((prev) => ({ ...prev, leftPressed: true }));
          holdRepeatRef.current.left = now;
          moveSelection(-1);
        } else if (
          isLeft &&
          btnState.leftPressed &&
          canRepeat(holdRepeatRef.current.left, now)
        ) {
          moveSelection(-1);
        } else if (!isLeft && btnState.leftPressed) {
          setBtnState((prev) => ({ ...prev, leftPressed: false }));
          holdRepeatRef.current.left = null;
        }

        if (isRight && !btnState.rightPressed) {
          setBtnState((prev) => ({ ...prev, rightPressed: true }));
          holdRepeatRef.current.right = now;
          moveSelection(1);
        } else if (
          isRight &&
          btnState.rightPressed &&
          canRepeat(holdRepeatRef.current.right, now)
        ) {
          moveSelection(1);
        } else if (!isRight && btnState.rightPressed) {
          setBtnState((prev) => ({ ...prev, rightPressed: false }));
          holdRepeatRef.current.right = null;
        }
      }

      if (compact) {
        if (isUp && !btnState.upPressed) {
          setBtnState((prev) => ({ ...prev, upPressed: true }));
          holdRepeatRef.current.up = now;
          moveSelection(-1);
        } else if (
          isUp &&
          btnState.upPressed &&
          canRepeat(holdRepeatRef.current.up, now)
        ) {
          moveSelection(-1);
        } else if (!isUp && btnState.upPressed) {
          setBtnState((prev) => ({ ...prev, upPressed: false }));
          holdRepeatRef.current.up = null;
        }

        if (isDown && !btnState.downPressed) {
          setBtnState((prev) => ({ ...prev, downPressed: true }));
          holdRepeatRef.current.down = now;
          moveSelection(1);
        } else if (
          isDown &&
          btnState.downPressed &&
          canRepeat(holdRepeatRef.current.down, now)
        ) {
          moveSelection(1);
        } else if (!isDown && btnState.downPressed) {
          setBtnState((prev) => ({ ...prev, downPressed: false }));
          holdRepeatRef.current.down = null;
        }
      }

      if (isA && !btnState.aPressed) {
        setBtnState((prev) => ({ ...prev, aPressed: true }));
        if (!isHolding) {
          setCancelSnapshot([...order]);
          setIsHolding(true);
        } else {
          setIsHolding(false);
        }
      } else if (!isA && btnState.aPressed) {
        setBtnState((prev) => ({ ...prev, aPressed: false }));
      }

      if (isB && !btnState.bPressed) {
        setBtnState((prev) => ({ ...prev, bPressed: true }));
        if (isHolding) {
          const heldId = order[selectedIndex];
          setOrder(cancelSnapshot);
          const restoredIdx = cancelSnapshot.indexOf(heldId);
          const restored = restoredIdx >= 0 ? restoredIdx : 0;
          setSelectedIndex(restored);
          if (compact)
            setScrollOffset((off) => ensureVisibleCompact(restored, off));
          setIsHolding(false);
        } else {
          onCancel();
        }
      } else if (!isB && btnState.bPressed) {
        setBtnState((prev) => ({ ...prev, bPressed: false }));
      }

      if (isPlus && !btnState.plusPressed) {
        setBtnState((prev) => ({ ...prev, plusPressed: true }));
        onDone([...order]);
      } else if (!isPlus && btnState.plusPressed) {
        setBtnState((prev) => ({ ...prev, plusPressed: false }));
      }

      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [
    btnState,
    isHolding,
    selectedIndex,
    order,
    cancelSnapshot,
    compact,
    onDone,
    onCancel,
    appCount,
  ]);

  // ─── GRID (BREATHABLE) LAYOUT ───────────────────────────────────────────────
  if (!compact) {
    const iconW = GRID_ICON_SIZE;
    const iconH = GRID_ICON_SIZE;
    const iconBaseY = HEADER_HEIGHT + (listHeight - iconH) / 2;
    const totalRowWidth = appCount * (iconW + GRID_GAP) - GRID_GAP;
    const gridViewportX = PADDING_X + GRID_SIDE_MARGIN;
    const gridViewportWidth = panelWidth - GRID_SIDE_MARGIN * 2;
    const gridViewportRight = gridViewportX + gridViewportWidth;

    const selectedCenterX = selectedIndex * (iconW + GRID_GAP) + iconW / 2;
    const idealScrollX = selectedCenterX - gridViewportWidth / 2;
    const maxScrollX = Math.max(0, totalRowWidth - gridViewportWidth);
    const scrollX = Math.max(0, Math.min(idealScrollX, maxScrollX));

    const legendText = isHolding
      ? "A  Drop      B  Cancel Move"
      : "A  Pick Up        B  Exit      +  Save";

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
          x={PADDING_X}
          y={80}
          fill={COLORS.gray[0]}
          fontSize={36}
          fontFamily="SourceSansPro-Bold"
          textBaseline="middle"
        >
          Custom Sort
        </Text>

        <Text
          x={screen.width - PADDING_X - 60}
          y={80}
          fill={COLORS.gray[400]}
          fontSize={24}
          fontFamily="SourceSansPro-Regular"
          textAlign="center"
          textBaseline="middle"
        >
          + Save
        </Text>

        <Rect
          x={PADDING_X}
          y={112}
          width={panelWidth}
          height={1}
          fill={COLORS.gray[700]}
        />

        {orderedApps.map((app, i) => {
          const baseX = i * (iconW + GRID_GAP);
          const renderX = gridViewportX + baseX - scrollX;

          if (renderX + iconW < gridViewportX || renderX > gridViewportRight) {
            return null;
          }

          const isSelected = i === selectedIndex;
          const isHeld = isSelected && isHolding;
          const iconRenderY = isHeld ? iconBaseY - HELD_LIFT : iconBaseY;
          const iconBottom = iconRenderY + iconH;

          return (
            <React.Fragment key={app.id.toString()}>
              {isHeld && (
                <Rect
                  x={renderX - 6}
                  y={iconRenderY - 6}
                  width={iconW + 12}
                  height={iconH + 12}
                  fill={COLORS.accentBg}
                />
              )}

              {isSelected && (
                <Rect
                  x={renderX - 5}
                  y={iconRenderY - 5}
                  width={iconW + 10}
                  height={iconH + 10}
                  fill="none"
                  stroke={isHeld ? COLORS.accent : COLORS.gray[0]}
                  lineWidth={5}
                />
              )}

              {app.icon && (
                <Image
                  src={getIconUrl(app)}
                  x={renderX}
                  y={iconRenderY}
                  width={iconW}
                  height={iconH}
                />
              )}

              <Text
                x={renderX + iconW / 2}
                y={iconBottom + 20}
                fill={
                  isSelected
                    ? isHeld
                      ? COLORS.accent
                      : COLORS.gray[0]
                    : COLORS.gray[100]
                }
                fontSize={20}
                fontFamily={
                  isSelected ? "SourceSansPro-Bold" : "SourceSansPro-Regular"
                }
                textAlign="center"
                textBaseline="top"
              >
                {truncate(app.name, 17)}
              </Text>
            </React.Fragment>
          );
        })}

        <Rect
          x={PADDING_X}
          y={screen.height - FOOTER_HEIGHT}
          width={panelWidth}
          height={1}
          fill={COLORS.gray[700]}
        />

        <Text
          x={PADDING_X}
          y={screen.height - FOOTER_HEIGHT / 2}
          fill={COLORS.gray[500]}
          fontSize={22}
          fontFamily="SourceSansPro-Regular"
          textBaseline="middle"
        >
          {legendText}
        </Text>
      </>
    );
  }

  // ─── COMPACT (LIST) LAYOUT ───────────────────────────────────────────────────
  const compactListItems = useMemo<ListElementModel[]>(
    () =>
      orderedApps.map((app, index) => {
        const isSelected = index === selectedIndex;
        const isHeld = isSelected && isHolding;
        return {
          id: app.id.toString(),
          label: truncate(app.name, 38),
          variant: "game" as const,
          gameIconSrc: app.icon ? getIconUrl(app) : undefined,
          valueColorOverride: isSelected
            ? isHeld
              ? COLORS.accent
              : COLORS.gray[0]
            : COLORS.gray[100],
          rowSelectedFill: isHeld ? COLORS.rowSelectedBg : COLORS.rowSelected,
        };
      }),
    [orderedApps, selectedIndex, isHolding],
  );
  const legendTextCompact = isHolding
    ? "A  Drop      B  Cancel Move"
    : "A  Pick Up      B  Exit      +  Save";

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
        x={PADDING_X}
        y={80}
        fill={COLORS.gray[0]}
        fontSize={36}
        fontFamily="SourceSansPro-Bold"
        textBaseline="middle"
      >
        Custom Sort
      </Text>

      <Text
        x={screen.width - PADDING_X - 60}
        y={80}
        fill={COLORS.gray[400]}
        fontSize={24}
        fontFamily="SourceSansPro-Regular"
        textAlign="center"
        textBaseline="middle"
      >
        + Save
      </Text>

      <Rect
        x={PADDING_X}
        y={112}
        width={panelWidth}
        height={1}
        fill={COLORS.gray[700]}
      />

      <List
        x={PADDING_X}
        top={HEADER_HEIGHT}
        width={panelWidth}
        rowHeight={COMPACT_ROW_HEIGHT}
        visibleCount={compactVisibleCount}
        items={compactListItems}
        selectedIndex={selectedIndex}
        scrollOffset={scrollOffset}
      />

      <Rect
        x={PADDING_X}
        y={screen.height - FOOTER_HEIGHT}
        width={panelWidth}
        height={1}
        fill={COLORS.gray[700]}
      />

      <Text
        x={PADDING_X}
        y={screen.height - FOOTER_HEIGHT / 2}
        fill={COLORS.gray[500]}
        fontSize={22}
        fontFamily="SourceSansPro-Regular"
        textBaseline="middle"
      >
        {legendTextCompact}
      </Text>
    </>
  );
}
