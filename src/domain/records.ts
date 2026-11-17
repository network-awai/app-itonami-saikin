/**
 * Small helpers shared by the domain modules: id slugs, timestamps and
 * whole-collection reads over the local store.
 */
import type { LocalStore } from "../local-store.js";

export function idSlug(id: string): string {
  return String(id).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export function nowISO(): string {
  return new Date().toISOString();
}

export function isNonEmpty(s: unknown): s is string {
  return typeof s === "string" && s.trim().length > 0;
}

export function isUint(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n) && n >= 0;
}

export function isPositive(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n > 0;
}

export async function getOne<T>(e: LocalStore, collection: string, rkey: string): Promise<{ uri: string; value: T } | null> {
  const r = await e.read({ collection, rkey }).catch(() => ({ records: [] as Array<{ uri: string; value: unknown }> }));
  const rec = r.records[0];
  return rec ? { uri: rec.uri, value: rec.value as T } : null;
}

export async function listAll<T>(e: LocalStore, collection: string, max = 10_000): Promise<Array<{ uri: string; value: T }>> {
  const out: Array<{ uri: string; value: T }> = [];
  let cursor: string | undefined;
  while (out.length < max) {
    const page = await e.read({ collection, cursor, limit: 100 });
    for (const r of page.records) out.push({ uri: r.uri, value: r.value as T });
    if (!page.cursor || page.records.length === 0) break;
    cursor = page.cursor;
  }
  return out;
}

export async function put(e: LocalStore, collection: string, rkey: string, record: object): Promise<string> {
  const receipt = await e.write({ collection, rkey, record: record as Record<string, unknown> });
  return receipt.uri;
}
