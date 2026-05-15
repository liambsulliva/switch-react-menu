import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { Button } from "@nx.js/constants";
import { Rect, Text } from "react-tela";
import { Button as ActionButton } from "../components/Button";
import { Input, handleVirtualKeyboardFaceButton, INPUT_VIRTUAL_KEYBOARD_FOOTER_HINT } from "../components/Input";
import { COLORS } from "../lib/colors";
import { HEADER_LAYOUT, HeaderLayout } from "../layouts/HeaderLayout";
import { useSwitchVirtualKeyboard } from "../hooks/useSwitchVirtualKeyboard";
import type { RichGameDetails, RichTrailer } from "../lib/richGameDetails";
import {
  getInstalledRichMatch,
  persistRichCatalogAfterBootstrap,
  setInstalledRichMatch,
} from "../lib/richDetailsBundledCatalog";

type NxVirtualKeyboard = EventTarget & {
  value: string;
  show(): void;
  hide(): void;
};

function getNxVirtualKeyboard(): NxVirtualKeyboard | null {
  const nav = navigator as Navigator & { virtualKeyboard?: NxVirtualKeyboard };
  const vk = nav.virtualKeyboard;
  if (!vk || typeof vk.show !== "function") return null;
  if (typeof vk.value !== "string") return null;
  return vk;
}

export type RichEditorForm = {
  name: string;
  releaseDate: string;
  tags: string;
  summary: string;
  coverUrl: string;
  backgroundUrl: string;
  trailersText: string;
};

const FIELD_KEYS = [
  "name",
  "releaseDate",
  "tags",
  "summary",
  "coverUrl",
  "backgroundUrl",
  "trailersText",
] as const;

export type RichEditorFieldKey = (typeof FIELD_KEYS)[number];

const SAVE_FOCUS_INDEX = FIELD_KEYS.length;

const FIELD_LABELS: Record<RichEditorFieldKey, string> = {
  name: "Title",
  releaseDate: "Release date (YYYY-MM-DD)",
  tags: "Tags (comma-separated)",
  summary: "Summary",
  coverUrl: "Cover image URL",
  backgroundUrl: "Background image URL",
  trailersText: "Trailers (one per line: Name|youtubeId)",
};

const EDITOR_ROW_H = 72;
const EDITOR_LIST_TOP = HEADER_LAYOUT.contentTop;
const EDITOR_LIST_HEIGHT =
  screen.height - EDITOR_LIST_TOP - HEADER_LAYOUT.footerHeight;
const EDITOR_VISIBLE_ROWS = Math.max(
  1,
  Math.floor(EDITOR_LIST_HEIGHT / EDITOR_ROW_H),
);
const EDITOR_VIEWPORT_H = EDITOR_VISIBLE_ROWS * EDITOR_ROW_H;
const EDITOR_ROW_COUNT = FIELD_KEYS.length + 1;

function ensureEditorRowVisible(index: number, offset: number): number {
  if (index < offset) return index;
  if (index >= offset + EDITOR_VISIBLE_ROWS) {
    return index - EDITOR_VISIBLE_ROWS + 1;
  }
  return offset;
}

function defaultRichDetails(app: Switch.Application): RichGameDetails {
  return {
    name: app.name,
    summary: null,
    firstReleaseDate: null,
    coverUrl: null,
    backgroundUrl: null,
    trailers: [],
    tags: [],
  };
}

function mergeRichDetails(
  app: Switch.Application,
  match: RichGameDetails | null,
): RichGameDetails {
  const base = defaultRichDetails(app);
  if (!match) return base;
  return {
    name: match.name.trim() || base.name,
    summary: match.summary,
    firstReleaseDate: match.firstReleaseDate,
    coverUrl: match.coverUrl,
    backgroundUrl: match.backgroundUrl,
    trailers: Array.isArray(match.trailers) ? [...match.trailers] : [],
    tags: Array.isArray(match.tags) ? [...match.tags] : [],
  };
}

function unixToDateInput(ts: number | null): string {
  if (ts == null) return "";
  try {
    const d = new Date(ts * 1000);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  } catch {
    return "";
  }
}

function dateInputToUnix(s: string): number | null {
  const t = s.trim();
  if (!t) return null;
  const ms = Date.parse(`${t}T12:00:00`);
  if (Number.isNaN(ms)) return null;
  return Math.floor(ms / 1000);
}

function trailersToText(trailers: RichTrailer[]): string {
  return trailers
    .map((tr) => {
      const name = tr.name?.trim() || "Trailer";
      return `${name}|${tr.youtubeId}`;
    })
    .join("\n");
}

