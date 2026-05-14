export type RichTrailer = {
  name: string;
  youtubeId: string;
};

export type RichGameDetails = {
  name: string;
  summary: string | null;
  firstReleaseDate: number | null;
  coverUrl: string | null;
  backgroundUrl: string | null;
  trailers: RichTrailer[];
};

export function formatRichReleaseDate(ts: number | null): string {
  if (ts == null) return "";
  try {
    return new Date(ts * 1000).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}
