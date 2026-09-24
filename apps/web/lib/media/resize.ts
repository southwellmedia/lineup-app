/** Longest edge for site photos: sharp on retina screens, small enough to load fast. */
export const MAX_EDGE = 2000;

/** Fits width × height inside a square of `max`, keeping the aspect ratio. */
export function fitWithin(width: number, height: number, max = MAX_EDGE) {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/**
 * Re-encodes a photo in the browser before upload: shrinks it to MAX_EDGE
 * and drops its metadata (phone photos carry GPS location in EXIF), since
 * drawing to a canvas keeps only the pixels.
 */
export async function preparePhoto(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const { width, height } = fitWithin(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser can't process images.");
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Couldn't process that image."))),
      "image/jpeg",
      0.86,
    ),
  );
}
