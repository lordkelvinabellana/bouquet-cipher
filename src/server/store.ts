import "server-only";
/**
 * Where bouquets live. Supabase in production; a local JSON file in development when
 * Supabase isn't configured, so the whole flow works without any accounts. (Accounts
 * need Supabase: the file store has no users, so its account queries come back empty.)
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { TrackedEvent } from "@/lib/events";
import { newBouquetId, type BouquetKind, type NewBouquet } from "./validate";

export interface StoredBouquet {
  id: string;
  /** A bouquet of flowers, or a simple card. */
  kind: BouquetKind;
  message: string;
  salt: number;
  /** Wrapping paper (0 kraft, 1 blush, 2 sage, 3 midnight). */
  paper: number;
  /** The bouquet's key (null for bouquets made before keys). */
  cipherKey: string | null;
  /** The sender's signature seal, if any. */
  seal: number | null;
  alphabetV: number;
  toName: string | null;
  fromName: string | null;
  /** The account that sent it, and the one whose inbox it's in (null when anonymous). */
  senderId: string | null;
  recipientId: string | null;
  /** The bouquet this one answers. */
  replyTo: string | null;
  /** When its recipient first opened it from their inbox. */
  readAt: string | null;
  /** The sender's seal style when it was sent (see core/art/seal.ts). */
  sealStyle: string | null;
  /** Planted in "Our garden". */
  garden: boolean;
  /** The month of the garden it's planted in (null: the month it was made). */
  month: number | null;
  /** A photo tucked in with the letter. */
  photo: string | null;
  /** The secret question it waits behind, and the answer's salted hash (never sent to a browser). */
  lockQuestion: string | null;
  lockHash: string | null;
  createdAt: string;
}

/** Who a new bouquet is from and for. Decided by the server, never taken from the request. */
export interface Addressing {
  senderId: string | null;
  recipientId: string | null;
}

export interface Profile {
  id: string;
  displayName: string | null;
  /** The account's signature: the wax seal on everything it sends. */
  seal: number;
  /** Its chosen wax colour and emblem, if any. */
  sealStyle: string | null;
}

export interface BouquetStore {
  create(b: NewBouquet, to?: Addressing): Promise<StoredBouquet>;
  get(id: string): Promise<StoredBouquet | null>;
  /** Count one creation for this (hashed) IP; returns the count in the current window. */
  bumpRate(ipHash: string): Promise<number>;

  profile(userId: string): Promise<Profile | null>;
  setDisplayName(userId: string, name: string | null): Promise<void>;
  setSealStyle(userId: string, style: string | null): Promise<void>;
  /** What this account sent, newest first. */
  sent(userId: string): Promise<StoredBouquet[]>;
  /** What was sent to this account's inbox (replies, for now), newest first. */
  inbox(userId: string): Promise<StoredBouquet[]>;
  /** Bouquets this account opened from a link and kept, most recently kept first. */
  kept(userId: string): Promise<StoredBouquet[]>;
  keep(userId: string, bouquetId: string): Promise<void>;
  /** Mark an inbox item read (only its recipient can). */
  markRead(userId: string, bouquetId: string): Promise<void>;
  unread(userId: string): Promise<number>;

  /** Every bouquet planted in "Our garden", oldest first: the live site's, or (`test`) the test runs'. */
  garden(test: boolean): Promise<StoredBouquet[]>;
  /** Keep a photo (JPEG bytes) under its name, and read it back. */
  savePhoto(name: string, bytes: Uint8Array): Promise<void>;
  photo(name: string): Promise<Uint8Array | null>;
  /** Which of these photos exist (a quick listing; nothing is downloaded). */
  photosThatExist(names: readonly string[]): Promise<Set<string>>;

  /** Count one event (see lib/events.ts). `dev` marks local and preview traffic. */
  track(e: TrackedEvent, dev: boolean): Promise<void>;
  /** Per event since a moment: how many, and from how many browser tabs. */
  eventCounts(since: Date, dev: boolean): Promise<EventCount[]>;
  /** Daily counts of some events. */
  eventDaily(since: Date, names: readonly string[], dev: boolean, timeZone: string): Promise<EventDay[]>;
  /** How one event splits by one of its flags. */
  eventBreakdown(since: Date, name: string, key: string, dev: boolean): Promise<{ value: string; total: number }[]>;
}

export interface EventCount {
  name: string;
  total: number;
  sessions: number;
}

export interface EventDay {
  day: string;
  name: string;
  total: number;
}

