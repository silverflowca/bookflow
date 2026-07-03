export function getExternalEmbedUrl(url?: string | null): string | null {
  if (!url) return null;

  const youtube = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (youtube) return `https://www.youtube.com/embed/${youtube[1]}?rel=0&modestbranding=1`;

  const vimeo = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}?dnt=1`;

  return null;
}
