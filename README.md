# Bouquet Cipher

Type a message and a hand-drawn bouquet grows with every keystroke. Share it with a link: the flowers *are* the message, and the recipient's page reads them back into words.

- **Every word is a stem**, read from the bottom up.
- **Vowels (and Y) are flowers**: E tulip, A anemone, O rose, I iris, U bellflower, Y yarrow.
- **Consonants are leaves**: 7 shapes × 3 tints (sage, dusty blue, coral), tinted by how common the letter is.
- **Punctuation, numbers, hearts and accents** have their own buds, curls, berries and dewdrops.

The full table lives in [`src/core/alphabet/v1.ts`](src/core/alphabet/v1.ts), and there's a readable version at `/alphabet`.

### Every bouquet has its own key

Each new bouquet gets a random 128-bit key ([`src/core/cipher.ts`](src/core/cipher.ts)). From it, SipHash-2-4 derives:

- **a shuffle for every position** ([`alphabet/v2.ts`](src/core/alphabet/v2.ts)). Each character moves within its own group: vowels among the six flowers, consonants among the leaves of their own tint, digits among the berry counts. Vowels stay flowers and common consonants stay the main green, but which flower means which letter changes from bouquet to bouquet, and from letter to letter. Two "I love you" bouquets never match, and nobody can read one by eye.
- **the arrangement and the palette**: one of six curated palettes. Flowers may go deep; leaves are always fresh greens, blue-greens and light warm tones (a test enforces "nothing withered"). Stems stay ink.

The key is stored with the bouquet on the server; the link and QR tag point to it. The composer holds the draft's key, so the bouquet you watch grow is exactly the one that's sent. **Rearrange** draws a new key. Bouquets saved before keys (no `cipher_key`) still render with the open alphabet v1.

**Your seal**: the first time you open the composer, your browser makes a private secret (kept in `localStorage`, see [`src/identity/signature.ts`](src/identity/signature.ts)). The wax seal is derived one way from that secret, so every bouquet you send from that device carries the same seal. Later it can move to an account.

## Pages

