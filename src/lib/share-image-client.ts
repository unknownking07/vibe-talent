/** A small per-tab cache so hover, preview, copy, and download share one PNG. */
const images = new Map<string, { image: Promise<Blob>; fetchedAt: number }>();
const MAX_IMAGES = 6;
const IMAGE_TTL_MS = 5 * 60 * 1000;

export function getShareImage(url: string): Promise<Blob> {
  const cached = images.get(url);
  if (cached && Date.now() - cached.fetchedAt < IMAGE_TTL_MS) return cached.image;

  const image = fetch(url)
    .then((response) => {
      if (!response.ok) throw new Error(`Share image HTTP ${response.status}`);
      return response.blob();
    })
    .catch((error) => {
      if (images.get(url)?.image === image) images.delete(url);
      throw error;
    });
  images.set(url, { image, fetchedAt: Date.now() });
  if (images.size > MAX_IMAGES) images.delete(images.keys().next().value!);
  return image;
}

export function prewarmShareImage(url: string): void {
  void getShareImage(url).catch(() => {});
}