/** How many of each list a gallery shows. */
const LIST_LIMIT = 100;

interface Row {
  id: string;
  kind: BouquetKind | null;
  message: string;
  salt: number;
  paper: number | null;
  cipher_key: string | null;
  seal: number | string | null;
  alphabet_v: number;
  to_name: string | null;
  from_name: string | null;
  sender_id: string | null;
  recipient_id: string | null;
  reply_to: string | null;
  read_at: string | null;
  seal_style: string | null;
  garden?: boolean | null;
  photo?: string | null;
  lock_question?: string | null;
  lock_hash?: string | null;
  test?: boolean | null;
  month?: number | null;
  created_at: string;
}

const fromRow = (r: Row): StoredBouquet => ({
  id: r.id,
  kind: r.kind ?? "bouquet",
  message: r.message,
  salt: r.salt,
  paper: r.paper ?? 0,
  cipherKey: r.cipher_key ?? null,
  seal: r.seal === null || r.seal === undefined ? null : Number(r.seal),
  alphabetV: r.alphabet_v,
  toName: r.to_name,
  fromName: r.from_name,
  senderId: r.sender_id ?? null,
  recipientId: r.recipient_id ?? null,
  replyTo: r.reply_to ?? null,
  readAt: r.read_at ?? null,
  sealStyle: r.seal_style ?? null,
  garden: r.garden ?? false,
  month: r.month ?? null,
  photo: r.photo ?? null,
  lockQuestion: r.lock_question ?? null,
  lockHash: r.lock_hash ?? null,
  createdAt: r.created_at,
});

class SupabaseStore implements BouquetStore {
  constructor(private db: SupabaseClient) {}

  private fail(what: string, error: { message: string }): never {
    throw new Error(`Could not ${what}: ${error.message}`);
  }

  async create(b: NewBouquet, to: Addressing = { senderId: null, recipientId: null }): Promise<StoredBouquet> {
    for (let attempt = 0; attempt < 4; attempt++) {
      const { data, error } = await this.db
        .from("bouquets")
        .insert({
          id: newBouquetId(),
          kind: b.kind,
          message: b.message,
          salt: b.salt,
          paper: b.paper,
          cipher_key: b.cipherKey,
          seal: b.seal,
          alphabet_v: 2,
          to_name: b.toName,
          from_name: b.fromName,
          reply_to: b.replyTo,
          seal_style: b.sealStyle ?? null,
          garden: b.garden ?? false,
          photo: b.photo ?? null,
          lock_question: b.lockHash ? (b.lock?.question ?? null) : null,
          lock_hash: b.lockHash ?? null,
          test: b.test ?? false,
          month: b.month ?? null,
          sender_id: to.senderId,
          recipient_id: to.recipientId,
        })
        .select()
        .single();
      if (!error) return fromRow(data as Row);
      if (error.code !== "23505") this.fail("save the bouquet", error);
      // id collision (astronomically rare): try another
    }
    throw new Error("Could not find a free id for the bouquet.");
  }

  async get(id: string): Promise<StoredBouquet | null> {
    const { data, error } = await this.db.from("bouquets").select("*").eq("id", id).maybeSingle();
    if (error) this.fail("load the bouquet", error);
    return data ? fromRow(data as Row) : null;
  }

  async bumpRate(ipHash: string): Promise<number> {
    const { data, error } = await this.db.rpc("bump_bouquet_rate", { p_ip_hash: ipHash });
    if (error) this.fail("check the rate", error);
    return Number(data);
  }

  async profile(userId: string): Promise<Profile | null> {
    const { data, error } = await this.db.from("profiles").select("id, display_name, seal, seal_style").eq("id", userId).maybeSingle();
    if (error) this.fail("load the profile", error);
    return data ? { id: data.id, displayName: data.display_name, seal: Number(data.seal), sealStyle: data.seal_style ?? null } : null;
  }

  async setSealStyle(userId: string, style: string | null): Promise<void> {
    const { error } = await this.db.from("profiles").update({ seal_style: style }).eq("id", userId);
    if (error) this.fail("save the seal", error);
  }

  async setDisplayName(userId: string, name: string | null): Promise<void> {
    const { error } = await this.db.from("profiles").update({ display_name: name }).eq("id", userId);
    if (error) this.fail("save the name", error);
  }

