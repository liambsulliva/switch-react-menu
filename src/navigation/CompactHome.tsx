import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { Text } from "react-tela";
import { Button } from "@nx.js/constants";
import { truncate } from "../lib/truncate";
import { CustomSortMode } from "./CustomSortMode";
import { SettingsMenu } from "./SettingsMenu";
import { COLORS } from "../lib/colors";
import { List } from "../components/List";
import { ApplicationDetailsContent } from "../components/ApplicationDetailsContent";
import { Modal } from "../components/Modal";
import { HEADER_LAYOUT, HeaderLayout } from "../layouts/HeaderLayout";
import type { ListElementModel } from "../components/ListElement";
import {
  registerAppLaunch,
  useLastPlayedApplicationId,
} from "../settings/lastPlayedStore";
import { setSettings, useSettings } from "../settings/settingsStore";
import { setCustomOrder, useCustomOrder } from "../settings/customSortStore";
import { useLaunchCountsRevision } from "../settings/launchCountsStore";
import { sortApplicationsForMode } from "../lib/sortApplications";
import {
  getInstalledTitlesRevision,
  subscribeInstalledTitlesRevision,
} from "../lib/richDetailsBundledCatalog";
import { useHiddenGameIdSet } from "../settings/hiddenGamesStore";
import { requestRichDetailsCatalogHardReload } from "../lib/richDetailsHardReloadStore";

const ROW_HEIGHT = 84;
const listHeight =
  screen.height - HEADER_LAYOUT.contentTop - HEADER_LAYOUT.footerHeight;
const visibleRowCount = Math.floor(listHeight / ROW_HEIGHT);
const panelWidth = screen.width - HEADER_LAYOUT.paddingX * 2;

const HOLD_REPEAT_INITIAL_DELAY_MS = 250;
const HOLD_REPEAT_INTERVAL_MS = 110;

type ListFocusArea = "apps" | "settings";

interface ButtonState {
  upPressed: boolean;
  downPressed: boolean;
  leftPressed: boolean;
  rightPressed: boolean;
  aPressed: boolean;
  plusPressed: boolean;
  minusPressed: boolean;
}

interface HoldRepeatState {
  up: number | null;
  down: number | null;
}

const iconUrlCache = new Map<string, string>();

function getIconUrl(app: { id: bigint }, icon: ArrayBuffer): string {
  const key = app.id.toString();
  let url = iconUrlCache.get(key);
  if (!url) {
    url = URL.createObjectURL(new Blob([icon]));
    iconUrlCache.set(key, url);
  }
  return url;
}

function ensureVisible(index: number, offset: number): number {
  if (index < offset) return index;
  if (index >= offset + visibleRowCount) return index - visibleRowCount + 1;
  return offset;
}

