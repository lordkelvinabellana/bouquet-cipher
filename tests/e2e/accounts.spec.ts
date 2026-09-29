import { existsSync } from "node:fs";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// The same keys the dev server uses. Test users are made and removed through Supabase's
// admin API, so no sign-in emails are sent (real projects have a small hourly allowance,
// and emails to made-up addresses bounce).
if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const secret = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const admin = url && secret ? createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
const made: string[] = [];

test.afterAll(async () => {
  for (const id of made.splice(0)) await admin?.auth.admin.deleteUser(id);
});

/** A new account, signed in with its email and password on the sign-in screen. */
async function signIn(browser: Browser, email: string, name: string): Promise<Page> {
  const password = `pw-${Math.random().toString(36).slice(2)}-${Date.now()}`;
  const created = await admin!.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error) throw created.error;
  made.push(created.data.user.id);
  const page = await (await browser.newContext()).newPage();
  await page.goto("/login?next=/bouquets");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/bouquets$/);
  await page.getByLabel("Your name on bouquets").fill(name);
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByLabel("Your name on bouquets")).toHaveValue(name);
  return page;
}

test.beforeEach(async ({ request }) => {
  const me = (await (await request.get("/api/me")).json()) as { enabled: boolean };
  test.skip(!me.enabled || !admin, "Accounts need Supabase keys in .env.local.");
});

test("a bouquet between two accounts: kept, answered with a card, and read in the inbox", async ({ browser }, info) => {
  const tag = `${info.project.name}${Date.now()}`;
  const kel = await signIn(browser, `kel.${tag}@example.com`, "Kel");
  const sam = await signIn(browser, `sam.${tag}@example.com`, "Sam");

  // Kel sends a bouquet; it's theirs, so it's in Sent
  await kel.goto("/create");
  await kel.getByRole("textbox", { name: "Your message" }).fill("I love you");
  await kel.getByRole("button", { name: "Wrap it" }).click();
  await expect(kel.getByPlaceholder("your name (optional)")).toHaveValue("Kel");
  await kel.getByRole("button", { name: "Create link" }).click();
  const url = await kel.getByLabel("Link to your bouquet").inputValue();
  const code = url.split("/b/")[1];

  // Sam opens it (it plays by itself), keeps it, and answers with a card
  await sam.goto(url);
  await sam.getByRole("button", { name: "Show it all" }).click({ timeout: 25_000 });
  await sam.getByRole("button", { name: "Reply with a card" }).click();
  await sam.getByLabel("A card for Kel").fill("Thank you, they're lovely!");
  await sam.getByRole("button", { name: "Send card" }).click();
  await expect(sam.getByText("Your card is in Kel’s inbox.")).toBeVisible();
  await sam.goto("/bouquets?tab=received");
  await expect(sam.locator(`a[href="/b/${code}"]`)).toBeVisible();

  // Kel finds it unread in the inbox, opens it, and it's read
  await kel.goto("/bouquets?tab=inbox");
  const item = kel.getByRole("link", { name: /Sam sent you a card/ });
  await expect(item).toHaveAttribute("data-unread", "");
  await kel.goto("/create");
  await expect(kel.getByRole("link", { name: "Your bouquets, 1 new" })).toBeVisible();
  await kel.goto("/bouquets?tab=inbox");
  await kel.getByRole("link", { name: /Sam sent you a card/ }).click();
  await kel.getByRole("button", { name: "Show it all" }).click({ timeout: 15_000 });
  await expect(kel.getByLabel("The message")).toContainText("Thank you, they're lovely!");
  await expect(kel.getByLabel("The message")).toContainText("Sam");
  await kel.goto("/bouquets?tab=inbox");
  await expect(kel.getByRole("link", { name: /Sam sent you a card/ })).not.toHaveAttribute("data-unread", "");
  await kel.goto("/bouquets?tab=sent");
  await expect(kel.locator(`a[href="/b/${code}"]`)).toBeVisible();
});

test("signing out, and replying needs an account", async ({ browser }, info) => {
  const tag = `${info.project.name}${Date.now()}`;
  const kel = await signIn(browser, `kel.${tag}@example.com`, "Kel");
  const res = await kel.request.post("/api/bouquets", { data: { message: "Thinking of you", fromName: "Kel" } });
  const { id } = (await res.json()) as { id: string };

  // someone without an account is asked to sign in before replying to Kel's inbox
  const guest = await (await browser.newContext()).newPage();
  await guest.goto(`/b/${id}`);
  await guest.getByRole("button", { name: "Show it all" }).click({ timeout: 25_000 });
  await expect(guest.getByRole("link", { name: "Sign in to reply" })).toHaveAttribute("href", `/login?next=${encodeURIComponent(`/b/${id}`)}`);
  const refused = await guest.request.post("/api/bouquets", { data: { kind: "card", message: "hi", replyTo: id } });
  expect(refused.status()).toBe(401);

  await kel.goto("/bouquets");
  await kel.getByRole("button", { name: "Sign out" }).click();
  await expect(kel).toHaveURL(/\/$/);
  await kel.goto("/bouquets");
  await expect(kel).toHaveURL(/\/login\?next=(%2F|\/)bouquets$/);
  // a wrong password is refused kindly
  await kel.getByLabel("Email").fill(`kel.${tag}@example.com`);
  await kel.getByLabel("Password").fill("not-the-password");
  await kel.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(kel.getByText("That email and password don't match.")).toBeVisible();
});
