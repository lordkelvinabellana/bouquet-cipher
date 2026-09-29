"use client";
/**
 * Reading QR codes in the browser: from the camera, or from a saved picture (for when
 * the bouquet arrived on the same phone you'd scan it with). Uses the built-in
 * BarcodeDetector where it exists, and jsQR (loaded only when needed) everywhere else.
 */

interface Detector {
  detect(source: ImageBitmapSource): Promise<Array<{ rawValue: string }>>;
}

let detectorPromise: Promise<Detector | null> | null = null;

function nativeDetector(): Promise<Detector | null> {
  if (!detectorPromise) {
    detectorPromise = (async () => {
      const BD = (globalThis as unknown as { BarcodeDetector?: { new (o: { formats: string[] }): Detector; getSupportedFormats?: () => Promise<string[]> } })
        .BarcodeDetector;
      if (!BD) return null;
      try {
        const formats = (await BD.getSupportedFormats?.()) ?? ["qr_code"];
        return formats.includes("qr_code") ? new BD({ formats: ["qr_code"] }) : null;
      } catch {
        return null;
      }
    })();
  }
  return detectorPromise;
}

/** Decode the first QR code in an image, or null. */
export async function decodeQr(img: ImageData): Promise<string | null> {
  const native = await nativeDetector();
  if (native) {
    try {
      const found = await native.detect(img);
      if (found[0]?.rawValue) return found[0].rawValue;
    } catch {
      // fall through to jsQR
    }
  }
  const { default: jsQR } = await import("jsqr");
  return jsQR(img.data, img.width, img.height, { inversionAttempts: "attemptBoth" })?.data ?? null;
}

function pixels(source: CanvasImageSource, w: number, h: number, maxSide: number): ImageData {
  const s = Math.min(1, maxSide / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(w * s));
  canvas.height = Math.max(1, Math.round(h * s));
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

/** Find a QR code in a picture file, trying a few sizes (big photos, small screenshots). */
export async function decodeQrFromFile(file: Blob): Promise<string | null> {
  const bitmap = await createImageBitmap(file);
  try {
    for (const maxSide of [1600, 2600, 900]) {
      const found = await decodeQr(pixels(bitmap, bitmap.width, bitmap.height, maxSide));
      if (found) return found;
    }
    return null;
  } finally {
    bitmap.close();
  }
}

export type CameraError = "insecure" | "unavailable" | "denied" | "failed";

/**
 * Start the camera in `video` and look for a QR code a few times a second. Calls
 * `onFound` once with the code's text. Returns a function that stops the camera.
 */
export function scanWithCamera(video: HTMLVideoElement, onFound: (text: string) => void, onError: (e: CameraError) => void): () => void {
  let stopped = false;
  let stream: MediaStream | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const stop = () => {
    stopped = true;
    clearTimeout(timer);
    stream?.getTracks().forEach((t) => t.stop());
    video.srcObject = null;
  };

  if (!window.isSecureContext) {
    onError("insecure");
    return stop;
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    onError("unavailable");
    return stop;
  }

  const tick = async () => {
    if (stopped) return;
    if (video.readyState >= 2 && video.videoWidth > 0) {
      const found = await decodeQr(pixels(video, video.videoWidth, video.videoHeight, 900)).catch(() => null);
      if (found && !stopped) {
        stop();
        onFound(found);
        return;
      }
    }
    timer = setTimeout(tick, 220);
  };

  navigator.mediaDevices
    .getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false })
    .then(async (s) => {
      if (stopped) {
        s.getTracks().forEach((t) => t.stop());
        return;
      }
      stream = s;
      video.srcObject = s;
      video.setAttribute("playsinline", "true");
      await video.play().catch(() => {});
      tick();
    })
    .catch((err: DOMException) => onError(err?.name === "NotAllowedError" || err?.name === "SecurityError" ? "denied" : err?.name === "NotFoundError" ? "unavailable" : "failed"));

  return stop;
}
