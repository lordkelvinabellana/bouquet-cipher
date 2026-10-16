import { existsSync, readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { GATE_STATE } from "./gate";

// The private garden's features, when they're switched on in .env.local.
if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const on = (v: string | undefined, fallback: boolean) => (v?.trim() ? !/^(0|off|false|no)$/i.test(v.trim()) : fallback);
const ANY_ANSWER = on(process.env.GATE_ANY_ANSWER, false);
const GATED = ANY_ANSWER || !!process.env.SITE_PASSPHRASE?.trim();
const ACCOUNTS = on(process.env.NEXT_PUBLIC_FEATURE_ACCOUNTS, true);
const STATS = on(process.env.NEXT_PUBLIC_FEATURE_STATS, true);
const GARDEN = on(process.env.NEXT_PUBLIC_FEATURE_GARDEN, false);
const PHOTOS = on(process.env.NEXT_PUBLIC_FEATURE_PHOTOS, false);
const LOCKS = on(process.env.NEXT_PUBLIC_FEATURE_LOCKS, false);

/** A tiny real JPEG, drawn by the browser. */
async function jpeg(page: Page): Promise<number[]> {
  return page.evaluate(async () => {
    const c = document.createElement("canvas");
    c.width = 320;
    c.height = 240;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#e98e72";
    ctx.fillRect(0, 0, 320, 240);
    ctx.fillStyle = "#fbefd6";
    ctx.beginPath();
    ctx.arc(160, 120, 70, 0, Math.PI * 2);
    ctx.fill();
    const blob = await new Promise<Blob>((r) => c.toBlob((b) => r(b!), "image/jpeg", 0.9));
    return Array.from(new Uint8Array(await blob.arrayBuffer()));
  });
}

test.describe("the gate", () => {
  test.skip(!GATED, "SITE_PASSPHRASE isn't set.");
  test.use({ storageState: { cookies: [], origins: [] } });

  test("asks for the secret word, once, for the garden only", async ({ page }) => {
    // the public app needs no word
    await page.goto("/create");
    await expect(page).toHaveURL(/\/create$/);
    await page.goto("/garden");
    await expect(page).toHaveURL(/\/gate\?next=%2Fgarden/);
    const word = page.getByLabel("The secret word", { exact: true });
    const open = page.getByRole("button", { name: "Open the gate" });
    // nothing at all never opens it
    await word.fill("   ");
    await expect(open).toBeDisabled();
    if (ANY_ANSWER) {
      // a playful gate: whatever she thinks of is right
      await word.fill("sunflowers");
      await open.click();
      await expect(page.getByText(/You got it/)).toBeVisible();
    } else {
      await word.fill("definitely not it");
      await open.click();
      await expect(page.getByText("That's not it. Try again?")).toBeVisible();
      // capitals and spaces don't matter
      await word.fill(`  ${process.env.SITE_PASSPHRASE!.toUpperCase()} `);
      await open.click();
    }
    await expect(page).toHaveURL(/\/garden$/);
    await page.goto("/finale");
    await expect(page).toHaveURL(/\/finale$/);
  });

  test("keeps the garden's API shut until the gate is open", async ({ request }) => {
    expect((await request.get("/api/today")).status()).toBe(401);
    expect((await request.get("/api/music")).status()).toBe(401);
    // anyone can still make a bouquet, but it isn't planted in the garden
    expect((await request.post("/api/bouquets", { data: { message: "Hello", garden: true } })).status()).toBe(201);
  });
});

test("a bouquet link outside the gate shows the gate, with its preview intact", async ({ browser, request }, testInfo) => {
  test.skip(!GATED, "SITE_PASSPHRASE isn't set.");
  // made from inside the garden (the tests' shared state has the gate open)...
  const { id } = (await (await request.post("/api/bouquets", { data: { message: "Only for you", garden: true } })).json()) as { id: string };
  // ...and opened by someone who hasn't said the secret word
  const outside = await browser.newContext({ baseURL: testInfo.project.use.baseURL, storageState: { cookies: [], origins: [] } });
  const html = await (await outside.request.get(`/b/${id}`, { headers: { "user-agent": "facebookexternalhit/1.1" } })).text();
  expect(html).toContain(`/b/${id}/opengraph-image`);
  expect(html).not.toContain("Only for you");
  const img = await outside.request.get(`/b/${id}/opengraph-image`);
  expect(img.headers()["content-type"]).toBe("image/png");
  const page = await outside.newPage();
  await page.goto(`/b/${id}`);
  await page.getByLabel("The secret word", { exact: true }).fill(ANY_ANSWER ? "anything at all" : process.env.SITE_PASSPHRASE!);
  await page.getByRole("button", { name: "Open the gate" }).click();
  await expect(page.getByRole("button", { name: "Unwrap it" })).toBeVisible({ timeout: 10_000 });
  await outside.close();
});

test("switched-off features lead home", async ({ page }) => {
  test.skip(ACCOUNTS && STATS, "Accounts and stats are on.");
  if (!ACCOUNTS) {
    for (const path of ["/login", "/bouquets", "/reset"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/$/);
    }
    await expect(page.getByRole("link", { name: "Sign in" })).toHaveCount(0);
  }
  if (!STATS) {
    await page.goto("/stats");
    await expect(page).toHaveURL(/\/$/);
  }
});

test("a bouquet locked with a question opens only for the answer", async ({ page, request }) => {
  test.skip(!LOCKS, "Locks are off.");
  const res = await request.post("/api/bouquets", {
    data: { message: "You got it", fromName: "Kel", lock: { question: "Where did we first meet?", answer: "The Café" } },
  });
  const { id } = (await res.json()) as { id: string };
  await page.goto(`/b/${id}`);
  await expect(page.getByRole("heading", { name: "Kel left you a question" })).toBeVisible();
  await expect(page.getByText("Where did we first meet?")).toBeVisible();
  // its preview shows closed buds, and its photo route stays shut
  expect((await request.get(`/b/${id}/opengraph-image`)).status()).toBe(200);
  await page.getByLabel("Your answer").fill("the library");
  await page.getByRole("button", { name: "Open it" }).click();
  await expect(page.getByText("Not quite. Try again?")).toBeVisible();
  await page.getByLabel("Your answer").fill("the cafe!");
  await page.getByRole("button", { name: "Open it" }).click();
  await expect(page.getByRole("button", { name: "Unwrap it" })).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: "Unwrap it" }).click();
  await page.getByRole("button", { name: "Open the envelope" }).first().click({ timeout: 10_000 });
  await page.getByRole("button", { name: "Show it all" }).click();
  await expect(page.getByLabel("The message")).toContainText("You got it");
});