  private async list(column: "sender_id" | "recipient_id", userId: string): Promise<StoredBouquet[]> {
    const { data, error } = await this.db
      .from("bouquets")
      .select("*")
      .eq(column, userId)
      .order("created_at", { ascending: false })
      .limit(LIST_LIMIT);
    if (error) this.fail("load the bouquets", error);
    return (data as Row[]).map(fromRow);
  }

  sent(userId: string) {
    return this.list("sender_id", userId);
  }

  inbox(userId: string) {
    return this.list("recipient_id", userId);
  }

  async kept(userId: string): Promise<StoredBouquet[]> {
    const { data, error } = await this.db
      .from("kept")
      .select("kept_at, bouquets(*)")
      .eq("user_id", userId)
      .order("kept_at", { ascending: false })
      .limit(LIST_LIMIT);
    if (error) this.fail("load the kept bouquets", error);
    return (data as unknown as { bouquets: Row | null }[]).flatMap((r) => (r.bouquets ? [fromRow(r.bouquets)] : []));
  }

  async keep(userId: string, bouquetId: string): Promise<void> {
    const { error } = await this.db
      .from("kept")
      .upsert({ user_id: userId, bouquet_id: bouquetId }, { onConflict: "user_id,bouquet_id", ignoreDuplicates: true });
    if (error) this.fail("keep the bouquet", error);
  }

  async markRead(userId: string, bouquetId: string): Promise<void> {
    const { error } = await this.db
      .from("bouquets")
      .update({ read_at: new Date().toISOString() })
      .eq("id", bouquetId)
      .eq("recipient_id", userId)
      .is("read_at", null);
    if (error) this.fail("mark it read", error);
  }

  async garden(test: boolean): Promise<StoredBouquet[]> {
    const { data, error } = await this.db
      .from("bouquets")
      .select("*")
      .eq("garden", true)
      .eq("test", test)
      .order("created_at", { ascending: true })
      .limit(1000);
    if (error) this.fail("load the garden", error);
    return (data as Row[]).map(fromRow);
  }

  async savePhoto(name: string, bytes: Uint8Array): Promise<void> {
    const { error } = await this.db.storage.from("photos").upload(name, bytes, { contentType: "image/jpeg", upsert: false });
    if (error) this.fail("keep the photo", error);
  }

  async photosThatExist(names: readonly string[]): Promise<Set<string>> {
    const found = new Set<string>();
    await Promise.all(
      names.map(async (n) => {
        const { data } = await this.db.storage.from("photos").list("", { search: n, limit: 5 });
        if (data?.some((f) => f.name === n)) found.add(n);
      }),
    );
    return found;
  }

  async photo(name: string): Promise<Uint8Array | null> {
    const { data, error } = await this.db.storage.from("photos").download(name);
    if (error || !data) return null;
    return new Uint8Array(await data.arrayBuffer());
  }

  async track(e: TrackedEvent, dev: boolean): Promise<void> {
    const { error } = await this.db.from("events").insert({ name: e.name, session: e.session, bouquet_id: e.bouquet, props: e.props, dev });
    if (error) this.fail("count the event", error);
  }

  async eventCounts(since: Date, dev: boolean): Promise<EventCount[]> {
    const { data, error } = await this.db.rpc("event_counts", { p_since: since.toISOString(), p_dev: dev });
    if (error) this.fail("load the numbers", error);
    return (data as { name: string; total: number | string; sessions: number | string }[]).map((r) => ({
      name: r.name,
      total: Number(r.total),
      sessions: Number(r.sessions),
    }));
  }

  async eventDaily(since: Date, names: readonly string[], dev: boolean, timeZone: string): Promise<EventDay[]> {
    const { data, error } = await this.db.rpc("event_daily", { p_since: since.toISOString(), p_names: names, p_dev: dev, p_tz: timeZone });
    if (error) this.fail("load the daily numbers", error);
    return (data as { day: string; name: string; total: number | string }[]).map((r) => ({ day: r.day, name: r.name, total: Number(r.total) }));
  }

  async eventBreakdown(since: Date, name: string, key: string, dev: boolean) {
    const { data, error } = await this.db.rpc("event_breakdown", { p_since: since.toISOString(), p_name: name, p_key: key, p_dev: dev });
    if (error) this.fail("load the breakdown", error);
    return (data as { value: string; total: number | string }[]).map((r) => ({ value: r.value, total: Number(r.total) }));
  }

  async unread(userId: string): Promise<number> {
    const { count, error } = await this.db
      .from("bouquets")
      .select("id", { count: "exact", head: true })
      .eq("recipient_id", userId)
      .is("read_at", null);
    if (error) this.fail("count the inbox", error);
    return count ?? 0;
  }
}

