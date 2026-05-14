import type { RichTrailer } from "./richGameDetails";

export function richTrailerWatchUrl(trailer: RichTrailer): string {
  const id = trailer.youtubeId.trim();
  return `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`;
}
