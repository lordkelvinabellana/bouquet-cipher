import { expect, test, type Page } from "@playwright/test";
import { existsSync } from "node:fs";
import { GATE_STATE } from "./gate";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const MESSAGE = "Happy birthday Mom! Love you always.";

async function write(page: Page, text: string) {
  await page.goto("/create");
  await page.getByRole("textbox", { name: "Your message" }).fill(text);
  await expect(page.locator("svg g[data-key]")).toHaveCount(text.replace(/\s/g, "").length);
}

/** Wrap the bouquet, add names, create the link; returns the link. */
async function wrapAndLink(page: Page, opts: { to?: string; from?: string; paper?: string } = {}) {
  await page.getByRole("button", { name: "Wrap it" }).click();
  if (opts.paper) await page.locator("fieldset label", { hasText: opts.paper }).click();
  if (opts.to) await page.getByPlaceholder("their name (optional)").fill(opts.to);
  if (opts.from) await page.getByPlaceholder("your name (optional)").fill(opts.from);
  await page.getByRole("button", { name: "Create link" }).click();
  const link = page.getByLabel("Link to your bouquet");
  await expect(link).toHaveValue(/\/b\/[0-9A-Z]{10}$/);
  return link.inputValue();
}

/** The recipient's journey plays by itself: the paper comes off, the card opens, the letter writes itself. */
async function unwrapAndRead(r: Page) {
  await r.getByRole("button", { name: "Show it all" }).click({ timeout: 25_000 });
}

/** The flowers' own drawing (every shape and colour), whatever the camera is doing. */
async function flowerArt(page: Page): Promise<string> {
  return page
    .locator("svg g[data-key] path")
    .evaluateAll((paths) => paths.map((p) => `${p.getAttribute("fill")} ${p.getAttribute("d")}`).join("|"));
}

test("every bouquet has its own key: the same words grow differently and still read back", async ({ page, browser }) => {
  await write(page, "I love you");
  const first = await flowerArt(page);
  await write(page, "I love you"); // a new visit, a new key
  const second = await flowerArt(page);
  expect(second).not.toBe(first);

  const url = await wrapAndLink(page, { from: "Kel" });
  expect(await flowerArt(page)).toBe(second);

  // the recipient gets exactly the bouquet that was grown, and the app reads it back
  const ctx = await browser.newContext({ storageState: GATE_STATE });
  const r = await ctx.newPage();
  await r.goto(url);
  await expect(r.locator("svg g[data-key]")).toHaveCount(8);
  expect(await flowerArt(r)).toBe(second);
  await unwrapAndRead(r);
  await expect(r.getByLabel("The message")).toContainText("I love you");
  await ctx.close();
});

test("opening the link is all it takes: the bouquet decodes itself", async ({ page, request }) => {
  const res = await request.post("/api/bouquets", { data: { message: "Thinking of you", fromName: "Alex" } });
  const { id } = (await res.json()) as { id: string };
  await page.goto(`/b/${id}`);
  await expect(page.getByRole("heading", { name: "Alex sent you a bouquet" })).toBeVisible();
  // no clicks at all
  await expect(page.getByText("The flowers say: Thinking of you")).toBeAttached({ timeout: 30_000 });
  await expect(page.getByLabel("The message")).toContainText("Thinking of you");
});

test("tapping skips ahead", async ({ page, request }) => {
  const res = await request.post("/api/bouquets", { data: { message: "Hi there" } });
  const { id } = (await res.json()) as { id: string };
  await page.goto(`/b/${id}`);
  await page.getByRole("button", { name: "Unwrap it" }).click();
  await page.getByRole("button", { name: "Open the envelope" }).first().click({ timeout: 10_000 });
  await expect(page.getByText("Reading the flowers")).toBeVisible({ timeout: 5_000 });
});

test("reading it out, each letter pops up over its flower as the note types it", async ({ page, request }) => {
  const res = await request.post("/api/bouquets", { data: { message: "Hi there" } });
  const { id } = (await res.json()) as { id: string };
  await page.goto(`/b/${id}`);
  await page.getByRole("button", { name: "Unwrap it" }).click();
  await page.getByRole("button", { name: "Open the envelope" }).first().click({ timeout: 10_000 });
  // a letter popping up over its flower
  await expect(page.locator('[class*="chip"]').first()).toBeAttached({ timeout: 8_000 });
  await expect(page.getByLabel("The message")).toContainText("Hi there", { timeout: 15_000 });
});