test("a photo slides out with the letter", async ({ page, request }) => {
  test.skip(!PHOTOS, "Photos are off.");
  await page.goto("/create");
  const bytes = await jpeg(page);
  const up = await request.post("/api/photos", { data: Buffer.from(bytes), headers: { "content-type": "image/jpeg" } });
  expect(up.status()).toBe(201);
  const { name } = (await up.json()) as { name: string };
  expect((await request.post("/api/photos", { data: Buffer.from("not a photo"), headers: { "content-type": "image/jpeg" } })).status()).toBe(400);
  const { id } = (await (await request.post("/api/bouquets", { data: { message: "Look at us", photo: name } })).json()) as { id: string };
  await page.goto(`/b/${id}`);
  await page.getByRole("button", { name: "Unwrap it" }).click();
  await page.getByRole("button", { name: "Open the envelope" }).first().click({ timeout: 10_000 });
  await page.getByRole("button", { name: "Show it all" }).click();
  const photo = page.getByRole("img", { name: "A photo tucked in with the letter" });
  await expect(photo).toBeVisible();
  await expect.poll(() => photo.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(320);
});

test("the composer can tuck in a photo and lock it with a question", async ({ page }) => {
  test.skip(!PHOTOS || !LOCKS, "Photos or locks are off.");
  await page.goto("/create");
  const bytes = await jpeg(page);
  await page.getByRole("textbox", { name: "Your message" }).fill("Happy monthsary");
  await page.getByRole("button", { name: "Wrap it" }).click();
  await page.locator('input[type="file"]').setInputFiles({ name: "us.jpg", mimeType: "image/jpeg", buffer: Buffer.from(bytes) });
  await expect(page.getByRole("img", { name: "The photo you chose" })).toBeVisible();
  await page.getByLabel(/Lock it with a question/).check();
  await page.getByPlaceholder("Where was our first date?").fill("Our song?");
  await page.getByPlaceholder("the answer").fill("Yellow");
  await page.getByRole("button", { name: "Create link" }).click();
  const link = page.getByLabel("Link to your bouquet");
  await expect(link).toHaveValue(/\/b\/[0-9A-Z]{10}$/);
  await page.goto(await link.inputValue());
  await expect(page.getByText("Our song?")).toBeVisible();
});

test("a bouquet planted in our garden grows there; others stay out", async ({ page, request }) => {
  test.skip(!GARDEN, "The garden is off.");
  const { id } = (await (await request.post("/api/bouquets", { data: { message: "For the garden", fromName: "Garden test", garden: true } })).json()) as { id: string };
  const { id: elsewhere } = (await (await request.post("/api/bouquets", { data: { message: "For someone else" } })).json()) as { id: string };
  await page.goto("/garden");
  await expect(page.getByRole("heading", { name: "Our garden" })).toBeVisible();
  if (process.env.TOGETHER_SINCE) await expect(page.getByText(/(days?|months?) together/)).toBeVisible();
  await expect(page.locator(`a[href="/b/${id}"]`)).toBeVisible();
  await expect(page.locator(`a[href="/b/${elsewhere}"]`)).toHaveCount(0);
});

test("a bouquet can be planted in an earlier month, and empty months wait for theirs", async ({ page, request }) => {
  test.skip(!GARDEN || !process.env.TOGETHER_SINCE, "The garden or its date is off.");
  const word = process.env.MONTHSARY_WORD?.trim() || "monthsary";
  const { id } = (await (await request.post("/api/bouquets", { data: { message: "Back then", month: 5, garden: true } })).json()) as { id: string };
  await page.goto("/garden");
  // its card in the grid carries its month
  await expect(page.locator(`a[href="/b/${id}"]`)).toContainText(new RegExp(`Our 5th ${word}`, "i"));
  await expect(page.getByText("Still growing").first()).toBeVisible();
  expect((await request.post("/api/bouquets", { data: { message: "Nope", month: -1 } })).status()).toBe(400);
});

test("the garden's music starts from her tap on the first bouquet, and keeps playing", async ({ browser, request }) => {
  test.skip(!GARDEN, "The garden is off.");
  const songs = (await (await request.get("/api/music")).json()) as { title: string }[];
  test.skip(!songs.length, "No songs uploaded.");
  const make = async (message: string) => ((await (await request.post("/api/bouquets", { data: { message, month: 7, garden: true } })).json()) as { id: string }).id;
  const first = await make("Music one");
  const second = await make("Music two");
  // a visitor who never switched the music off
  const { cookies } = JSON.parse(readFileSync(GATE_STATE, "utf8")) as { cookies: [] };
  const ctx = await browser.newContext({ storageState: { cookies, origins: [] } });
  const page = await ctx.newPage();
  await page.goto(`/b/${first}`);
  const unwrap = page.getByRole("button", { name: "Unwrap it ♪" });
  await expect(unwrap).toBeVisible({ timeout: 15_000 });
  // it waits for her, rather than opening itself
  await page.waitForTimeout(2500);
  await expect(unwrap).toBeVisible();
  await unwrap.click();
  const music = page.getByRole("group", { name: "Music" });
  await expect(music.getByRole("button", { name: new RegExp(songs[0].title.replace(/[()]/g, "\\$&")) })).toBeVisible();
  // on to another bouquet (without reloading): the song carries on, and it opens itself
  await page.getByRole("navigation", { name: "Around our garden" }).getByRole("link", { name: "Our garden" }).click();
  await expect(page.getByRole("heading", { name: "Our garden" })).toBeVisible();
  await expect(music).toBeVisible();
  await page.locator(`a[href="/b/${second}"]`).click();
  await expect(page.getByRole("navigation", { name: "Around our garden" })).toBeVisible({ timeout: 15_000 });
  await expect(music).toBeVisible();
  await ctx.close();
});

test("bouquets not yet opened are greyed out, and turn to colour once opened", async ({ page, request }) => {
  test.skip(!GARDEN, "The garden is off.");
  const { id } = (await (await request.post("/api/bouquets", { data: { message: "Open me", fromName: "Garden test", garden: true } })).json()) as { id: string };
  await page.goto("/garden?fresh");
  const card = page.locator("li", { has: page.locator(`a[href="/b/${id}"]`) });
  await expect(card).toHaveAttribute("data-state", /^(next|later)$/);
  // the first unopened one is marked as the place to start
  await expect(page.getByText("Start here")).toBeVisible();
  await page.goto(`/b/${id}`);
  await page.getByRole("button", { name: /^Unwrap it/ }).click();
  await expect(page.getByRole("navigation", { name: "Around our garden" })).toBeVisible({ timeout: 10_000 });
  await page.goto("/garden");
  await expect(card).toHaveAttribute("data-state", "opened");
});

test("a garden bouquet opens as that month's, and leads on to the next", async ({ page, request }) => {
  test.skip(!GARDEN || !process.env.TOGETHER_SINCE, "The garden or its date is off.");
  const word = process.env.MONTHSARY_WORD?.trim() || "monthsary";
  const make = async (month: number) =>
    ((await (await request.post("/api/bouquets", { data: { message: `Month ${month}`, fromName: "Kel", month, garden: true } })).json()) as { id: string }).id;
  const first = await make(3);
  await make(4);
  await page.goto(`/b/${first}`);
  await expect(page.getByText(new RegExp(`^Our 3rd ${word}$`, "i"))).toBeVisible();
  await expect(page.getByRole("heading", { name: "Kel sent you a bouquet" })).toBeVisible();
  if (process.env.NICKNAMES || process.env.FOR_NAME) await expect(page.getByText(/there’s a message hidden in these flowers from Kel/)).toBeVisible();
  await page.getByRole("button", { name: "Unwrap it" }).click();
  await page.getByRole("button", { name: "Open the envelope" }).first().click({ timeout: 10_000 });
  await page.getByRole("button", { name: "Show it all" }).click();
  await expect(page.getByRole("navigation", { name: "Around our garden" }).getByRole("link", { name: "Our garden" })).toBeVisible();
  // the next bouquet in the garden (another test's may be in between, so any next one will do)
  await expect(page.getByRole("link", { name: /^Next: Our/ })).toBeVisible();
});

test("the special link: the gate, then the greeting, then our garden", async ({ browser }, testInfo) => {
  test.skip(!GARDEN || !process.env.TOGETHER_SINCE || !process.env.FOR_NAME, "The garden, its date or her name is off.");
  const path = `/for-${process.env.FOR_NAME!.trim().toLowerCase()}`;
  const word = process.env.MONTHSARY_WORD?.trim() || "monthsary";
  const visitor = await browser.newContext({ baseURL: testInfo.project.use.baseURL, storageState: { cookies: [], origins: [] } });
  const page = await visitor.newPage();
  await page.goto(path);
  if (GATED) {
    await expect(page).toHaveURL(new RegExp(`/gate\\?next=${encodeURIComponent(path)}`), { timeout: 20_000 });
    await page.getByLabel("The secret word", { exact: true }).fill(ANY_ANSWER ? "us" : process.env.SITE_PASSPHRASE!);
    await page.getByRole("button", { name: "Open the gate" }).click();
  }
  await expect(page).toHaveURL(new RegExp(`${path}$`), { timeout: 20_000 });
  await expect(page.getByRole("heading", { name: new RegExp(`Happy \\d+(st|nd|rd|th) ${word}`, "i") })).toBeVisible({ timeout: 10_000 });
  // three photo frames: each a photo, or a soft stand-in until one's added
  await expect(page.locator("figure")).toHaveCount(3);
  // a word before going in: it was all made for her (tap again if the page wasn't ready yet)
  await expect(async () => {
    await page.getByRole("button", { name: "Enter our garden" }).click();
    await expect(page.getByRole("dialog")).toContainText("made every bouquet in this garden by hand", { timeout: 2_000 });
  }).toPass({ timeout: 20_000 });
  await page.getByRole("link", { name: "Take me in" }).click();
  await expect(page.getByRole("heading", { name: "Our garden" })).toBeVisible();
  await visitor.close();
});

test("after the last bouquet, one last thing: the finale", async ({ page }) => {
  test.skip(!GARDEN, "The garden is off.");
  await page.goto("/garden");
  await page.getByRole("link", { name: /One last thing/ }).click();
  await expect(page).toHaveURL(/\/finale$/, { timeout: 30_000 });
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  // the bouquet grows, then the way back appears
  await expect(page.getByRole("link", { name: "Back to our garden" })).toBeVisible({ timeout: 15_000 });
});
