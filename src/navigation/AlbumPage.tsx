import React, {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Image, Rect, Text } from "react-tela";
import {
  Button,
  CapsAlbumFileContents,
  CapsAlbumStorage,
} from "@nx.js/constants";
import { Modal, type ModalAction } from "../components/Modal";
import { HEADER_LAYOUT, HeaderLayout } from "../layouts/HeaderLayout";
import { COLORS } from "../lib/colors";
import { ImagePreview } from "./ImagePreview";

const GRID_COLS = 5;

/** 16:9 matches Switch screenshots aspect ratio (1280x720). */
const ALBUM_PREVIEW_ASPECT = 16 / 9;

const VIEWPORT_HEIGHT =
  screen.height - HEADER_LAYOUT.contentTop - HEADER_LAYOUT.footerHeight;
const PANEL_WIDTH = screen.width - HEADER_LAYOUT.paddingX * 2;
const PANEL_X = HEADER_LAYOUT.paddingX;

const HOLD_REPEAT_INITIAL_DELAY_MS = 250;
const HOLD_REPEAT_INTERVAL_MS = 110;

interface LoadedThumb {
  readonly src: string | null;
  readonly file: Switch.AlbumFile;
}

function useAlbumThumbnails(): {
  photos: LoadedThumb[];
  ready: boolean;
  removePhotoAt: (index: number) => boolean;
} {
  const [photos, setPhotos] = useState<LoadedThumb[]>([]);
  const [ready, setReady] = useState(false);
  const urlsRef = useRef<string[]>([]);
  const albumRef = useRef<Switch.Album | null>(null);
  const photosRef = useRef<LoadedThumb[]>([]);
  photosRef.current = photos;

  useEffect(() => {
    let cancelled = false;
    const album = new Switch.Album(CapsAlbumStorage.Sd);
    albumRef.current = album;
    const files = Array.from(album);

    (async () => {
      const next: LoadedThumb[] = [];
      try {
        for (const file of files) {
          const buf = await file.thumbnail();
          if (cancelled) return;
          if (buf.byteLength === 0) {
            next.push({ src: null, file });
            continue;
          }
          const src = URL.createObjectURL(
            new Blob([buf], { type: file.type || "image/png" }),
          );
          urlsRef.current.push(src);
          next.push({ src, file });
        }
        if (!cancelled) setPhotos(next);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();

    return () => {
      cancelled = true;
      albumRef.current = null;
      for (const u of urlsRef.current) URL.revokeObjectURL(u);
      urlsRef.current = [];
    };
  }, []);

  const removePhotoAt = useCallback((index: number): boolean => {
    const album = albumRef.current;
    if (!album) return false;
    const entry = photosRef.current[index];
    if (!entry) return false;
    if (!album.delete(entry.file)) return false;
    if (entry.src) {
      URL.revokeObjectURL(entry.src);
      const urlIdx = urlsRef.current.indexOf(entry.src);
      if (urlIdx >= 0) urlsRef.current.splice(urlIdx, 1);
    }
    setPhotos((prev) => prev.filter((_, i) => i !== index));
    return true;
  }, []);

  return { photos, ready, removePhotoAt };
}

interface ButtonState {
  upPressed: boolean;
  downPressed: boolean;
  leftPressed: boolean;
  rightPressed: boolean;
  aPressed: boolean;
  bPressed: boolean;
  minusPressed: boolean;
  xPressed: boolean;
}

interface HoldRepeatState {
  up: number | null;
  down: number | null;
  left: number | null;
  right: number | null;
}

interface AlbumGridLayout {
  readonly gutter: number;
  readonly cellW: number;
  readonly rowH: number;
  readonly rowStride: number;
  readonly totalRows: number;
  readonly visibleRows: number;
  readonly maxScrollRow: number;
}

function computeGridLayout(photoCount: number): AlbumGridLayout | null {
  if (photoCount === 0) return null;

  const gutter = Math.max(10, Math.min(20, Math.floor(PANEL_WIDTH * 0.016)));
  const totalGutter = (GRID_COLS - 1) * gutter;
  const cellW = (PANEL_WIDTH - totalGutter) / GRID_COLS;
  const rowH = cellW / ALBUM_PREVIEW_ASPECT;
  const rowStride = rowH + gutter;
  const totalRows = Math.ceil(photoCount / GRID_COLS);
  const visibleRows = Math.max(
    1,
    Math.floor((VIEWPORT_HEIGHT + gutter) / rowStride),
  );
  const maxScrollRow = Math.max(0, totalRows - visibleRows);

  return {
    gutter,
    cellW,
    rowH,
    rowStride,
    totalRows,
    visibleRows,
    maxScrollRow,
  };
}

/** No tile highlighted (e.g. pointer left the grid after hover). */
const HIGHLIGHT_NONE = -1;

function isAlbumScreenshot(file: Switch.AlbumFile): boolean {
  return (
    file.content === CapsAlbumFileContents.ScreenShot ||
    file.content === CapsAlbumFileContents.ExtraScreenShot
  );
}

type AlbumFocusArea = "grid" | "close";

function tryMoveHighlight(
  index: number,
  dCol: number,
  dRow: number,
  photoCount: number,
): number {
  if (photoCount === 0) return HIGHLIGHT_NONE;
  const row = Math.floor(index / GRID_COLS);
  const col = index % GRID_COLS;
  const nc = col + dCol;
  const nr = row + dRow;
  if (nc < 0 || nc >= GRID_COLS) return index;
  if (nr < 0) return index;
  const next = nr * GRID_COLS + nc;
  if (next >= photoCount) return index;
  return next;
}

interface AlbumPageProps {
  onClose: () => void;
}

export function AlbumPage({ onClose }: AlbumPageProps) {
  const { photos, ready, removePhotoAt } = useAlbumThumbnails();
  const [scrollRowOffset, setScrollRowOffset] = useState(0);
  const [highlightedIndex, setHighlightedIndex] = useState(HIGHLIGHT_NONE);
  const [focusArea, setFocusArea] = useState<AlbumFocusArea>("grid");
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const previewIndexRef = useRef<number | null>(null);
  const [previewFullSrc, setPreviewFullSrc] = useState<string | null>(null);
  const [previewFullLoading, setPreviewFullLoading] = useState(false);
  const previewFullUrlRef = useRef<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const pendingDeleteIndexRef = useRef<number | null>(null);
  const deleteConfirmOpenRef = useRef(false);
  const focusAreaRef = useRef<AlbumFocusArea>("grid");
  const highlightedIndexRef = useRef(HIGHLIGHT_NONE);
  const [buttonState, setButtonState] = useState<ButtonState>({
    upPressed: false,
    downPressed: false,
    leftPressed: false,
    rightPressed: false,
    aPressed: false,
    bPressed: false,
    minusPressed: false,
    xPressed: false,
  });
  const holdRepeatRef = useRef<HoldRepeatState>({
    up: null,
    down: null,
    left: null,
    right: null,
  });
  const gamepadArmedRef = useRef(false);
  const photosRef = useRef(photos);
  photosRef.current = photos;

  useEffect(() => {
    deleteConfirmOpenRef.current = deleteConfirmOpen;
  }, [deleteConfirmOpen]);

  useEffect(() => {
    focusAreaRef.current = focusArea;
  }, [focusArea]);

  useEffect(() => {
    highlightedIndexRef.current = highlightedIndex;
  }, [highlightedIndex]);

  useEffect(() => {
    previewIndexRef.current = previewIndex;
  }, [previewIndex]);

  /** After closing the delete dialog, ignore inputs until released */
  useEffect(() => {
    if (!deleteConfirmOpen) {
      gamepadArmedRef.current = false;
    }
  }, [deleteConfirmOpen]);
  useEffect(() => {
    if (previewIndex === null) {
      gamepadArmedRef.current = false;
    }
  }, [previewIndex]);

  useEffect(() => {
    if (previewIndex === null) {
      if (previewFullUrlRef.current) {
        URL.revokeObjectURL(previewFullUrlRef.current);
        previewFullUrlRef.current = null;
      }
      setPreviewFullSrc(null);
      setPreviewFullLoading(false);
      return;
    }

    const entry = photos[previewIndex];
    if (!entry) {
      setPreviewFullSrc(null);
      setPreviewFullLoading(false);
      return;
    }

    const { file } = entry;

    if (previewFullUrlRef.current) {
      URL.revokeObjectURL(previewFullUrlRef.current);
      previewFullUrlRef.current = null;
    }
    setPreviewFullSrc(null);

    if (!isAlbumScreenshot(file)) {
      setPreviewFullLoading(false);
      return;
    }

    setPreviewFullLoading(true);
    let cancelled = false;

    (async () => {
      try {
        const buf = await file.arrayBuffer();
        if (cancelled) return;
        if (buf.byteLength === 0) {
          setPreviewFullSrc(null);
          setPreviewFullLoading(false);
          return;
        }
        const url = URL.createObjectURL(
          new Blob([buf], { type: file.type || "image/jpeg" }),
        );
        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }
        previewFullUrlRef.current = url;
        setPreviewFullSrc(url);
      } catch {
        if (!cancelled) setPreviewFullSrc(null);
      } finally {
        if (!cancelled) setPreviewFullLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [previewIndex, photos]);

  const stepPreview = useCallback((delta: number) => {
    const pi = previewIndexRef.current;
    if (pi === null) return;
    const len = photosRef.current.length;
    if (len === 0) return;
    const next = Math.max(0, Math.min(len - 1, pi + delta));
    if (next === pi) return;
    setPreviewIndex(next);
    setHighlightedIndex(next);
  }, []);

  const openDeleteConfirm = useCallback(() => {
    if (deleteConfirmOpenRef.current) return;
    const fromPreview = previewIndexRef.current;
    let idx: number | null = null;
    if (fromPreview !== null) {
      idx = fromPreview;
    } else if (
      focusAreaRef.current === "grid" &&
      highlightedIndexRef.current !== HIGHLIGHT_NONE
    ) {
      idx = highlightedIndexRef.current;
    }
    if (idx === null) return;
    const list = photosRef.current;
    if (!list[idx]) return;
    pendingDeleteIndexRef.current = idx;
    setDeleteConfirmOpen(true);
  }, []);

  const closeDeleteConfirm = useCallback(() => {
    pendingDeleteIndexRef.current = null;
    setDeleteConfirmOpen(false);
  }, []);

  const performPreviewDelete = useCallback(() => {
    const pi = pendingDeleteIndexRef.current;
    if (pi === null) return;
    const hadPreview = previewIndexRef.current !== null;
    const oldLen = photosRef.current.length;
    if (oldLen === 0) return;
    if (!removePhotoAt(pi)) return;
    pendingDeleteIndexRef.current = null;
    setDeleteConfirmOpen(false);
    const newLen = oldLen - 1;
    if (newLen === 0) {
      setPreviewIndex(null);
      setHighlightedIndex(HIGHLIGHT_NONE);
    } else {
      const next = pi < newLen ? pi : newLen - 1;
      if (hadPreview) setPreviewIndex(next);
      else setPreviewIndex(null);
      setHighlightedIndex(next);
    }
  }, [removePhotoAt]);

  const deleteModalActions = useMemo(
    (): ModalAction[] => [
      {
        id: "cancel",
        label: "Cancel",
        onPress: closeDeleteConfirm,
      },
      {
        id: "delete",
        label: "Delete",
        variant: "destructive",
        onPress: () => {
          performPreviewDelete();
        },
      },
    ],
    [closeDeleteConfirm, performPreviewDelete],
  );

  const layout = useMemo(
    () => computeGridLayout(photos.length),
    [photos.length],
  );

  useEffect(() => {
    if (!layout) return;
    setScrollRowOffset((prev) => Math.min(prev, layout.maxScrollRow));
  }, [layout]);

  useEffect(() => {
    if (photos.length === 0) {
      setHighlightedIndex(HIGHLIGHT_NONE);
      return;
    }
    setHighlightedIndex((h) => {
      if (h === HIGHLIGHT_NONE) return 0;
      return Math.min(h, photos.length - 1);
    });
  }, [photos.length]);

  useEffect(() => {
    if (!layout || highlightedIndex === HIGHLIGHT_NONE) return;
    const row = Math.floor(highlightedIndex / GRID_COLS);
    setScrollRowOffset((off) => {
      if (row < off) return row;
      if (row >= off + layout.visibleRows) {
        return Math.max(0, row - layout.visibleRows + 1);
      }
      return off;
    });
  }, [highlightedIndex, layout]);

  useEffect(() => {
    let rafId: number;

    const canRepeat = (startedAt: number | null, now: number): boolean => {
      if (startedAt === null) return true;
      const heldFor = now - startedAt;
      if (heldFor < HOLD_REPEAT_INITIAL_DELAY_MS) return false;
      return heldFor % HOLD_REPEAT_INTERVAL_MS < 16;
    };

    const moveHighlight = (dCol: number, dRow: number) => {
      if (photos.length === 0) return;
      setHighlightedIndex((prev) => {
        const base = prev === HIGHLIGHT_NONE ? 0 : prev;
        return tryMoveHighlight(base, dCol, dRow, photos.length);
      });
    };

    const loop = () => {
      const now = Date.now();
      const gamepad = navigator.getGamepads()[0];
      if (!gamepad) {
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
      const isB = gamepad.buttons[Button.B].pressed;
      const isMinus = gamepad.buttons[Button.Minus].pressed;
      const isX = gamepad.buttons[Button.X].pressed;

      if (deleteConfirmOpenRef.current) {
        rafId = requestAnimationFrame(loop);
        return;
      }

      if (previewIndexRef.current !== null) {
        rafId = requestAnimationFrame(loop);
        return;
      }

      if (!gamepadArmedRef.current) {
        if (
          !isUp &&
          !isDown &&
          !isLeft &&
          !isRight &&
          !isA &&
          !isB &&
          !isMinus &&
          !isX
        ) {
          gamepadArmedRef.current = true;
          holdRepeatRef.current = {
            up: null,
            down: null,
            left: null,
            right: null,
          };
        }
        rafId = requestAnimationFrame(loop);
        return;
      }

      if (focusArea === "close") {
        if (isUp && !buttonState.upPressed) {
          setButtonState((s) => ({ ...s, upPressed: true }));
        } else if (!isUp && buttonState.upPressed) {
          setButtonState((s) => ({ ...s, upPressed: false }));
        }

        if (isDown && !buttonState.downPressed) {
          setButtonState((s) => ({ ...s, downPressed: true }));
          holdRepeatRef.current.down = now;
          setFocusArea("grid");
          setHighlightedIndex((h) => (h === HIGHLIGHT_NONE ? 0 : h));
        } else if (!isDown && buttonState.downPressed) {
          setButtonState((s) => ({ ...s, downPressed: false }));
          holdRepeatRef.current.down = null;
        }

        if (isLeft && !buttonState.leftPressed) {
          setButtonState((s) => ({ ...s, leftPressed: true }));
          holdRepeatRef.current.left = now;
          setFocusArea("grid");
        } else if (
          isLeft &&
          buttonState.leftPressed &&
          canRepeat(holdRepeatRef.current.left, now)
        ) {
          /* no repeat navigation while header focused */
        } else if (!isLeft && buttonState.leftPressed) {
          setButtonState((s) => ({ ...s, leftPressed: false }));
          holdRepeatRef.current.left = null;
        }

        if (isRight && !buttonState.rightPressed) {
          setButtonState((s) => ({ ...s, rightPressed: true }));
        } else if (!isRight && buttonState.rightPressed) {
          setButtonState((s) => ({ ...s, rightPressed: false }));
        }

        if (isA && !buttonState.aPressed) {
          setButtonState((s) => ({ ...s, aPressed: true }));
          onClose();
        } else if (!isA && buttonState.aPressed) {
          setButtonState((s) => ({ ...s, aPressed: false }));
        }
      } else if (photos.length > 0) {
        const atFirstRow =
          highlightedIndex === HIGHLIGHT_NONE || highlightedIndex < GRID_COLS;

        if (isUp && !buttonState.upPressed) {
          setButtonState((s) => ({ ...s, upPressed: true }));
          holdRepeatRef.current.up = now;
          if (atFirstRow) {
            setFocusArea("close");
          } else {
            moveHighlight(0, -1);
          }
        } else if (
          isUp &&
          buttonState.upPressed &&
          canRepeat(holdRepeatRef.current.up, now)
        ) {
          if (!atFirstRow) moveHighlight(0, -1);
        } else if (!isUp && buttonState.upPressed) {
          setButtonState((s) => ({ ...s, upPressed: false }));
          holdRepeatRef.current.up = null;
        }

        if (isDown && !buttonState.downPressed) {
          setButtonState((s) => ({ ...s, downPressed: true }));
          holdRepeatRef.current.down = now;
          moveHighlight(0, 1);
        } else if (
          isDown &&
          buttonState.downPressed &&
          canRepeat(holdRepeatRef.current.down, now)
        ) {
          moveHighlight(0, 1);
        } else if (!isDown && buttonState.downPressed) {
          setButtonState((s) => ({ ...s, downPressed: false }));
          holdRepeatRef.current.down = null;
        }

        if (isLeft && !buttonState.leftPressed) {
          setButtonState((s) => ({ ...s, leftPressed: true }));
          holdRepeatRef.current.left = now;
          moveHighlight(-1, 0);
        } else if (
          isLeft &&
          buttonState.leftPressed &&
          canRepeat(holdRepeatRef.current.left, now)
        ) {
          moveHighlight(-1, 0);
        } else if (!isLeft && buttonState.leftPressed) {
          setButtonState((s) => ({ ...s, leftPressed: false }));
          holdRepeatRef.current.left = null;
        }

        if (isRight && !buttonState.rightPressed) {
          setButtonState((s) => ({ ...s, rightPressed: true }));
          holdRepeatRef.current.right = now;
          moveHighlight(1, 0);
        } else if (
          isRight &&
          buttonState.rightPressed &&
          canRepeat(holdRepeatRef.current.right, now)
        ) {
          moveHighlight(1, 0);
        } else if (!isRight && buttonState.rightPressed) {
          setButtonState((s) => ({ ...s, rightPressed: false }));
          holdRepeatRef.current.right = null;
        }

        if (
          isA &&
          !buttonState.aPressed &&
          highlightedIndex !== HIGHLIGHT_NONE
        ) {
          const thumb = photos[highlightedIndex];
          if (thumb && (thumb.src || isAlbumScreenshot(thumb.file))) {
            setButtonState((s) => ({ ...s, aPressed: true }));
            setPreviewIndex(highlightedIndex);
          }
        } else if (!isA && buttonState.aPressed) {
          setButtonState((s) => ({ ...s, aPressed: false }));
        }

        if (
          isX &&
          !buttonState.xPressed &&
          focusArea === "grid" &&
          highlightedIndex !== HIGHLIGHT_NONE
        ) {
          setButtonState((s) => ({ ...s, xPressed: true }));
          openDeleteConfirm();
        } else if (!isX && buttonState.xPressed) {
          setButtonState((s) => ({ ...s, xPressed: false }));
        }
      } else if (focusArea === "grid" && photos.length === 0) {
        if (isUp && !buttonState.upPressed) {
          setButtonState((s) => ({ ...s, upPressed: true }));
          setFocusArea("close");
        } else if (!isUp && buttonState.upPressed) {
          setButtonState((s) => ({ ...s, upPressed: false }));
        }
        if (isDown && !buttonState.downPressed) {
          setButtonState((s) => ({ ...s, downPressed: true }));
        } else if (!isDown && buttonState.downPressed) {
          setButtonState((s) => ({ ...s, downPressed: false }));
        }
      }

      if (isB && !buttonState.bPressed) {
        setButtonState((s) => ({ ...s, bPressed: true }));
        onClose();
      } else if (!isB && buttonState.bPressed) {
        setButtonState((s) => ({ ...s, bPressed: false }));
      }

      if (isMinus && !buttonState.minusPressed) {
        setButtonState((s) => ({ ...s, minusPressed: true }));
        onClose();
      } else if (!isMinus && buttonState.minusPressed) {
        setButtonState((s) => ({ ...s, minusPressed: false }));
      }

      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [
    buttonState,
    focusArea,
    highlightedIndex,
    layout,
    onClose,
    openDeleteConfirm,
    photos,
  ]);

  const contentTop = HEADER_LAYOUT.contentTop;
  const showScrollbar = layout !== null && layout.maxScrollRow > 0;
  const scrollbarTrackH = VIEWPORT_HEIGHT;
  const scrollbarThumbH = layout
    ? Math.max(
        24,
        (layout.visibleRows / Math.max(1, layout.totalRows)) * scrollbarTrackH,
      )
    : 24;
  const scrollbarThumbY =
    layout && layout.maxScrollRow > 0
      ? contentTop +
        (scrollRowOffset / layout.maxScrollRow) *
          (scrollbarTrackH - scrollbarThumbH)
      : contentTop;

  return (
    <HeaderLayout
      title="Album"
      rightActionLabel="Close"
      rightActionActive={focusArea === "close"}
      onRightActionTouchStart={onClose}
      onRightActionMouseEnter={() => setFocusArea("close")}
      onRightActionMouseLeave={() => setFocusArea("grid")}
      footerHint="A  View      B / −  Back      X  Delete"
    >
      {!ready && (
        <Text
          x={screen.width / 2}
          y={HEADER_LAYOUT.contentTop + 120}
          fill={COLORS.gray[600]}
          fontSize={26}
          fontFamily="SourceSansPro-Regular"
          textAlign="center"
          textBaseline="middle"
        >
          Loading…
        </Text>
      )}

      {ready && photos.length === 0 && (
        <Text
          x={screen.width / 2}
          y={HEADER_LAYOUT.contentTop + 120}
          fill={COLORS.gray[600]}
          fontSize={26}
          fontFamily="SourceSansPro-Regular"
          textAlign="center"
          textBaseline="middle"
        >
          No photos in this album.
        </Text>
      )}

      {layout &&
        photos.map((photo, index) => {
          const row = Math.floor(index / GRID_COLS);
          const col = index % GRID_COLS;
          if (
            row < scrollRowOffset ||
            row >= scrollRowOffset + layout.visibleRows
          ) {
            return null;
          }

          const { gutter, cellW, rowH, rowStride } = layout;
          const x = PANEL_X + col * (cellW + gutter);
          const y = contentTop + (row - scrollRowOffset) * rowStride;

          const isHighlighted =
            focusArea === "grid" &&
            highlightedIndex !== HIGHLIGHT_NONE &&
            index === highlightedIndex;

          return (
            <Fragment key={`${photo.file.name}-${index}`}>
              <Rect
                x={x - 1}
                y={y - 1}
                width={cellW + 2}
                height={rowH + 2}
                fill={COLORS.gray[800]}
                borderRadius={4}
              />
              {isHighlighted && (
                <Rect
                  x={x - 5}
                  y={y - 5}
                  width={cellW + 10}
                  height={rowH + 10}
                  fill="none"
                  stroke={COLORS.gray[0]}
                  lineWidth={5}
                />
              )}
              {photo.src ? (
                <Image
                  src={photo.src}
                  x={x}
                  y={y}
                  width={cellW}
                  height={rowH}
                  onMouseEnter={() => {
                    setFocusArea("grid");
                    setHighlightedIndex(index);
                  }}
                  onMouseLeave={() =>
                    setHighlightedIndex((h) =>
                      h === index ? HIGHLIGHT_NONE : h,
                    )
                  }
                  onTouchStart={() => {
                    setFocusArea("grid");
                    setHighlightedIndex(index);
                  }}
                  onClick={() => {
                    setFocusArea("grid");
                    setHighlightedIndex(index);
                    setPreviewIndex(index);
                  }}
                />
              ) : (
                <Rect
                  x={x}
                  y={y}
                  width={cellW}
                  height={rowH}
                  fill={COLORS.gray[700]}
                  borderRadius={3}
                  onMouseEnter={() => {
                    setFocusArea("grid");
                    setHighlightedIndex(index);
                  }}
                  onMouseLeave={() =>
                    setHighlightedIndex((h) =>
                      h === index ? HIGHLIGHT_NONE : h,
                    )
                  }
                  onTouchStart={() => {
                    setFocusArea("grid");
                    setHighlightedIndex(index);
                  }}
                  onClick={() => {
                    setFocusArea("grid");
                    setHighlightedIndex(index);
                    if (isAlbumScreenshot(photo.file)) {
                      setPreviewIndex(index);
                    }
                  }}
                />
              )}
            </Fragment>
          );
        })}

      {showScrollbar && (
        <>
          <Rect
            x={PANEL_X + PANEL_WIDTH + 8}
            y={contentTop}
            width={4}
            height={scrollbarTrackH}
            fill={COLORS.gray[700]}
          />
          <Rect
            x={PANEL_X + PANEL_WIDTH + 8}
            y={scrollbarThumbY}
            width={4}
            height={scrollbarThumbH}
            fill={COLORS.gray[500]}
          />
        </>
      )}

      <ImagePreview
        visible={previewIndex !== null}
        src={previewFullSrc}
        placeholderSrc={
          previewIndex !== null ? (photos[previewIndex]?.src ?? null) : null
        }
        showLoadingHint={previewFullLoading}
        hasPrev={previewIndex !== null && previewIndex > 0}
        hasNext={previewIndex !== null && previewIndex < photos.length - 1}
        onStepPreview={stepPreview}
        onRequestDelete={openDeleteConfirm}
        onClose={() => setPreviewIndex(null)}
        suspendGamepad={deleteConfirmOpen}
      />

      <Modal
        visible={deleteConfirmOpen}
        title="Delete this picture?"
        description="This will permanently remove this file from your album. Are you sure?"
        onClose={closeDeleteConfirm}
        actions={deleteModalActions}
        initialActionIndex={0}
        maxPanelHeight={300}
        maxPanelWidth={720}
      />
    </HeaderLayout>
  );
}
