/**
 * Project image processing: produce a 16:9 JPEG that letterboxes the source
 * image against a blurred copy of itself instead of cropping content out.
 *
 * The output canvas is fixed at 1600x900 and capped at JPEG q80 so storage
 * stays sane. The foreground image is never upscaled — small thumbnails
 * appear at native size against the blurred backdrop.
 */

export const TARGET_WIDTH = 1600;
export const TARGET_HEIGHT = 900;
export const TARGET_ASPECT = TARGET_WIDTH / TARGET_HEIGHT; // 16:9
export const JPEG_QUALITY = 0.8;

export type Box = { x: number; y: number; width: number; height: number };

/**
 * Compute the foreground (contain) placement: scale to fit inside 16:9
 * without cropping, never upscaling beyond the source's native size.
 */
export function computeContainBox(
  srcW: number,
  srcH: number,
  targetW = TARGET_WIDTH,
  targetH = TARGET_HEIGHT,
): Box {
  if (srcW <= 0 || srcH <= 0) return { x: 0, y: 0, width: 0, height: 0 };
  const scale = Math.min(targetW / srcW, targetH / srcH, 1);
  const width = srcW * scale;
  const height = srcH * scale;
  return {
    x: (targetW - width) / 2,
    y: (targetH - height) / 2,
    width,
    height,
  };
}

/**
 * Compute the backdrop (cover) placement: scale to fill 16:9 entirely.
 * May upscale; that's fine because the backdrop is blurred.
 */
export function computeCoverBox(
  srcW: number,
  srcH: number,
  targetW = TARGET_WIDTH,
  targetH = TARGET_HEIGHT,
): Box {
  if (srcW <= 0 || srcH <= 0) return { x: 0, y: 0, width: targetW, height: targetH };
  const scale = Math.max(targetW / srcW, targetH / srcH);
  const width = srcW * scale;
  const height = srcH * scale;
  return {
    x: (targetW - width) / 2,
    y: (targetH - height) / 2,
    width,
    height,
  };
}

async function loadBitmap(file: Blob): Promise<{
  bitmap: ImageBitmap | HTMLImageElement;
  width: number;
  height: number;
  release: () => void;
}> {
  // Prefer createImageBitmap — faster and decodes off-thread on most browsers.
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(file);
    return {
      bitmap,
      width: bitmap.width,
      height: bitmap.height,
      release: () => bitmap.close(),
    };
  }
  // Fallback for environments without createImageBitmap (older Safari, jsdom).
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Failed to load image"));
      el.src = url;
    });
    return {
      bitmap: img,
      width: img.naturalWidth,
      height: img.naturalHeight,
      release: () => URL.revokeObjectURL(url),
    };
  } catch (err) {
    URL.revokeObjectURL(url);
    throw err;
  }
}

/**
 * Process a user-supplied image into a 16:9 JPEG suitable for upload.
 * The foreground is letterboxed (no content cropped). Padding is filled
 * with a darkened, blurred copy of the source so the result still looks
 * intentional regardless of the source aspect ratio.
 *
 * Throws on unsupported source files or canvas failure — callers should
 * catch and surface a friendly error.
 */
export async function processProjectImage(
  file: Blob,
  options?: { quality?: number; targetWidth?: number; targetHeight?: number },
): Promise<Blob> {
  const targetW = options?.targetWidth ?? TARGET_WIDTH;
  const targetH = options?.targetHeight ?? TARGET_HEIGHT;
  const quality = options?.quality ?? JPEG_QUALITY;

  const { bitmap, width, height, release } = await loadBitmap(file);

  try {
    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context unavailable");

    // Backdrop: cover-blurred copy of the source. Filter support is universal
    // in modern browsers; if it's missing the draw still works, just unblurred.
    const cover = computeCoverBox(width, height, targetW, targetH);
    ctx.filter = "blur(40px)";
    ctx.drawImage(bitmap as CanvasImageSource, cover.x, cover.y, cover.width, cover.height);
    ctx.filter = "none";

    // Dim the backdrop so the foreground reads cleanly against it.
    ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
    ctx.fillRect(0, 0, targetW, targetH);

    // Foreground: letterboxed source at native size or smaller.
    const contain = computeContainBox(width, height, targetW, targetH);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(
      bitmap as CanvasImageSource,
      contain.x,
      contain.y,
      contain.width,
      contain.height,
    );

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Canvas toBlob returned null"));
        },
        "image/jpeg",
        quality,
      );
    });
  } finally {
    release();
  }
}
