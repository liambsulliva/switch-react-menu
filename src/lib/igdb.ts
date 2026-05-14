
export type IgdbTrailer = {
  name: string;
  youtubeId: string;
};

export type IgdbGameDetails = {
  name: string;
  summary: string | null;
  firstReleaseDate: number | null;
  coverUrl: string | null;
  trailers: IgdbTrailer[];
};

export function formatIgdbReleaseDate(ts: number | null): string {
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