function parseTrailersText(s: string): RichTrailer[] {
  const out: RichTrailer[] = [];
  for (const rawLine of s.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    const pipe = line.indexOf("|");
    if (pipe >= 0) {
      const name = line.slice(0, pipe).trim() || "Trailer";
      const youtubeId = line.slice(pipe + 1).trim();
      if (youtubeId) out.push({ name, youtubeId });
    } else if (/^[a-zA-Z0-9_-]{6,}$/.test(line)) {
      out.push({ name: "Trailer", youtubeId: line });
    }
  }
  return out;
}

function detailsToForm(details: RichGameDetails): RichEditorForm {
  return {
    name: details.name,
    releaseDate: unixToDateInput(details.firstReleaseDate),
    tags: details.tags.join(", "),
    summary: details.summary ?? "",
    coverUrl: details.coverUrl ?? "",
    backgroundUrl: details.backgroundUrl ?? "",
    trailersText: trailersToText(details.trailers),
  };
}

function formToDetails(
  form: RichEditorForm,
  app: Switch.Application,
): RichGameDetails {
  const tags = form.tags
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  const name = form.name.trim() || app.name;
  return {
    name,
    summary: form.summary.trim() ? form.summary.trim() : null,
    firstReleaseDate: dateInputToUnix(form.releaseDate),
    coverUrl: form.coverUrl.trim() ? form.coverUrl.trim() : null,
    backgroundUrl: form.backgroundUrl.trim() ? form.backgroundUrl.trim() : null,
    trailers: parseTrailersText(form.trailersText),
    tags,
  };
}

function readFormField(form: RichEditorForm, key: RichEditorFieldKey): string {
  return form[key];
}

export interface EditAppProps {
  app: Switch.Application;
  installedAppsForPersistence: readonly Switch.Application[];
  onClose: () => void;
}

