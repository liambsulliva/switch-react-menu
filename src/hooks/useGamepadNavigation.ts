import { useEffect, useState } from "react";
import { Button } from "@nx.js/constants";

interface GamepadNavigationProps {
  onPrevPage: () => void;
  onNextPage: () => void;
  setSelectedIndex: (cb: (prev: number) => number) => void;
  paginatedApps: { app: Switch.Application }[];
  selectedIndex: number;
}

interface GamepadState {
  shouldersPressed: {
    L: boolean;
    R: boolean;
  };
  directionalPressed: {
    Left: boolean;
    Right: boolean;
  };
}

export function useGamepadNavigation({
  onPrevPage,
  onNextPage,
  setSelectedIndex,
  paginatedApps,
  selectedIndex,
}: GamepadNavigationProps) {
  const [gamepadState, setGamepadState] = useState<GamepadState>({
    shouldersPressed: { L: false, R: false },
    directionalPressed: { Left: false, Right: false },
  });

  useEffect(() => {
    let animationFrameId: number;

    const handleGamepadInput = () => {
      const gamepad = navigator.getGamepads()[0];
      if (!gamepad) {
        return;
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
        setSelectedIndex((prev) => {
          const newIndex = prev - 1;
          if (newIndex < 0) {
            onPrevPage();
            return paginatedApps.length - 1;
          }
          return newIndex;
        });
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
        setSelectedIndex((prev) => {
          const newIndex = prev + 1;
          if (newIndex >= paginatedApps.length) {
            onNextPage();
            return 0;
          }
          return newIndex;
        });
      } else if (!isRightPressed && gamepadState.directionalPressed.Right) {
        setGamepadState((prev) => ({
          ...prev,
          directionalPressed: { ...prev.directionalPressed, Right: false },
        }));
      }

      // Handle A button
      if (gamepad.buttons[Button.A].pressed && paginatedApps[selectedIndex]) {
        paginatedApps[selectedIndex].app.launch();
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
  ]);
}
