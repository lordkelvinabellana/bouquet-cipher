"use client";
import Link from "next/link";
import { AccountLink } from "@/components/AccountLink";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { parseCode } from "@/core/code";
import { decodeQrFromFile, scanWithCamera, type CameraError } from "@/decode/qrScan";
import styles from "./decode.module.css";

const CAMERA_MESSAGES: Record<CameraError, string> = {
  insecure: "The camera only works over a secure (https) connection. Upload the picture or type the code instead.",
  unavailable: "No camera was found. Upload the picture or type the code instead.",
  denied: "Camera access was blocked. You can allow it in your browser settings, or upload the picture instead.",
  failed: "The camera couldn't start. Upload the picture or type the code instead.",
};

export function DecodeEntry() {
  const router = useRouter();
  const video = useRef<HTMLVideoElement>(null);
  const stopCamera = useRef<(() => void) | null>(null);
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [typed, setTyped] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => () => stopCamera.current?.(), []);

  const open = (text: string, source: "camera" | "picture" | "typed") => {
    const code = parseCode(text);
    if (!code) {
      setMessage(
        source === "typed"
          ? "That doesn't look like a bouquet code. Codes look like K7M2Q-9XWPT."
          : "That QR code isn't from a bouquet. Try another picture or type the code.",
      );
      return false;
    }
    setMessage("Found it! Opening your bouquet…");
    router.push(`/b/${code}`);
    return true;
  };

  const startCamera = () => {
    if (!video.current) return;
    setMessage("");
    setScanning(true);
    stopCamera.current = scanWithCamera(
      video.current,
      (text) => {
        setScanning(false);
        open(text, "camera");
      },
      (err) => {
        setScanning(false);
        setMessage(CAMERA_MESSAGES[err]);
      },
    );
  };

  const cancelCamera = () => {
    stopCamera.current?.();
    stopCamera.current = null;
    setScanning(false);
  };

  const onPicture = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setMessage("Looking for the tag's QR code…");
    try {
      const text = await decodeQrFromFile(file);
      if (!text) setMessage("We couldn't find a QR code in that picture. Try a clearer one, or type the code from the tag.");
      else open(text, "picture");
    } catch {
      setMessage("That file couldn't be read as a picture.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className={styles.page}>
      <header className={styles.top}>
        <Link href="/" className={styles.brand}>
          Bouquet Cipher
        </Link>
        <span className={styles.links}>
          <Link href="/create" className={styles.link}>
            Create one instead
          </Link>
          <AccountLink />
        </span>
      </header>

      <h1 className={styles.title}>Decode a bouquet</h1>
      <p className={styles.lede}>Someone sent you flowers? Open them with the tag’s QR code, the picture itself, or the code.</p>

      <div className={styles.options}>
        <section className={styles.option} aria-labelledby="scan-title">
          <h2 id="scan-title">Scan the tag</h2>
          <p>Point your camera at the QR code on the bouquet’s gift tag.</p>
          <div className={`${styles.viewfinder} ${scanning ? styles.viewfinderOn : ""}`}>
            <video ref={video} muted playsInline aria-label="Camera preview" />
            {scanning ? <span className={styles.frame} aria-hidden /> : null}
          </div>
          {scanning ? (
            <button type="button" className={styles.ghost} onClick={cancelCamera}>
              Stop camera
            </button>
          ) : (
            <button type="button" className={styles.primary} onClick={startCamera}>
              Start camera
            </button>
          )}
        </section>

        <section className={styles.option} aria-labelledby="upload-title">
          <h2 id="upload-title">Use the picture</h2>
          <p>Got the bouquet picture on this phone? Choose it and we’ll read its tag.</p>
          <label className={`${styles.primary} ${busy ? styles.disabled : ""}`}>
            <input
              type="file"
              accept="image/*"
              className={styles.srOnly}
              disabled={busy}
              onChange={(e) => {
                onPicture(e.currentTarget.files?.[0]);
                e.currentTarget.value = "";
              }}
            />
            {busy ? "Reading…" : "Choose picture"}
          </label>
        </section>

        <section className={styles.option} aria-labelledby="code-title">
          <h2 id="code-title">Type the code</h2>
          <p>It’s on the tag, like K7M2Q-9XWPT. A pasted link works too.</p>
          <form
            className={styles.codeForm}
            onSubmit={(e) => {
              e.preventDefault();
              open(typed, "typed");
            }}
          >
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder="K7M2Q-9XWPT"
              aria-label="Bouquet code or link"
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              className={styles.codeInput}
            />
            <button type="submit" className={styles.primary} disabled={!typed.trim()}>
              Open
            </button>
          </form>
        </section>
      </div>

      <p className={styles.message} role="status" aria-live="polite">
        {message}
      </p>
    </main>
  );
}