test("decode it yourself: guess letters until the note is filled", async ({ page, request }) => {
  const res = await request.post("/api/bouquets", { data: { message: "Hi Sam!", fromName: "Alex" } });
  const { id } = (await res.json()) as { id: string };
  await page.goto(`/b/${id}`);
  await page.getByRole("button", { name: "Decode it yourself" }).click();
  await expect(page.getByRole("heading", { name: "Can you read it?" })).toBeVisible({ timeout: 10_000 });
  // punctuation is given; letters start hidden, with their clues
  await expect(page.getByLabel("The message, still hidden")).toContainText("!");
  await expect(page.getByRole("button", { name: /hidden vowel/ }).first()).toBeVisible();
  await page.getByRole("button", { name: "Guess Z" }).click();
  await expect(page.getByRole("button", { name: "Guess Z, not in the message" })).toBeDisabled();
  for (const k of "hism") await page.keyboard.press(k);
  await page.getByRole("button", { name: "Guess A" }).click();
  await expect(page.getByText(/You decoded it in 6 guesses, 1 wrong/)).toBeVisible({ timeout: 10_000 });
  await expect(page.getByLabel("The message")).toContainText("Hi Sam!");
});

test("a ?solve link opens straight into the puzzle", async ({ page, request }) => {
  const res = await request.post("/api/bouquets", { data: { message: "Guess me" } });
  const { id } = (await res.json()) as { id: string };
  await page.goto(`/b/${id}?solve`);
  await page.getByRole("button", { name: "Unwrap it" }).click();
  await expect(page.getByRole("heading", { name: "Can you read it?" })).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: "Read it to me instead" }).click();
  await expect(page.getByLabel("The message")).toContainText("Guess me", { timeout: 15_000 });
});

test("the home page leads to creating and decoding", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Say it with flowers." })).toBeVisible();
  await page.getByRole("link", { name: "Create a bouquet" }).click();
  await expect(page).toHaveURL(/\/create$/);
  await page.goto("/");
  await page.getByRole("link", { name: "Decode a bouquet" }).click();
  await expect(page).toHaveURL(/\/decode$/);
});

test("a bouquet can be written, wrapped, sent and read back elsewhere", async ({ page, browser }) => {
  await write(page, MESSAGE);
  const url = await wrapAndLink(page, { to: "Mom", from: "Kel", paper: "Midnight" });
  // the gift tag with its QR code hangs from the ribbon
  await expect(page.getByText("scan to read")).toBeVisible();

  const recipient = await browser.newContext({ storageState: GATE_STATE });
  const r = await recipient.newPage();
  await r.goto(url);
  await expect(r).toHaveTitle("Kel sent you a bouquet");
  await expect(r.getByRole("heading", { name: "Kel sent you a bouquet" })).toBeVisible();
  await unwrapAndRead(r);
  await expect(r.getByText(`The flowers say: ${MESSAGE}`)).toBeAttached();
  await expect(r.getByLabel("The message")).toContainText(MESSAGE);
  await expect(r.getByLabel("The message")).toContainText("Kel");
  // in the private garden, replying happens once, from the finale; elsewhere, under every bouquet
  if (/^(1|on|true|yes)$/i.test(process.env.NEXT_PUBLIC_FEATURE_GARDEN?.trim() ?? "")) await expect(r.getByRole("link", { name: "Send one back" })).toHaveCount(0);
  else await expect(r.getByRole("link", { name: "Send one back" })).toHaveAttribute("href", "/create?to=Kel");
  await recipient.close();
});

test("the share picture's QR code opens the bouquet", async ({ page }, testInfo) => {
  await write(page, "Thinking of you");
  const url = await wrapAndLink(page, { to: "Sam", from: "Alex" });
  const code = url.split("/b/")[1];
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save picture" }).click();
  const file = testInfo.outputPath("bouquet.png");
  await (await download).saveAs(file);

  await page.goto("/decode");
  await page.locator('input[type="file"]').setInputFiles(file);
  await expect(page).toHaveURL(new RegExp(`/b/${code}$`), { timeout: 20_000 });
  await expect(page.getByRole("heading", { name: "Alex sent you a bouquet" })).toBeVisible();
});

test("a bouquet makes a share video, read out or kept a mystery", async ({ page }, testInfo) => {
  await write(page, "Guess who");
  await wrapAndLink(page, { to: "Sam" });
  await page.getByRole("button", { name: "Make a video" }).click();
  // senders keep the secret by default
  await expect(page.getByRole("radio", { name: "Keep it a mystery" })).toBeChecked();
  await page.getByRole("button", { name: "Create video" }).click();
  const save = page.getByRole("button", { name: "Save video" });
  await expect(save).toBeVisible({ timeout: 60_000 });
  const download = page.waitForEvent("download");
  await save.click();
  const file = testInfo.outputPath((await download).suggestedFilename());
  await (await download).saveAs(file);
  const { size } = await import("node:fs").then((fs) => fs.statSync(file));
  expect(file).toMatch(/\.(mp4|webm)$/);
  expect(size).toBeGreaterThan(20_000);
});

