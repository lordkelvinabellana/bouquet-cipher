"use client";

/** Photos are kept at most this many pixels on their long side: sharp on a phone, small to send. */
const LONG_SIDE = 1600;

/**
 * Shrink a photo in the browser to a JPEG before it's sent (a phone photo is often 5 MB
 * or more). Honours the camera's rotation, and drops the photo's location and camera
 * details along the way, since only the pixels are redrawn.
 */
export async function shrinkPhoto(file: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const k = Math.min(1, LONG_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * k);
  canvas.height = Math.round(bitmap.height * k);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas isn’t available.");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.84));
  canvas.width = canvas.height = 0;
  if (!blob) throw new Error("That photo couldn’t be read. Try another?");
  return blob;
}
