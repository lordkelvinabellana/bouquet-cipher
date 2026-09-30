import { existsSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// Events land in the same database as local bouquets, marked as test traffic (`dev`).
if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const secret = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const admin = url && secret ? createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
/** Listed in ADMIN_EMAILS in .env.local, for these tests only. */
const ADMIN = "stats.admin@example.com";
const made: string[] = [];
const sessions: string[] = [];

const newSession = () => {
  const s = `e2e${Math.random().toString(36).slice(2, 14)}`;
  sessions.push(s);
  return s;
};

async function eventsFor(session: string) {
  const { data } = await admin!.from("events").select("name, props, dev, bouquet_id").eq("session", session);
  return data ?? [];
}

const off = (v: string | undefined) => /^(0|off|false|no)$/i.test(v?.trim() ?? "");
test.skip(!admin, "Analytics need Supabase keys in .env.local.");

test.afterAll(async () => {
  if (sessions.length) await admin?.from("events").delete().in("session", sessions);
  for (const id of made.splice(0)) await admin?.auth.admin.deleteUser(id);
});

test("counts only known events, only small flags, and never bots", async ({ request }) => {
  const session = newSession();
  await request.post("/api/events", { data: { name: "home_view", session, props: { ok: true, message: "x".repeat(40) } } });
  await request.post("/api/events", { data: { name: "not_an_event", session } });
  await request.post("/api/events", { data: { name: "open", session }, headers: { "user-agent": "Twitterbot/1.0" } });
  await expect.poll(async () => (await eventsFor(session)).map((e) => e.name)).toEqual(["home_view"]);
  const [row] = await eventsFor(session);
  expect(row.dev).toBe(true);
  expect(row.props).toEqual({ ok: true });
});

test("a send is counted by the server, with its tab", async ({ request }) => {
  const session = newSession();
  const res = await request.post("/api/bouquets", { data: { message: "Counted" }, headers: { "x-bc-session": session } });
  const { id } = (await res.json()) as { id: string };
  await expect.poll(async () => (await eventsFor(session)).map((e) => e.name)).toEqual(["sent"]);
  const [row] = await eventsFor(session);
  expect(row.bouquet_id).toBe(id);
  expect(row.props).toMatchObject({ kind: "bouquet", reply: false, signedIn: false });
});

test("the composer counts its steps as you go", async ({ page }) => {
  await page.goto("/create");
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem("bc-session"))).toBeTruthy();
  const session = await page.evaluate(() => sessionStorage.getItem("bc-session"));
  sessions.push(session!);
  await page.getByRole("textbox", { name: "Your message" }).fill("Hello");
  await page.getByRole("button", { name: "Wrap it" }).click();
  await page.getByRole("button", { name: "Create link" }).click();
  await expect(page.getByLabel("Link to your bouquet")).toHaveValue(/\/b\//);
  await expect
    .poll(async () => (await eventsFor(session!)).map((e) => e.name).sort())
    .toEqual(["create_view", "sent", "wrap", "write_start"]);
});

test("the numbers are only for the site's owners", async ({ browser, page }, testInfo) => {
  // one owner account, so one browser at a time
  test.skip(testInfo.project.name !== "chromium", "Runs once, on desktop.");
  test.skip(off(process.env.NEXT_PUBLIC_FEATURE_ACCOUNTS) || off(process.env.NEXT_PUBLIC_FEATURE_STATS), "Needs accounts and /stats switched on.");
  // signed out: off to sign in
  await page.goto("/stats");
  await expect(page).toHaveURL(/\/login/);

  const password = `pw-${Math.random().toString(36).slice(2)}-${Date.now()}`;
  await admin!.auth.admin.deleteUser((await admin!.auth.admin.listUsers()).data.users.find((u) => u.email === ADMIN)?.id ?? "00000000-0000-0000-0000-000000000000").catch(() => {});
  const created = await admin!.auth.admin.createUser({ email: ADMIN, password, email_confirm: true });
  if (created.error) throw created.error;
  made.push(created.data.user.id);
  const owner = await (await browser.newContext()).newPage();
  await owner.goto("/login?next=/stats");
  await owner.getByLabel("Email").fill(ADMIN);
  await owner.getByLabel("Password").fill(password);
  await owner.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(owner.getByRole("heading", { name: "The numbers" })).toBeVisible();
  await owner.getByRole("link", { name: "Test traffic" }).click();
  await expect(owner.getByRole("heading", { name: "Test traffic" })).toBeVisible();
  await expect(owner.getByRole("heading", { name: "Sending" })).toBeVisible();
  await expect(owner.getByRole("rowheader", { name: /Opened a bouquet/ })).toBeVisible();

  // anyone else signed in: there's nothing here
  const other = `stats.other.${Date.now()}@example.com`;
  const second = await admin!.auth.admin.createUser({ email: other, password, email_confirm: true });
  made.push(second.data.user!.id);
  const stranger = await (await browser.newContext()).newPage();
  await stranger.goto("/login?next=/stats");
  await stranger.getByLabel("Email").fill(other);
  await stranger.getByLabel("Password").fill(password);
  await stranger.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(stranger).toHaveURL(/\/stats$/);
  await expect(stranger.getByRole("heading", { name: "The numbers" })).toHaveCount(0);
  const html = await (await stranger.request.get("/stats")).text();
  expect(html).not.toContain("Every event");
});
