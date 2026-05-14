import { useEffect, useRef, useState } from "react";
import { Button } from "@nx.js/constants";
import { registerAppLaunch } from "../settings/lastPlayedStore";

export type GridHomeFocusArea =
  | "apps"
  | "navigation"
  | "settings"
  | "album"
  | "globe"
  | "search"
  | "searchInput";

export type HeroSplashInlineSubFocus = "content" | "actions" | "trailers";

interface GamepadNavigationProps {
  apps: Switch.Application[];
  jumpStep: number;
  onStepPrev: () => void;
  onStepNext: () => void;
  setSelectedIndex: (cb: (prev: number) => number) => void;
  selectedIndex: number;
  focusArea: GridHomeFocusArea;
  setFocusArea: (cb: (prev: GridHomeFocusArea) => GridHomeFocusArea) => void;
  navButtonIndex: number;
  setNavButtonIndex: (cb: (prev: number) => number) => void;
  isActive?: boolean;
  onOpenSettings?: () => void;
  onSearchSubmit?: () => void;
  onSearchCancel?: () => void;
  onOpenAlbum?: () => void;
  onOpenWebBrowser?: () => void;
  onActivateSearch?: () => void;
  onButtonBPress?: () => void;
  onMinus?: () => void;
  replaceBottomNavWithHeroSplash?: boolean;
  inlineDetailsOpen?: boolean;
  onOpenInlineDetails?: () => void;
  onCloseInlineDetails?: () => void;
  heroInlineSubFocus?: HeroSplashInlineSubFocus;
  setHeroInlineSubFocus?: (next: HeroSplashInlineSubFocus) => void;
  heroTrailerCount?: number;
  heroTrailerIndex?: number;
  setHeroTrailerIndex?: (update: (prev: number) => number) => void;
  onHeroTrailerActivate?: () => void;
  heroActionIndex?: number;
  setHeroActionIndex?: (update: (prev: number) => number) => void;
  heroActionCount?: number;
  onHeroActionActivate?: (index: number) => void;
}

interface GamepadState {
  shouldersPressed: {
    L: boolean;
    R: boolean;
  };
  directionalPressed: {
    Left: boolean;
    Right: boolean;
    Up: boolean;
    Down: boolean;
  };
  plusPressed: boolean;
  minusPressed: boolean;
  aPressed: boolean;
  bPressed: boolean;
}

interface HoldRepeatState {
  left: number | null;
  right: number | null;
}

const HOLD_REPEAT_INITIAL_DELAY_MS = 250;
const HOLD_REPEAT_INTERVAL_MS = 110;

export const HERO_TRAILER_GRID_COLS = 2;
export const HERO_TRAILER_GRID_MAX_CARDS = 6;

type SpatialTrailerMove =
  | { type: "index"; value: number }
  | { type: "toActions" }
  | { type: "toContent" };

function spatialMoveTrailer(
  idx: number,
  n: number,
  dir: "left" | "right" | "up" | "down",
): SpatialTrailerMove {
  const c = HERO_TRAILER_GRID_COLS;
  const row = Math.floor(idx / c);
  const col = idx % c;

  if (dir === "left") {
    if (col > 0) return { type: "index", value: idx - 1 };
    if (row === 0) return { type: "toActions" };
    const lastRow = Math.floor((n - 1) / c);
    if (col === 0 && row === lastRow) return { type: "toActions" };
    const prevRight = (row - 1) * c + 1;
    if (prevRight < n) return { type: "index", value: prevRight };
    return { type: "index", value: (row - 1) * c };
  }

  if (dir === "right") {
    if (col === 0 && idx + 1 < n) return { type: "index", value: idx + 1 };
    return { type: "index", value: idx };
  }

  if (dir === "up") {
    if (row === 0) return { type: "toContent" };
    const up = (row - 1) * c + col;
    if (up < n) return { type: "index", value: up };
    return { type: "index", value: (row - 1) * c };
  }

  const down = (row + 1) * c + col;
  if (down < n) return { type: "index", value: down };
  const nextRowFirst = (row + 1) * c;
  if (col === 1 && nextRowFirst < n)
    return { type: "index", value: nextRowFirst };
  return { type: "index", value: idx };
}