export function EditApp({
  app,
  installedAppsForPersistence,
  onClose,
}: EditAppProps) {
  const [form, setForm] = useState<RichEditorForm | null>(null);
  const formRef = useRef<RichEditorForm | null>(null);
  formRef.current = form;

  const [focusIndex, setFocusIndex] = useState(0);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [focusArea, setFocusArea] = useState<"fields" | "back">("fields");
  const [editingField, setEditingField] = useState<RichEditorFieldKey | null>(
    null,
  );
  const editingFieldRef = useRef<RichEditorFieldKey | null>(null);
  editingFieldRef.current = editingField;

  const { text: vkText, deleteLastChar: deleteLastVkChar } =
    useSwitchVirtualKeyboard(editingField !== null);

  useEffect(() => {
    let cancelled = false;
    void getInstalledRichMatch(app).then((m) => {
      if (cancelled) return;
      const merged = mergeRichDetails(app, m);
      setForm(detailsToForm(merged));
    });
    return () => {
      cancelled = true;
    };
  }, [app]);

  useLayoutEffect(() => {
    if (!editingField) return;
    const vk = getNxVirtualKeyboard();
    const current = formRef.current;
    if (vk && current) {
      vk.value = readFormField(current, editingField);
    }
  }, [editingField]);

  useEffect(() => {
    setScrollOffset((o) => ensureEditorRowVisible(focusIndex, o));
  }, [focusIndex]);

  const panelW = screen.width - HEADER_LAYOUT.paddingX * 2;
  const contentX = HEADER_LAYOUT.paddingX;
  const showScrollbar = EDITOR_ROW_COUNT > EDITOR_VISIBLE_ROWS;
  const listW = panelW;
  const scrollbarThumbHeight = Math.max(
    24,
    (EDITOR_VISIBLE_ROWS / Math.max(1, EDITOR_ROW_COUNT)) * EDITOR_VIEWPORT_H,
  );
  const scrollbarThumbY =
    EDITOR_LIST_TOP +
    (scrollOffset / Math.max(1, EDITOR_ROW_COUNT - EDITOR_VISIBLE_ROWS)) *
      (EDITOR_VIEWPORT_H - scrollbarThumbHeight);

  const commitSave = useCallback(async () => {
    let f = formRef.current;
    if (!f) return;
    const key = editingFieldRef.current;
    if (key) {
      const vk = getNxVirtualKeyboard();
      f = { ...f, [key]: vk?.value ?? vkTextRef.current };
      setForm(f);
      formRef.current = f;
      setEditingField(null);
    }
    const details = formToDetails(f, app);
    setInstalledRichMatch(app.id.toString(), details);
    await persistRichCatalogAfterBootstrap(installedAppsForPersistence);
    onClose();
  }, [app, installedAppsForPersistence, onClose]);

  const gamepadArmedRef = useRef(false);
  const buttonRef = useRef({
    up: false,
    down: false,
    a: false,
    b: false,
    x: false,
    plus: false,
    minus: false,
  });
  const focusIndexRef = useRef(0);
  const focusAreaRef = useRef<"fields" | "back">("fields");
  focusIndexRef.current = focusIndex;
  focusAreaRef.current = focusArea;
  const vkTextRef = useRef("");
  vkTextRef.current = vkText;

  const commitFieldAndStopEditing = useCallback(() => {
    const key = editingFieldRef.current;
    if (!key) return;
    const vk = getNxVirtualKeyboard();
    const nextVal = vk?.value ?? vkTextRef.current;
    setForm((f) => {
      if (!f) return f;
      const next = { ...f, [key]: nextVal };
      formRef.current = next;
      return next;
    });
    setEditingField(null);
  }, []);

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const gp = navigator.getGamepads()[0];
      const b = buttonRef.current;
      if (!gp) {
        raf = requestAnimationFrame(loop);
        return;
      }

      const isUp =
        gp.buttons[Button.Up].pressed ||
        (Math.abs(gp.axes[1]) > 0.5 && gp.axes[1] < -0.5);
      const isDown =
        gp.buttons[Button.Down].pressed ||
        (Math.abs(gp.axes[1]) > 0.5 && gp.axes[1] > 0.5);
      const isA = gp.buttons[Button.A].pressed;
      const isB = gp.buttons[Button.B].pressed;
      const isX = gp.buttons[Button.X].pressed;
      const isPlus = gp.buttons[Button.Plus].pressed;
      const isMinus = gp.buttons[Button.Minus].pressed;

      if (!gamepadArmedRef.current) {
        if (!isUp && !isDown && !isA && !isB && !isX && !isPlus && !isMinus) {
          gamepadArmedRef.current = true;
        }
        raf = requestAnimationFrame(loop);
        return;
      }

      if (editingFieldRef.current !== null) {
        const vk = getNxVirtualKeyboard();
        const vkLen = (vk?.value ?? vkTextRef.current).length;
        const dispatchVkSubmit = () => {
          const v = getNxVirtualKeyboard();
          if (
            v &&
            typeof (v as EventTarget & { dispatchEvent?: (e: Event) => boolean })
              .dispatchEvent === "function"
          ) {
            v.dispatchEvent(new Event("submit"));
          }
        };
        if (isB && !b.b) {
          handleVirtualKeyboardFaceButton("B", {
            valueLength: vkLen,
            deleteLastChar: deleteLastVkChar,
            onDismiss: commitFieldAndStopEditing,
          });
        }
        if (isX && !b.x) {
          handleVirtualKeyboardFaceButton("X", {
            valueLength: vkLen,
            deleteLastChar: deleteLastVkChar,
            onDismiss: commitFieldAndStopEditing,
          });
        }
        if (isMinus && !b.minus) {
          handleVirtualKeyboardFaceButton("minus", {
            valueLength: vkLen,
            deleteLastChar: deleteLastVkChar,
            onDismiss: commitFieldAndStopEditing,
          });
        }
        if (isPlus && !b.plus) {
          handleVirtualKeyboardFaceButton("plus", {
            valueLength: vkLen,
            deleteLastChar: deleteLastVkChar,
            onDismiss: commitFieldAndStopEditing,
            onSubmit: dispatchVkSubmit,
          });
        }
        b.up = isUp;
        b.down = isDown;
        b.a = isA;
        b.b = isB;
        b.x = isX;
        b.plus = isPlus;
        b.minus = isMinus;
        raf = requestAnimationFrame(loop);
        return;
      }

      if (focusAreaRef.current === "back") {
        if (isDown && !b.down) {
          gamepadArmedRef.current = false;
          setFocusArea("fields");
        }
        if (isA && !b.a) onClose();
        b.up = isUp;
        b.down = isDown;
        b.a = isA;
        b.b = isB;
        b.x = isX;
        b.plus = isPlus;
        b.minus = isMinus;
        raf = requestAnimationFrame(loop);
        return;
      }

      const maxFocus = SAVE_FOCUS_INDEX;
      const fi = focusIndexRef.current;
      if (isUp && !b.up) {
        if (fi <= 0) {
          setFocusArea("back");
        } else {
          setFocusIndex(fi - 1);
        }
      }
      if (isDown && !b.down) {
        setFocusIndex(Math.min(maxFocus, fi + 1));
      }
      if (isA && !b.a) {
        if (fi === SAVE_FOCUS_INDEX) {
          void commitSave();
        } else {
          const key = FIELD_KEYS[fi];
          if (key) setEditingField(key);
        }
      }
      if (isB && !b.b) onClose();
      if (isMinus && !b.minus) onClose();

      b.up = isUp;
      b.down = isDown;
      b.a = isA;
      b.b = isB;
      b.x = isX;
      b.plus = isPlus;
      b.minus = isMinus;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [commitFieldAndStopEditing, commitSave, onClose, deleteLastVkChar]);

  const hoverFieldRow = useCallback((idx: number) => {
    setFocusArea("fields");
    setFocusIndex(idx);
  }, []);

  const touchOpenField = useCallback((idx: number) => {
    let base = formRef.current;
    const prevKey = editingFieldRef.current;
    if (prevKey && base) {
      const vk = getNxVirtualKeyboard();
      base = { ...base, [prevKey]: vk?.value ?? vkTextRef.current };
      setForm(base);
      formRef.current = base;
    }
    setFocusArea("fields");
    setFocusIndex(idx);
    if (idx === SAVE_FOCUS_INDEX) {
      setEditingField(null);
      return;
    }
    const key = FIELD_KEYS[idx];
    if (key) setEditingField(key);
  }, []);

  if (!form) {
    return (
      <HeaderLayout
        title="Edit game info"
        rightActionLabel="Back"
        rightActionActive={false}
        onRightActionTouchStart={onClose}
        footerHint="Loading…"
      >
        <Text
          x={screen.width / 2}
          y={screen.height / 2}
          fill={COLORS.gray[400]}
          fontSize={24}
          fontFamily="SourceSansPro-Regular"
          textAlign="center"
          textBaseline="middle"
        >
          Loading…
        </Text>
      </HeaderLayout>
    );
  }

  return (
    <HeaderLayout
      title="Edit game info"
      rightActionLabel="Back"
      rightActionActive={focusArea === "back"}
      onRightActionTouchStart={onClose}
      onRightActionMouseEnter={() => setFocusArea("back")}
      onRightActionMouseLeave={() => setFocusArea("fields")}
      footerHint={
        editingField
          ? INPUT_VIRTUAL_KEYBOARD_FOOTER_HINT
          : "A  Edit field / Save      B / −  Back"
      }
    >
      {Array.from({ length: EDITOR_VISIBLE_ROWS }, (_, vi) => {
        const absoluteIndex = scrollOffset + vi;
        if (absoluteIndex > SAVE_FOCUS_INDEX) return null;
        const rowY = EDITOR_LIST_TOP + vi * EDITOR_ROW_H;

        if (absoluteIndex < FIELD_KEYS.length) {
          const rowKey = FIELD_KEYS[absoluteIndex]!;
          return (
            <Input
              key={rowKey}
              x={contentX}
              y={rowY}
              width={listW}
              height={EDITOR_ROW_H}
              label={FIELD_LABELS[rowKey]}
              value={
                editingField === rowKey ? vkText : readFormField(form, rowKey)
              }
              isFocused={focusArea === "fields" && focusIndex === absoluteIndex}
              isEditing={editingField === rowKey}
              valueMaxChars={rowKey === "summary" ? 36 : 52}
              onPress={() => touchOpenField(absoluteIndex)}
              onMouseEnter={() => hoverFieldRow(absoluteIndex)}
            />
          );
        }

        const saveBtnW = Math.min(220, listW);
        return (
          <React.Fragment key="save-row">
            <Rect
              x={contentX}
              y={rowY}
              width={listW}
              height={EDITOR_ROW_H}
              fill="transparent"
              onMouseEnter={() => hoverFieldRow(SAVE_FOCUS_INDEX)}
            />
            <ActionButton
              x={contentX}
              y={rowY + (EDITOR_ROW_H - 48) / 2}
              width={saveBtnW}
              height={48}
              label="Save"
              isHighlighted={
                focusArea === "fields" && focusIndex === SAVE_FOCUS_INDEX
              }
              onPress={() => void commitSave()}
            />
          </React.Fragment>
        );
      })}

      {showScrollbar && (
        <>
          <Rect
            x={contentX + listW + 8}
            y={EDITOR_LIST_TOP}
            width={4}
            height={EDITOR_VIEWPORT_H}
            fill={COLORS.gray[700]}
          />
          <Rect
            x={contentX + listW + 8}
            y={scrollbarThumbY}
            width={4}
            height={scrollbarThumbHeight}
            fill={COLORS.gray[500]}
          />
        </>
      )}
    </HeaderLayout>
  );
}