test("a typed code opens the bouquet, however it's typed", async ({ page, request }) => {
  const res = await request.post("/api/bouquets", { data: { message: "I love you", fromName: "Jo" } });
  const { id } = (await res.json()) as { id: string };
  await page.goto("/decode");
  const sloppy = `${id.slice(0, 5).toLowerCase()} - ${id.slice(5).toLowerCase()}`;
  await page.getByLabel("Bouquet code or link").fill(sloppy);
  await page.getByRole("button", { name: "Open", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/b/${id}$`));

  await page.goto("/decode");
  await page.getByLabel("Bouquet code or link").fill("not a code");
  await page.getByRole("button", { name: "Open", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("doesn't look like a bouquet code");
});

test("the composer refuses keystrokes past the limit, and forgives after", async ({ page }) => {
  await page.goto("/create");
  const box = page.getByRole("textbox", { name: "Your message" });
  const full = "ab ".repeat(26) + "ab"; // exactly 80 characters
  await box.fill(full);
  await expect(page.locator("#message-count")).toHaveText("80 / 80");
  await box.press("End");
  await box.pressSequentially("x");
  await expect(box).toHaveValue(full);
  const hint = page.locator("#message-hint");
  await expect(hint).toContainText("Your bouquet is full");
  await box.press("Backspace");
  // the refusal clears; a gentle count of what's left takes its place
  await expect(hint).toHaveText("1 left. Short and sweet lands best.");
});

test("backspace wilts elements away", async ({ page }) => {
  await page.goto("/create");
  const box = page.getByRole("textbox", { name: "Your message" });
  await box.pressSequentially("hello there", { delay: 30 });
  await expect(page.locator("svg g[data-key]")).toHaveCount(10);
  await box.press("Backspace");
  await box.press("Backspace");
  await expect(page.locator("svg g[data-key]")).toHaveCount(8);
});

test("reduced motion still unwraps and reads", async ({ browser, request }) => {
  const res = await request.post("/api/bouquets", { data: { message: "I love you", paper: 2 } });
  expect(res.status()).toBe(201);
  const { id } = (await res.json()) as { id: string };
  const ctx = await browser.newContext({ reducedMotion: "reduce", storageState: GATE_STATE });
  const page = await ctx.newPage();
  await page.goto(`/b/${id}`);
  await expect(page.getByText("The flowers say: I love you")).toBeAttached({ timeout: 15_000 });
  await ctx.close();
});

test("an unknown bouquet has wilted", async ({ page }) => {
  const res = await page.goto("/b/ZZZZZZZZZZ");
  expect(res?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "This bouquet has wilted" })).toBeVisible();
});

test("the link preview is a real picture", async ({ request }) => {
  const res = await request.post("/api/bouquets", { data: { message: "Thinking of you", fromName: "Alex", paper: 1 } });
  const { id } = (await res.json()) as { id: string };
  const img = await request.get(`/b/${id}/opengraph-image`);
  expect(img.status()).toBe(200);
  expect(img.headers()["content-type"]).toContain("image/png");
  expect((await img.body()).length).toBeGreaterThan(20_000);
});

test("every link has a picture preview: the site, a bouquet and a card", async ({ request }) => {
  const tags = async (path: string) => {
    const html = await (await request.get(path, { headers: { "user-agent": "facebookexternalhit/1.1" } })).text();
    const tag = (p: string) => html.match(new RegExp(`<meta property="${p}" content="([^"]+)"`))?.[1];
    return { image: tag("og:image"), url: tag("og:url"), site: tag("og:site_name") };
  };
  const png = async (url: string | undefined) => {
    const res = await request.get(new URL(url!).pathname + new URL(url!).search);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toBe("image/png");
    return (await res.body()).length;
  };

  const home = await tags("/");
  expect(home.site).toBe("Bouquet Cipher");
  expect(await png(home.image)).toBeGreaterThan(10_000);

  const card = (await (await request.post("/api/bouquets", { data: { kind: "card", message: "A note" } })).json()) as { id: string };
  const page = await tags(`/b/${card.id}`);
  expect(page.url).toMatch(new RegExp(`/b/${card.id}$`));
  expect(page.image).toContain(`/b/${card.id}/opengraph-image`);
  expect(await png(page.image)).toBeGreaterThan(10_000);
});