/** Development-only store: a JSON file under .data/ (gitignored). */
class DevFileStore implements BouquetStore {
  private file = path.join(process.cwd(), ".data", "bouquets.json");
  private rates = new Map<string, number>();
  /** Serialises read-modify-write so concurrent saves can't overwrite each other. */
  private queue: Promise<unknown> = Promise.resolve();

  private async read(): Promise<Record<string, StoredBouquet>> {
    try {
      return JSON.parse(await fs.readFile(this.file, "utf8"));
    } catch {
      return {};
    }
  }

  create(b: NewBouquet, to: Addressing = { senderId: null, recipientId: null }): Promise<StoredBouquet> {
    const run = this.queue.then(async () => {
      const all = await this.read();
      let id = newBouquetId();
      while (all[id]) id = newBouquetId();
      const { lock, lockHash, ...rest } = b;
      const row: StoredBouquet = {
        id,
        ...rest,
        ...to,
        sealStyle: b.sealStyle ?? null,
        garden: b.garden ?? false,
        month: b.month ?? null,
        photo: b.photo ?? null,
        lockQuestion: lockHash ? (lock?.question ?? null) : null,
        lockHash: lockHash ?? null,
        readAt: null,
        alphabetV: 2,
        createdAt: new Date().toISOString(),
      };
      all[id] = row;
      await fs.mkdir(path.dirname(this.file), { recursive: true });
      // write-then-rename, so a reader never sees a half-written file
      const tmp = `${this.file}.${process.pid}.${Date.now()}.tmp`;
      await fs.writeFile(tmp, JSON.stringify(all, null, 2));
      await fs.rename(tmp, this.file);
      return row;
    });
    this.queue = run.catch(() => {});
    return run;
  }

  async get(id: string): Promise<StoredBouquet | null> {
    const row = (await this.read())[id];
    if (!row) return null;
    return {
      ...row,
      kind: row.kind ?? "bouquet",
      paper: row.paper ?? 0,
      cipherKey: row.cipherKey ?? null,
      seal: row.seal ?? null,
      senderId: row.senderId ?? null,
      recipientId: row.recipientId ?? null,
      replyTo: row.replyTo ?? null,
      readAt: row.readAt ?? null,
      sealStyle: row.sealStyle ?? null,
      garden: row.garden ?? false,
      month: row.month ?? null,
      photo: row.photo ?? null,
      lockQuestion: row.lockQuestion ?? null,
      lockHash: row.lockHash ?? null,
    };
  }

  async bumpRate(ipHash: string): Promise<number> {
    const windowKey = `${ipHash}:${Math.floor(Date.now() / 600_000)}`;
    const n = (this.rates.get(windowKey) ?? 0) + 1;
    this.rates.set(windowKey, n);
    return n;
  }

  // No accounts without Supabase.
  async profile() {
    return null;
  }
  async setDisplayName() {}
  async setSealStyle() {}
  async sent() {
    return [];
  }
  async inbox() {
    return [];
  }
  async kept() {
    return [];
  }
  async keep() {}
  async markRead() {}
  async unread() {
    return 0;
  }
  // (the file store is only ever local, so it's all test runs)
  async garden(): Promise<StoredBouquet[]> {
    return Object.values(await this.read())
      .filter((b) => b.garden)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }
  async savePhoto(name: string, bytes: Uint8Array): Promise<void> {
    const dir = path.join(path.dirname(this.file), "photos");
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, name), bytes);
  }
  async photosThatExist(names: readonly string[]): Promise<Set<string>> {
    const found = new Set<string>();
    for (const n of names) if (await this.photo(n)) found.add(n);
    return found;
  }
  async photo(name: string): Promise<Uint8Array | null> {
    try {
      return new Uint8Array(await fs.readFile(path.join(path.dirname(this.file), "photos", name)));
    } catch {
      return null;
    }
  }
  // No analytics without Supabase either.
  async track() {}
  async eventCounts() {
    return [];
  }
  async eventDaily() {
    return [];
  }
  async eventBreakdown() {
    return [];
  }
}

let store: BouquetStore | null = null;

export function getStore(): BouquetStore {
  if (store) return store;
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && key) {
    store = new SupabaseStore(createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }));
  } else if (process.env.NODE_ENV !== "production") {
    store = new DevFileStore();
  } else {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in production.");
  }
  return store;
}
