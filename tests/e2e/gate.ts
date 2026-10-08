import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { request, type FullConfig } from "@playwright/test";

/** The gate's cookie, shared by every test (the site may be a private garden). */
export const GATE_STATE = ".playwright/gate.json";
/** The localStorage key that says the music was switched off (lib/music.ts). */
export const MUSIC_OFF = "bc-music-off";

/** Open the private garden's gate once, if it has one, and keep the cookie for the tests. */
export default async function openGate(config: FullConfig) {
  if (existsSync(".env.local")) process.loadEnvFile(".env.local");
  mkdirSync(".playwright", { recursive: true });
  const baseURL = config.projects[0].use.baseURL ?? "http://localhost:3000";
  const ctx = await request.newContext({ baseURL });
  if (process.env.SITE_PASSPHRASE || /^(1|on|true|yes)$/i.test(process.env.GATE_ANY_ANSWER ?? "")) {
    const res = await ctx.post("/api/gate", { data: { passphrase: process.env.SITE_PASSPHRASE || "the tests" } });
    if (!res.ok()) throw new Error(`Couldn't open the gate for the tests (${res.status()}).`);
  }
  const state = await ctx.storageState();
  await ctx.dispose();
  // the garden's music off, so bouquets open themselves without waiting for a tap
  // (garden.spec.ts tries the music on its own)
  const origin = new URL(baseURL).origin;
  writeFileSync(GATE_STATE, JSON.stringify({ ...state, origins: [{ origin, localStorage: [{ name: MUSIC_OFF, value: "1" }] }] }));
}
