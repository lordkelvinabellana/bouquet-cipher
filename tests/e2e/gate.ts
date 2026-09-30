import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { request, type FullConfig } from "@playwright/test";

/** The gate's cookie, shared by every test (the site may be a private garden). */
export const GATE_STATE = ".playwright/gate.json";

/** Open the private garden's gate once, if it has one, and keep the cookie for the tests. */
export default async function openGate(config: FullConfig) {
  if (existsSync(".env.local")) process.loadEnvFile(".env.local");
  mkdirSync(".playwright", { recursive: true });
  const baseURL = config.projects[0].use.baseURL ?? "http://localhost:3000";
  const ctx = await request.newContext({ baseURL });
  if (process.env.SITE_PASSPHRASE) {
    const res = await ctx.post("/api/gate", { data: { passphrase: process.env.SITE_PASSPHRASE } });
    if (!res.ok()) throw new Error(`Couldn't open the gate for the tests (${res.status()}).`);
  }
  await ctx.storageState({ path: GATE_STATE });
  await ctx.dispose();
  if (!existsSync(GATE_STATE)) writeFileSync(GATE_STATE, JSON.stringify({ cookies: [], origins: [] }));
}