| Page | What it's for |
| --- | --- |
| `/` | A one-screen introduction with a live demo, and two ways in: create or decode |
| `/create` | Write a message; wrap the bouquet (paper, names, arrangement); get the link, the code and a share picture with a QR gift tag |
| `/decode` | Open a bouquet by scanning its tag with the camera, uploading the picture, or typing its code or link |
| `/b/<code>` | The recipient's journey: the wrapped bouquet, unwrapping, an envelope sealed with the bouquet's wax seal, and the letter written out as each flower lights up |
| `/alphabet` | The floral alphabet: how a bouquet is written, and the open alphabet before a key shuffles it |
| `/login` | Sign in with an emailed link or 6-digit code, or Google (when it's switched on in Supabase) |
| `/bouquets` | Signed in: your Inbox (replies sent to you), Received (bouquets you opened from links) and Sent, plus your name and seal |

### Accounts, the inbox and replies

Accounts are optional: anyone can still make, send and read bouquets by link. Signed in, what you send is kept in **Sent**, bouquets you open from links are kept in **Received**, and your seal follows your account instead of your device. When a bouquet's sender has an account, its recipient can reply **with a bouquet or with a simple card**, and the reply goes straight to the sender's **Inbox** (with an unread badge in the header). Replying to someone's inbox needs an account, so nobody can drop anonymous messages into it.

Coming next: credits. Card replies stay free; a bouquet reply will cost a credit (the first one free), and premium papers, palettes, fonts and tag colours will be paid for in credits too. Credits are bought in packs (GCash, Maya or card through a payment provider) and can only be spent in the app, never cashed out.

Codes are ten characters with no look-alikes (no I, L, O or U), shown as `K7M2Q-9XWPT`; typing them in lowercase or with O for 0 still works.

The camera scanner needs a secure (https) page, so it works on the deployed site and on `localhost`, but not on a phone pointed at your computer's network address during development. Uploading the picture and typing the code work everywhere.

## Running it locally

```bash
npm install
npm run dev
```

Open http://localhost:3000. Without Supabase configured, bouquets are saved to `.data/bouquets.json` (development only), so the whole flow works with no accounts.

For accounts, run Supabase locally (it needs Docker):

```bash
supabase start
```

Copy the API URL, the anon (publishable) key and the service role (secret) key it prints into `.env.local` (see `.env.example`). Sign-in emails don't leave your computer: they land in the local mailbox at http://127.0.0.1:54324. `supabase/config.toml` has the local auth settings, and `supabase/templates/sign-in.html` is the sign-in email (a link that works on any device, plus the 6-digit code). Google sign-in only works against a real project (below).

| Command | What it does |
| --- | --- |
| `npm test` | Property tests: round trips, stability, limits, golden bouquets |
| `npm run e2e` | Playwright end-to-end tests (desktop and mobile) |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript |
| `npm run build` | Production build |

`/specimen` (development only) shows every glyph, plus `?focus=eao` for close-ups, `?bouquet=I love you|hmm` for whole bouquets and `?palettes=I love you` for one message in every palette. `/api/dev/card?text=I love you&paper=1&key=random` renders a keyed card as a PNG. A local copy of the style reference goes in `public/_dev/reference.png` for side-by-side comparison. That folder is gitignored and never deployed.

## How it fits together

Everything that decides what a bouquet looks like is pure TypeScript in `src/core`, shared by the browser and the server:

```
text → canon → genome (stems → elements) → layout v1 → art → draw list
          key ┘ (alphabet v2 shuffle,         └ palette, arrangement)
                          └ reading sequence → text   (the reveal decodes the flowers with the key)
draw list → live SVG (compose/receive) · canvas PNG (Save image) · SVG → PNG on the server (link previews)
```

- `core/text`: canonical text and the limits (80 characters, 24 per word).
- `core/alphabet/v1`, `core/alphabet/v2`, `core/layout/v1`: frozen once shipped; each stored bouquet records `alphabet_v` (1 open, 2 keyed).
- `core/cipher`, `core/bouquet`: the bouquet key, and the one function everything grows a bouquet with.
- `core/art`: procedural, gouache-style flowers and leaves (no image assets).
- `input/useGardenInput`: keystroke handling that's safe on mobile keyboards and IMEs.
- `render/svg/LiveBouquet`: grow/wilt animations; placed elements never move while you type.
- `server/*`, `app/api/bouquets`: validation, rate limiting and storage.

## Deploying (Supabase + Vercel)

1. **Supabase**: create a project at supabase.com, then from this folder:
   ```bash
   supabase login
   supabase link --project-ref <your-project-ref>
   supabase db push
   ```
   This creates the `bouquets` table, with row-level security on and no public access. `0002_paper.sql` adds the wrapping paper, `0003_cipher.sql` each bouquet's key and the sender's seal, `0004_longer_messages.sql` room for emoji-heavy messages, and `0005_accounts.sql` profiles, senders, recipients, replies and kept bouquets.

   Then, in the dashboard under **Authentication**:
   - **URL Configuration**: set the Site URL to your domain, and add `https://<your-domain>/**` to the redirect URLs.
   - **Email Templates**: for both **Magic Link** and **Confirm signup**, paste `supabase/templates/sign-in.html` (it links to `/auth/confirm` and shows the 6-digit code).
   - **Providers → Google**: create an OAuth client in Google Cloud (APIs & Services → Credentials, type "Web application") with `https://<project-ref>.supabase.co/auth/v1/callback` as its authorised redirect URI, then paste its client ID and secret here. The Google button appears on the sign-in page by itself once this is on.
2. **Vercel**: import the repo (or run `vercel link`). Set these environment variables for Production and Preview (see `.env.example`):
   - `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (the public key: it only lets people sign in)
   - `SUPABASE_SERVICE_ROLE_KEY` (server-only, never `NEXT_PUBLIC_`)
   - `NEXT_PUBLIC_SITE_URL` (your domain)
   - `RATE_LIMIT_SALT` (any random string)
3. Deploy, then send yourself a link in iMessage or WhatsApp to check that the preview shows the bouquet.

### Privacy

Messages and their keys are stored in Supabase so link previews can show the real bouquet (the key never appears in the picture or the page's URL). Every read and write goes through the server with the service role key, and gallery and inbox queries are scoped to the account the auth server has verified. The database has no public read access and no listing, and each link's 10-character random id is the only way to open that bouquet. People see each other's display names only, never email addresses.
