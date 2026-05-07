import { useEffect, useState } from "react";
import { Button } from "@nx.js/constants";

interface GamepadNavigationProps {
  onPrevPage: () => void;
  onNextPage: () => void;
  setSelectedIndex: (cb: (prev: number) => number) => void;
  paginatedApps: { app: Switch.Application }[];
  selectedIndex: number;
  focusArea: "apps" | "navigation" | "settings";
  setFocusArea: (
    cb: (prev: "apps" | "navigation" | "settings") => "apps" | "navigation" | "settings",
  ) => void;
  navButtonIndex: number;
  setNavButtonIndex: (cb: (prev: number) => number) => void;
  isActive?: boolean;
  onOpenSettings?: () => void;
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
  aPressed: boolean;
}

export function useGamepadNavigation({
  onPrevPage,
  onNextPage,
  setSelectedIndex,
  paginatedApps,
  selectedIndex,
  focusArea,
  setFocusArea,
  navButtonIndex,
  setNavButtonIndex,
  isActive = true,
  onOpenSettings,
}: GamepadNavigationProps) {
  const [gamepadState, setGamepadState] = useState<GamepadState>({
    shouldersPressed: { L: false, R: false },
    directionalPressed: { Left: false, Right: false, Up: false, Down: false },
    plusPressed: false,
    aPressed: false,
  });

  useEffect(() => {
    let animationFrameId: number;

    const handleGamepadInput = () => {
      const gamepad = navigator.getGamepads()[0];
      if (!gamepad) {
        return;
      }

      if (!isActive) {
        animationFrameId = requestAnimationFrame(handleGamepadInput);
        return;
      }

      // Plus button opens settings
      if (
        gamepad.buttons[Button.Plus].pressed &&
        !gamepadState.plusPressed
      ) {
        setGamepadState((prev) => ({ ...prev, plusPressed: true }));
        onOpenSettings?.();
      } else if (
        !gamepad.buttons[Button.Plus].pressed &&
        gamepadState.plusPressed
      ) {
        setGamepadState((prev) => ({ ...prev, plusPressed: false }));
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
        onPrevPage();
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
        onNextPage();
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
        if (focusArea === "apps") {
          setSelectedIndex((prev) => {
            const newIndex = prev - 1;
            if (newIndex < 0) {
              onPrevPage();
              return paginatedApps.length - 1;
            }
            return newIndex;
          });
        } else if (focusArea === "navigation") {
          setNavButtonIndex((prev) => (prev > 0 ? prev - 1 : 1));
        }
      } else if (!isLeftPressed && gamepadState.directionalPressed.Left) {
        setGamepadState((prev) => ({
          ...prev,
          directionalPressed: { ...prev.directionalPressed, Left: false },
        }));
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
        if (focusArea === "apps") {
          setSelectedIndex((prev) => {
            const newIndex = prev + 1;
            if (newIndex >= paginatedApps.length) {
              onNextPage();
              return 0;
            }
            return newIndex;
          });
        } else if (focusArea === "navigation") {
          setNavButtonIndex((prev) => (prev < 1 ? prev + 1 : 0));
        }
      } else if (!isRightPressed && gamepadState.directionalPressed.Right) {
        setGamepadState((prev) => ({
          ...prev,
          directionalPressed: { ...prev.directionalPressed, Right: false },
        }));
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
        setFocusArea((prev) => {
          if (prev === "navigation") return "apps";
          if (prev === "apps") return "settings";
          return prev;
        });
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
        setFocusArea((prev) => {
          if (prev === "settings") return "apps";
          if (prev === "apps") return "navigation";
          return prev;
        });
      } else if (!isDownPressed && gamepadState.directionalPressed.Down) {
        setGamepadState((prev) => ({
          ...prev,
          directionalPressed: { ...prev.directionalPressed, Down: false },
        }));
      }

      // Handle A button with press/release debounce
      if (gamepad.buttons[Button.A].pressed && !gamepadState.aPressed) {
        setGamepadState((prev) => ({ ...prev, aPressed: true }));
        if (focusArea === "apps" && paginatedApps[selectedIndex]) {
          paginatedApps[selectedIndex].app.launch();
        } else if (focusArea === "navigation") {
          if (navButtonIndex === 0) {
            onPrevPage();
          } else {
            onNextPage();
          }
        } else if (focusArea === "settings") {
          onOpenSettings?.();
        }
      } else if (!gamepad.buttons[Button.A].pressed && gamepadState.aPressed) {
        setGamepadState((prev) => ({ ...prev, aPressed: false }));
      }

      animationFrameId = requestAnimationFrame(handleGamepadInput);
    };

    animationFrameId = requestAnimationFrame(handleGamepadInput);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [
    gamepadState,
    paginatedApps,
    selectedIndex,
    onPrevPage,
    onNextPage,
    setSelectedIndex,
    focusArea,
    setFocusArea,
    navButtonIndex,
    setNavButtonIndex,
    isActive,
    onOpenSettings,
  ]);
}