export function CompactHome() {
  const settings = useSettings();
  const customOrder = useCustomOrder();
  const installedTitlesRevision = useSyncExternalStore(
    subscribeInstalledTitlesRevision,
    getInstalledTitlesRevision,
    getInstalledTitlesRevision,
  );
  const launchCountsRevision = useLaunchCountsRevision();
  const hiddenGameIds = useHiddenGameIdSet();
  const lastPlayedId = useLastPlayedApplicationId();
  const [apps, setApps] = useState<Switch.Application[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [focusArea, setFocusArea] = useState<ListFocusArea>("apps");
  const [showSettings, setShowSettings] = useState(false);
  const [showCustomSort, setShowCustomSort] = useState(false);
  const [detailsApp, setDetailsApp] = useState<Switch.Application | null>(null);

  const [buttonState, setButtonState] = useState<ButtonState>({
    upPressed: false,
    downPressed: false,
    leftPressed: false,
    rightPressed: false,
    aPressed: false,
    plusPressed: false,
    minusPressed: false,
  });
  const holdRepeatRef = useRef<HoldRepeatState>({ up: null, down: null });
  const gamepadArmedRef = useRef(false);
  const detailsAppRef = useRef<Switch.Application | null>(null);
  detailsAppRef.current = detailsApp;

  useEffect(() => {
    const loaded = Array.from(Switch.Application).filter((app) => app.icon);
    setApps(loaded);
  }, []);

  const handleRefreshRichCatalog = useCallback(() => {
    setShowSettings(false);
    requestRichDetailsCatalogHardReload();
  }, []);

  useEffect(() => {
    if (!settings.disableRichDetails) {
      setDetailsApp(null);
    }
  }, [settings.disableRichDetails]);

  useEffect(() => {
    if (settings.sortingMode !== "alphabetical") return;
    const alphabeticalOrder = [...apps]
      .sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
      )
      .map((app) => app.id.toString());
    setCustomOrder(alphabeticalOrder);
  }, [settings.sortingMode, apps]);

  const sortedApps = useMemo(
    () => sortApplicationsForMode(apps, settings.sortingMode, customOrder),
    [
      apps,
      settings.sortingMode,
      customOrder,
      installedTitlesRevision,
      launchCountsRevision,
    ],
  );

  const visibleSortedApps = useMemo(
    () => sortedApps.filter((app) => !hiddenGameIds.has(app.id.toString())),
    [sortedApps, hiddenGameIds],
  );

  const appCount = visibleSortedApps.length;

  const listItems = useMemo<ListElementModel[]>(
    () =>
      visibleSortedApps.map((app, index) => {
        const isSelected = focusArea === "apps" && index === selectedIndex;
        const isLastPlayed =
          settings.showLastPlayed &&
          lastPlayedId !== null &&
          app.id.toString() === lastPlayedId;
        return {
          id: app.id.toString(),
          label: settings.showAppTitles ? truncate(app.name, 38) : "",
          variant: "game" as const,
          gameIconSrc: app.icon ? getIconUrl(app, app.icon) : undefined,
          gameVersion: `v${app.version}`,
          gameEyebrow: isLastPlayed ? "Last Played!" : undefined,
          valueColorOverride: isSelected ? COLORS.gray[0] : COLORS.gray[200],
        };
      }),
    [
      visibleSortedApps,
      focusArea,
      selectedIndex,
      settings.showLastPlayed,
      settings.showAppTitles,
      lastPlayedId,
    ],
  );

  useEffect(() => {
    if (appCount === 0) {
      if (selectedIndex !== 0) setSelectedIndex(0);
      if (scrollOffset !== 0) setScrollOffset(0);
      return;
    }
    if (selectedIndex >= appCount) {
      const next = appCount - 1;
      setSelectedIndex(next);
      setScrollOffset((off) => ensureVisible(next, off));
    }
  }, [appCount, selectedIndex, scrollOffset]);

  useEffect(() => {
    if (showSettings || showCustomSort) return;
    let rafId: number;

    const canRepeat = (startedAt: number | null, now: number): boolean => {
      if (startedAt === null) return true;
      const heldFor = now - startedAt;
      if (heldFor < HOLD_REPEAT_INITIAL_DELAY_MS) return false;
      return heldFor % HOLD_REPEAT_INTERVAL_MS < 16;
    };

    const moveSelection = (direction: "up" | "down") => {
      if (appCount === 0) return;
      setFocusArea("apps");
      setSelectedIndex((prev) => {
        const next =
          direction === "up"
            ? Math.max(0, prev - 1)
            : Math.min(appCount - 1, prev + 1);
        setScrollOffset((off) => ensureVisible(next, off));
        return next;
      });
    };

    const launchSelected = () => {
      const app = visibleSortedApps[selectedIndex];
      if (!app) return;
      registerAppLaunch(app);
      app.launch();
    };

    const loop = () => {
      const now = Date.now();
      const gamepad = navigator.getGamepads()[0];
      if (!gamepad) {
        rafId = requestAnimationFrame(loop);
        return;
      }

      if (detailsAppRef.current) {
        rafId = requestAnimationFrame(loop);
        return;
      }

      const isUp =
        gamepad.buttons[Button.Up].pressed ||
        (Math.abs(gamepad.axes[1]) > 0.5 && gamepad.axes[1] < -0.5);
      const isDown =
        gamepad.buttons[Button.Down].pressed ||
        (Math.abs(gamepad.axes[1]) > 0.5 && gamepad.axes[1] > 0.5);
      const isLeft =
        gamepad.buttons[Button.Left].pressed ||
        (Math.abs(gamepad.axes[0]) > 0.5 && gamepad.axes[0] < -0.5);
      const isRight =
        gamepad.buttons[Button.Right].pressed ||
        (Math.abs(gamepad.axes[0]) > 0.5 && gamepad.axes[0] > 0.5);
      const isA = gamepad.buttons[Button.A].pressed;
      const isPlus = gamepad.buttons[Button.Plus].pressed;
      const isMinus = gamepad.buttons[Button.Minus].pressed;

      if (!gamepadArmedRef.current) {
        if (
          !isA &&
          !isPlus &&
          !isMinus &&
          !isUp &&
          !isDown &&
          !isLeft &&
          !isRight
        ) {
          gamepadArmedRef.current = true;
          holdRepeatRef.current = { up: null, down: null };
        }
        rafId = requestAnimationFrame(loop);
        return;
      }

      if (isUp && !buttonState.upPressed) {
        setButtonState((prev) => ({ ...prev, upPressed: true }));
        holdRepeatRef.current.up = now;
        if (focusArea === "settings") {
        } else {
          if (selectedIndex === 0) {
            setFocusArea("settings");
          } else {
            moveSelection("up");
          }
        }
      } else if (
        isUp &&
        buttonState.upPressed &&
        canRepeat(holdRepeatRef.current.up, now)
      ) {
        if (focusArea !== "settings") moveSelection("up");
      } else if (!isUp && buttonState.upPressed) {
        setButtonState((prev) => ({ ...prev, upPressed: false }));
        holdRepeatRef.current.up = null;
      }

      if (isDown && !buttonState.downPressed) {
        setButtonState((prev) => ({ ...prev, downPressed: true }));
        holdRepeatRef.current.down = now;
        if (focusArea === "settings") {
          setFocusArea("apps");
        } else {
          moveSelection("down");
        }
      } else if (
        isDown &&
        buttonState.downPressed &&
        canRepeat(holdRepeatRef.current.down, now)
      ) {
        if (focusArea !== "settings") moveSelection("down");
      } else if (!isDown && buttonState.downPressed) {
        setButtonState((prev) => ({ ...prev, downPressed: false }));
        holdRepeatRef.current.down = null;
      }

      if (isRight && !buttonState.rightPressed) {
        setButtonState((prev) => ({ ...prev, rightPressed: true }));
        if (focusArea === "apps" && selectedIndex < 2) {
          setFocusArea("settings");
        }
      } else if (!isRight && buttonState.rightPressed) {
        setButtonState((prev) => ({ ...prev, rightPressed: false }));
      }

      if (isLeft && !buttonState.leftPressed) {
        setButtonState((prev) => ({ ...prev, leftPressed: true }));
        if (focusArea === "settings") {
          setFocusArea("apps");
        }
      } else if (!isLeft && buttonState.leftPressed) {
        setButtonState((prev) => ({ ...prev, leftPressed: false }));
      }

      if (isA && !buttonState.aPressed) {
        setButtonState((prev) => ({ ...prev, aPressed: true }));
        if (focusArea === "settings") {
          setShowSettings(true);
        } else {
          launchSelected();
        }
      } else if (!isA && buttonState.aPressed) {
        setButtonState((prev) => ({ ...prev, aPressed: false }));
      }

      if (isPlus && !buttonState.plusPressed) {
        setButtonState((prev) => ({ ...prev, plusPressed: true }));
        setShowSettings(true);
      } else if (!isPlus && buttonState.plusPressed) {
        setButtonState((prev) => ({ ...prev, plusPressed: false }));
      }

      if (isMinus && !buttonState.minusPressed) {
        setButtonState((prev) => ({ ...prev, minusPressed: true }));
        if (focusArea === "apps" && settings.disableRichDetails) {
          const app = visibleSortedApps[selectedIndex];
          if (app) setDetailsApp(app);
        }
      } else if (!isMinus && buttonState.minusPressed) {
        setButtonState((prev) => ({ ...prev, minusPressed: false }));
      }

      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [
    buttonState,
    visibleSortedApps,
    selectedIndex,
    focusArea,
    appCount,
    showSettings,
    showCustomSort,
    settings.disableRichDetails,
  ]);

  useEffect(() => {
    if (showSettings || showCustomSort || detailsApp) {
      gamepadArmedRef.current = false;
    }
  }, [showSettings, showCustomSort, detailsApp]);

  if (showSettings) {
    return (
      <SettingsMenu
        onClose={() => setShowSettings(false)}
        onCustomSort={() => {
          setSettings({ sortingMode: "custom" });
          setShowSettings(false);
          setShowCustomSort(true);
        }}
        onRefreshRichCatalog={handleRefreshRichCatalog}
      />
    );
  }

  if (showCustomSort) {
    return (
      <CustomSortMode
        apps={sortedApps}
        compact={true}
        onDone={(newOrder) => {
          setCustomOrder(newOrder);
          setShowCustomSort(false);
        }}
        onCancel={() => setShowCustomSort(false)}
      />
    );
  }

  return (
    <HeaderLayout
      title="All Applications"
      rightActionLabel="Settings"
      rightActionActive={focusArea === "settings"}
      onRightActionTouchStart={() => setShowSettings(true)}
      footerHint={
        settings.disableRichDetails ? "A  Launch      −  Details" : "A  Launch"
      }
    >
      <List
        x={HEADER_LAYOUT.paddingX}
        top={HEADER_LAYOUT.contentTop}
        width={panelWidth}
        rowHeight={ROW_HEIGHT}
        visibleCount={visibleRowCount}
        items={listItems}
        selectedIndex={selectedIndex}
        isFocused={focusArea === "apps"}
        scrollOffset={scrollOffset}
        onItemTouchStart={(absoluteIndex) => {
          const app = visibleSortedApps[absoluteIndex];
          if (!app) return;
          setFocusArea("apps");
          if (selectedIndex !== absoluteIndex) {
            setSelectedIndex(absoluteIndex);
            setScrollOffset((off) => ensureVisible(absoluteIndex, off));
            return;
          }
          registerAppLaunch(app);
          app.launch();
        }}
      />

      {appCount === 0 && (
        <Text
          x={screen.width / 2}
          y={HEADER_LAYOUT.contentTop + listHeight / 2}
          fill={COLORS.gray[600]}
          fontSize={26}
          fontFamily="SourceSansPro-Regular"
          textAlign="center"
          textBaseline="middle"
        >
          No applications installed.
        </Text>
      )}

      {detailsApp && settings.disableRichDetails && (
        <Modal
          visible
          title="Application details"
          onClose={() => setDetailsApp(null)}
          maxPanelHeight={340}
        >
          {(layout) => (
            <ApplicationDetailsContent app={detailsApp} layout={layout} />
          )}
        </Modal>
      )}
    </HeaderLayout>
  );
}
