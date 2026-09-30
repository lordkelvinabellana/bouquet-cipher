"use client";
import { useEffect, useRef } from "react";
import type { EventName, EventProps } from "./events";

let session: string | null = null;

/** A random id for this browser tab, so one visit's steps can be followed. Not a person. */
export function sessionId(): string {
  if (session) return session;
  try {
    session = sessionStorage.getItem("bc-session");
  } catch {
    // storage blocked: a fresh id per page load is fine
  }
  if (!session) {
    session = Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => (b % 36).toString(36)).join("");
    try {
      sessionStorage.setItem("bc-session", session);
    } catch {
      // ignore
    }
  }
  return session;
}

/** People who've asked not to be tracked aren't. */
function optedOut(): boolean {
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  return nav.globalPrivacyControl === true || nav.doNotTrack === "1";
}

/** Count one event. Fire and forget: it never slows the page or throws. */
export function track(name: EventName, props?: EventProps, bouquet?: string) {
  if (typeof window === "undefined" || optedOut()) return;
  try {
    const body = JSON.stringify({ name, props, bouquet, session: sessionId() });
    const blob = new Blob([body], { type: "application/json" });
    if (!navigator.sendBeacon?.("/api/events", blob)) {
      fetch("/api/events", { method: "POST", body, headers: { "content-type": "application/json" }, keepalive: true }).catch(() => {});
    }
  } catch {
    // counting must never break the app
  }
}

/** Count an event once when the page (or screen) first shows. */
export function useTrackOnce(name: EventName, props?: EventProps, bouquet?: string) {
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    track(name, props, bouquet);
    // only the first render counts
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
