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

export type HeroSplashInlineSubFocus = "content" | "trailers";

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
  /** Plus while search field is focused: confirm search (do not open settings). */
  onSearchSubmit?: () => void;
  /** Minus while search icon or field is focused: cancel search and clear query. */
  onSearchCancel?: () => void;
  onOpenAlbum?: () => void;
  onOpenWebBrowser?: () => void;
  /** A on the search icon: move focus into the search field / keyboard. */
  onActivateSearch?: () => void;
  /** Rising edge of B (e.g. clear search text). */
  onButtonBPress?: () => void;
  onMinus?: () => void;
  replaceBottomNavWithHeroSplash?: boolean;
  inlineDetailsOpen?: boolean;
  onOpenInlineDetails?: () => void;
  onCloseInlineDetails?: () => void;
  heroInlineSubFocus?: HeroSplashInlineSubFocus;
  setHeroInlineSubFocus?: (next: HeroSplashInlineSubFocus) => void;
  heroTrailerCount?: number;
  setHeroTrailerIndex?: (update: (prev: number) => number) => void;
  onHeroTrailerActivate?: () => void;
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
  setHeroTrailerIndex,
  onHeroTrailerActivate,
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
        heroInlineSubFocus === "trailers" &&
        heroTrailerCount > 0
      ) {
        setHeroTrailerIndex?.((prev) => Math.max(0, prev - 1));
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
        heroInlineSubFocus === "trailers" &&
        heroTrailerCount > 0
      ) {
        setHeroTrailerIndex?.((prev) =>
          Math.min(heroTrailerCount - 1, prev + 1),
        );
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
      if (
        gamepad.buttons[Button.Plus].pressed &&
        !gamepadState.plusPressed
      ) {
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

      if (
        gamepad.buttons[Button.Minus].pressed &&
        !gamepadState.minusPressed
      ) {
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
            heroInlineSubFocus === "trailers"
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
            heroInlineSubFocus === "trailers"
          )
        ) {
          setSelectedIndex((prev) =>
            Math.min(appCount - 1, prev + jumpStep),
          );
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
        if (
          replaceBottomNavWithHeroSplash &&
          focusArea === "apps" &&
          inlineDetailsOpen
        ) {
          if (heroInlineSubFocus === "trailers") {
            setHeroInlineSubFocus?.("content");
          } else {
            onCloseInlineDetails?.();
          }
        } else {
          setFocusArea((prev) => {
            if (prev === "navigation") return "apps";
            if (prev === "apps") return "album";
            if (prev === "searchInput") return "search";
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
        if (replaceBottomNavWithHeroSplash && focusArea === "apps") {
          if (!inlineDetailsOpen) {
            onOpenInlineDetails?.();
          } else if (
            heroInlineSubFocus === "content" &&
            heroTrailerCount > 0
          ) {
            setHeroInlineSubFocus?.("trailers");
            setHeroTrailerIndex?.(() => 0);
          }
        } else {
          setFocusArea((prev) => {
            if (
              prev === "settings" ||
              prev === "album" ||
              prev === "globe" ||
              prev === "search" ||
              prev === "searchInput"
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
    setHeroTrailerIndex,
    onHeroTrailerActivate,
  ]);
}
