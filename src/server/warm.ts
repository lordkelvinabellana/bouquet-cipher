import "server-only";

/** Pretend to be Facebook's crawler, so the page answers with its link-preview tags up front. */
const CRAWLER = "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)";

/**
 * Render a new bouquet's link-preview image right away, so it's already cached when a chat
 * app asks for it. Apps like Messenger fetch a link the moment it's pasted, and if the
 * picture takes too long they settle for a plain card and keep it that way for weeks.
 * Reads the image's address from the page itself, since Next adds a version to it.
 */
export async function warmLinkPreview(pageUrl: string): Promise<void> {
  try {
    const html = await (await fetch(pageUrl, { headers: { "user-agent": CRAWLER }, cache: "no-store" })).text();
    const image = html.match(/<meta property="og:image" content="([^"]+)"/)?.[1]?.replaceAll("&amp;", "&");
    if (image) await fetch(image, { headers: { "user-agent": CRAWLER }, cache: "no-store" });
  } catch (err) {
    console.error("Couldn't warm the link preview:", err);
  }
}