export function useGamepadNavigation({
  apps,
  jumpStep,
  onStepPrev,
  onStepNext,
  setSelectedIndex,
  selectedIndex,
  focusArea,
  setFocusArea,
  navButtonIndex,
  setNavButtonIndex,
  isActive = true,
  onOpenSettings,
  onSearchSubmit,
  onSearchCancel,
  onOpenAlbum,
  onOpenWebBrowser,
  onActivateSearch,
  onButtonBPress,
  onMinus,
  replaceBottomNavWithHeroSplash = false,
  inlineDetailsOpen = false,
  onOpenInlineDetails,
  onCloseInlineDetails,
  heroInlineSubFocus = "content",
  setHeroInlineSubFocus,
  heroTrailerCount = 0,
  heroTrailerIndex = 0,
  setHeroTrailerIndex,
  onHeroTrailerActivate,
  heroActionIndex = 0,
  setHeroActionIndex,
  heroActionCount = 0,
  onHeroActionActivate,
}: GamepadNavigationProps) {
  const [gamepadState, setGamepadState] = useState<GamepadState>({
    shouldersPressed: { L: false, R: false },
    directionalPressed: { Left: false, Right: false, Up: false, Down: false },
    plusPressed: false,
    minusPressed: false,
    aPressed: false,
    bPressed: false,
  });
  const holdRepeatRef = useRef<HoldRepeatState>({ left: null, right: null });

  useEffect(() => {
    let animationFrameId: number;

    const canRepeat = (startedAt: number | null, now: number): boolean => {
      if (startedAt === null) {
        return true;
      }
      const heldFor = now - startedAt;
      if (heldFor < HOLD_REPEAT_INITIAL_DELAY_MS) {
        return false;
      }
      return heldFor % HOLD_REPEAT_INTERVAL_MS < 16;
    };

    const appCount = apps.length;

    const handleLeftPress = () => {
      if (focusArea === "searchInput") return;
      if (
        replaceBottomNavWithHeroSplash &&
        inlineDetailsOpen &&
        focusArea === "apps" &&
        heroInlineSubFocus === "actions" &&
        heroActionCount > 0
      ) {
        setHeroActionIndex?.((prev) => Math.max(0, prev - 1));
        return;
      }
      if (
        replaceBottomNavWithHeroSplash &&
        inlineDetailsOpen &&
        focusArea === "apps" &&
        heroInlineSubFocus === "trailers" &&
        heroTrailerCount > 0
      ) {
        const r = spatialMoveTrailer(
          heroTrailerIndex,
          heroTrailerCount,
          "left",
        );
        if (r.type === "toActions") {
          setHeroInlineSubFocus?.("actions");
          setHeroActionIndex?.(() => 1);
        } else if (r.type === "index") {
          setHeroTrailerIndex?.(() => r.value);
        }
        return;
      }
      if (focusArea === "settings") {
        setFocusArea(() => "album");
      } else if (focusArea === "album") {
        setFocusArea(() => "globe");
      } else if (focusArea === "globe") {
        setFocusArea(() => "search");
      } else if (focusArea === "apps") {
        onStepPrev();
      } else if (focusArea === "navigation") {
        setNavButtonIndex((prev) => (prev > 0 ? prev - 1 : 1));
      }
    };

    const handleRightPress = () => {
      if (focusArea === "searchInput") return;
      if (
        replaceBottomNavWithHeroSplash &&
        inlineDetailsOpen &&
        focusArea === "apps" &&
        heroInlineSubFocus === "actions" &&
        heroActionCount > 0
      ) {
        if (heroActionIndex === 1 && heroTrailerCount > 0) {
          setHeroInlineSubFocus?.("trailers");
          setHeroTrailerIndex?.(() => 0);
          return;
        }
        setHeroActionIndex?.((prev) => Math.min(heroActionCount - 1, prev + 1));
        return;
      }
      if (
        replaceBottomNavWithHeroSplash &&
        inlineDetailsOpen &&
        focusArea === "apps" &&
        heroInlineSubFocus === "trailers" &&
        heroTrailerCount > 0
      ) {
        const r = spatialMoveTrailer(
          heroTrailerIndex,
          heroTrailerCount,
          "right",
        );
        if (r.type === "index") {
          setHeroTrailerIndex?.(() => r.value);
        }
        return;
      }
      if (focusArea === "album") {
        setFocusArea(() => "settings");
      } else if (focusArea === "globe") {
        setFocusArea(() => "album");
      } else if (focusArea === "search") {
        setFocusArea(() => "globe");
      } else if (focusArea === "apps") {
        onStepNext();
      } else if (focusArea === "navigation") {
        setNavButtonIndex((prev) => (prev < 1 ? prev + 1 : 0));
      }
    };

    const handleGamepadInput = () => {
      const now = Date.now();
      const gamepad = navigator.getGamepads()[0];
      if (!gamepad) {
        return;
      }

      if (!isActive) {
        animationFrameId = requestAnimationFrame(handleGamepadInput);
        return;
      }

      // Plus: settings, except search field submits instead (default “exit” overridden).
      if (gamepad.buttons[Button.Plus].pressed && !gamepadState.plusPressed) {
        setGamepadState((prev) => ({ ...prev, plusPressed: true }));
        if (focusArea === "searchInput") {
          onSearchSubmit?.();
        } else {
          onOpenSettings?.();
        }
      } else if (
        !gamepad.buttons[Button.Plus].pressed &&
        gamepadState.plusPressed
      ) {
        setGamepadState((prev) => ({ ...prev, plusPressed: false }));
      }

      if (gamepad.buttons[Button.Minus].pressed && !gamepadState.minusPressed) {
        setGamepadState((prev) => ({ ...prev, minusPressed: true }));
        if (focusArea === "searchInput" || focusArea === "search") {
          onSearchCancel?.();
        } else if (focusArea === "apps") {
          onMinus?.();
        }
      } else if (
        !gamepad.buttons[Button.Minus].pressed &&
        gamepadState.minusPressed
      ) {
        setGamepadState((prev) => ({ ...prev, minusPressed: false }));
      }

      // L/R shoulder buttons
      if (
        gamepad.buttons[Button.L].pressed &&
        !gamepadState.shouldersPressed.L
      ) {
        setGamepadState((prev) => ({
          ...prev,
          shouldersPressed: { ...prev.shouldersPressed, L: true },
        }));
        if (
          focusArea === "apps" &&
          appCount > 0 &&
          !(
            replaceBottomNavWithHeroSplash &&
            inlineDetailsOpen &&
            (heroInlineSubFocus === "trailers" ||
              heroInlineSubFocus === "actions")
          )
        ) {
          setSelectedIndex((prev) => Math.max(0, prev - jumpStep));
        }
      } else if (
        !gamepad.buttons[Button.L].pressed &&
        gamepadState.shouldersPressed.L
      ) {
        setGamepadState((prev) => ({
          ...prev,
          shouldersPressed: { ...prev.shouldersPressed, L: false },
        }));
      }

      if (
        gamepad.buttons[Button.R].pressed &&
        !gamepadState.shouldersPressed.R
      ) {
        setGamepadState((prev) => ({
          ...prev,
          shouldersPressed: { ...prev.shouldersPressed, R: true },
        }));
        if (
          focusArea === "apps" &&
          appCount > 0 &&
          !(
            replaceBottomNavWithHeroSplash &&
            inlineDetailsOpen &&
            (heroInlineSubFocus === "trailers" ||
              heroInlineSubFocus === "actions")
          )
        ) {
          setSelectedIndex((prev) => Math.min(appCount - 1, prev + jumpStep));
        }
      } else if (
        !gamepad.buttons[Button.R].pressed &&
        gamepadState.shouldersPressed.R
      ) {
        setGamepadState((prev) => ({
          ...prev,
          shouldersPressed: { ...prev.shouldersPressed, R: false },
        }));
      }

      // Handle left input with debounce
      const isLeftPressed =
        Math.abs(gamepad.axes[0]) > 0.5
          ? gamepad.axes[0] < -0.5
          : gamepad.buttons[Button.Left].pressed;

      if (isLeftPressed && !gamepadState.directionalPressed.Left) {
        setGamepadState((prev) => ({
          ...prev,
          directionalPressed: { ...prev.directionalPressed, Left: true },
        }));
        holdRepeatRef.current.left = now;
        handleLeftPress();
      } else if (
        isLeftPressed &&
        gamepadState.directionalPressed.Left &&
        canRepeat(holdRepeatRef.current.left, now)
      ) {
        handleLeftPress();
      } else if (!isLeftPressed && gamepadState.directionalPressed.Left) {
        setGamepadState((prev) => ({
          ...prev,
          directionalPressed: { ...prev.directionalPressed, Left: false },
        }));
        holdRepeatRef.current.left = null;
      }

      // Handle right input with debounce
      const isRightPressed =
        Math.abs(gamepad.axes[0]) > 0.5
          ? gamepad.axes[0] > 0.5
          : gamepad.buttons[Button.Right].pressed;

      if (isRightPressed && !gamepadState.directionalPressed.Right) {
        setGamepadState((prev) => ({
          ...prev,
          directionalPressed: { ...prev.directionalPressed, Right: true },
        }));
        holdRepeatRef.current.right = now;
        handleRightPress();
      } else if (
        isRightPressed &&
        gamepadState.directionalPressed.Right &&
        canRepeat(holdRepeatRef.current.right, now)
      ) {
        handleRightPress();
      } else if (!isRightPressed && gamepadState.directionalPressed.Right) {
        setGamepadState((prev) => ({
          ...prev,
          directionalPressed: { ...prev.directionalPressed, Right: false },
        }));
        holdRepeatRef.current.right = null;
      }

      const isUpPressed =
        Math.abs(gamepad.axes[1]) > 0.5
          ? gamepad.axes[1] < -0.5
          : gamepad.buttons[Button.Up].pressed;

      if (isUpPressed && !gamepadState.directionalPressed.Up) {
        setGamepadState((prev) => ({
          ...prev,
          directionalPressed: { ...prev.directionalPressed, Up: true },
        }));
        if (focusArea === "searchInput") {
          // Search field + OS keyboard own vertical navigation; do not move focus.
        } else if (
          replaceBottomNavWithHeroSplash &&
          focusArea === "apps" &&
          inlineDetailsOpen
        ) {
          if (heroInlineSubFocus === "trailers" && heroTrailerCount > 0) {
            const r = spatialMoveTrailer(
              heroTrailerIndex,
              heroTrailerCount,
              "up",
            );
            if (r.type === "toContent") {
              setHeroInlineSubFocus?.("content");
              setHeroTrailerIndex?.(() => 0);
              setHeroActionIndex?.(() => 0);
            } else if (r.type === "index") {
              setHeroTrailerIndex?.(() => r.value);
            }
          } else if (heroInlineSubFocus === "actions") {
            setHeroInlineSubFocus?.("content");
          } else {
            onCloseInlineDetails?.();
          }
        } else {
          setFocusArea((prev) => {
            if (prev === "navigation") return "apps";
            if (prev === "apps") return "album";
            return prev;
          });
        }
      } else if (!isUpPressed && gamepadState.directionalPressed.Up) {
        setGamepadState((prev) => ({
          ...prev,
          directionalPressed: { ...prev.directionalPressed, Up: false },
        }));
      }

      const isDownPressed =
        Math.abs(gamepad.axes[1]) > 0.5
          ? gamepad.axes[1] > 0.5
          : gamepad.buttons[Button.Down].pressed;

      if (isDownPressed && !gamepadState.directionalPressed.Down) {
        setGamepadState((prev) => ({
          ...prev,
          directionalPressed: { ...prev.directionalPressed, Down: true },
        }));
        if (focusArea === "searchInput") {
          // Search field + OS keyboard own vertical navigation; do not move focus.
        } else if (replaceBottomNavWithHeroSplash && focusArea === "apps") {
          if (!inlineDetailsOpen) {
            onOpenInlineDetails?.();
          } else if (
            heroInlineSubFocus === "trailers" &&
            heroTrailerCount > 0
          ) {
            const r = spatialMoveTrailer(
              heroTrailerIndex,
              heroTrailerCount,
              "down",
            );
            if (r.type === "index") {
              setHeroTrailerIndex?.(() => r.value);
            }
          } else if (heroInlineSubFocus === "content") {
            setHeroInlineSubFocus?.("actions");
            setHeroActionIndex?.(() => 0);
          }
        } else {
          setFocusArea((prev) => {
            if (
              prev === "settings" ||
              prev === "album" ||
              prev === "globe" ||
              prev === "search"
            )
              return "apps";
            if (prev === "apps") return "navigation";
            return prev;
          });
        }
      } else if (!isDownPressed && gamepadState.directionalPressed.Down) {
        setGamepadState((prev) => ({
          ...prev,
          directionalPressed: { ...prev.directionalPressed, Down: false },
        }));
      }

      // Handle A button with press/release debounce
      if (gamepad.buttons[Button.A].pressed && !gamepadState.aPressed) {
        setGamepadState((prev) => ({ ...prev, aPressed: true }));
        if (focusArea === "apps") {
          if (
            replaceBottomNavWithHeroSplash &&
            inlineDetailsOpen &&
            heroInlineSubFocus === "actions" &&
            heroActionCount > 0
          ) {
            onHeroActionActivate?.(heroActionIndex);
          } else if (
            replaceBottomNavWithHeroSplash &&
            inlineDetailsOpen &&
            heroInlineSubFocus === "trailers" &&
            heroTrailerCount > 0
          ) {
            onHeroTrailerActivate?.();
          } else {
            const app = apps[selectedIndex];
            if (app) {
              registerAppLaunch(app);
              app.launch();
            }
          }
        } else if (focusArea === "navigation") {
          if (navButtonIndex === 0) {
            onStepPrev();
          } else {
            onStepNext();
          }
        } else if (focusArea === "settings") {
          onOpenSettings?.();
        } else if (focusArea === "album") {
          onOpenAlbum?.();
        } else if (focusArea === "globe") {
          onOpenWebBrowser?.();
        } else if (focusArea === "search") {
          onActivateSearch?.();
        }
      } else if (!gamepad.buttons[Button.A].pressed && gamepadState.aPressed) {
        setGamepadState((prev) => ({ ...prev, aPressed: false }));
      }

      if (gamepad.buttons[Button.B].pressed && !gamepadState.bPressed) {
        setGamepadState((prev) => ({ ...prev, bPressed: true }));
        onButtonBPress?.();
      } else if (!gamepad.buttons[Button.B].pressed && gamepadState.bPressed) {
        setGamepadState((prev) => ({ ...prev, bPressed: false }));
      }

      animationFrameId = requestAnimationFrame(handleGamepadInput);
    };

    animationFrameId = requestAnimationFrame(handleGamepadInput);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [
    gamepadState,
    apps,
    jumpStep,
    selectedIndex,
    onStepPrev,
    onStepNext,
    setSelectedIndex,
    focusArea,
    setFocusArea,
    navButtonIndex,
    setNavButtonIndex,
    isActive,
    onOpenSettings,
    onSearchSubmit,
    onSearchCancel,
    onOpenAlbum,
    onOpenWebBrowser,
    onActivateSearch,
    onButtonBPress,
    onMinus,
    replaceBottomNavWithHeroSplash,
    inlineDetailsOpen,
    onOpenInlineDetails,
    onCloseInlineDetails,
    heroInlineSubFocus,
    setHeroInlineSubFocus,
    heroTrailerCount,
    heroTrailerIndex,
    setHeroTrailerIndex,
    onHeroTrailerActivate,
    heroActionIndex,
    setHeroActionIndex,
    heroActionCount,
    onHeroActionActivate,
  ]);
}
