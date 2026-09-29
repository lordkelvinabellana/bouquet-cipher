"use client";
/**
 * Your signature: a private secret kept in this browser, and the wax seal it draws.
 * Every bouquet you send carries the same seal, so the people you send them to come to
 * know it. The seal is derived one way from the secret, so it can't be traced back.
 *
 * For now it lives on this device only (localStorage); with accounts it will move to
 * your profile so it follows you everywhere.
 */
import { useSyncExternalStore } from "react";
import { isCipherKey, newCipherKey, sealFromSecret } from "@/core/cipher";

const STORAGE_KEY = "bouquet-cipher:signature:v1";

let cached: number | null | undefined;

function readSeal(): number | null {
  if (cached !== undefined) return cached;
  try {
    let secret = localStorage.getItem(STORAGE_KEY);
    if (!isCipherKey(secret)) {
      secret = newCipherKey();
      localStorage.setItem(STORAGE_KEY, secret);
    }
    cached = sealFromSecret(secret);
  } catch {
    // storage blocked (private mode, settings): a seal for this visit only
    cached = sealFromSecret(newCipherKey());
  }
  return cached;
}

const subscribe = () => () => {};

/** This device's signature seal (null during server rendering). */
export function useSignatureSeal(): number | null {
  return useSyncExternalStore(subscribe, readSeal, () => null);
}
