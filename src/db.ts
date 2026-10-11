import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { SiteSpec } from './spec.js';

export type SiteStatus = 'draft' | 'prepared' | 'launched';

export interface SiteRow {
  id: string;
  owner: string;
  status: SiteStatus;
  spec: SiteSpec;
  /** Öffentliche Bild-URLs relativ zur Site, z. B. img-0.png */
  images: string[];
  mint: string | null;
  pendingMint: string | null;
  signature: string | null;
  createdAt: number;
  launchedAt: number | null;
}

export interface Db {
  raw: DatabaseSync;
  close(): void;
  saveNonce(nonce: string, address: string, issuedAt: number, expiresAt: number): void;
  takeNonce(nonce: string, address: string): { issuedAt: number; expiresAt: number } | null;
  insertSite(site: Pick<SiteRow, 'id' | 'owner' | 'spec' | 'images'>): void;
  getSite(id: string): SiteRow | null;
  listSites(owner: string): SiteRow[];
  setPending(id: string, mint: string): void;
  markLaunched(id: string, mint: string, signature: string): void;
  logEvent(wallet: string, kind: string): void;
  countEvents(wallet: string, kind: string, sinceMs: number): number;
}

interface RawSite {
  id: string; owner: string; status: SiteStatus; spec: string; images: string;
  mint: string | null; pending_mint: string | null; signature: string | null;
  created_at: number; launched_at: number | null;
}

const toSite = (r: RawSite): SiteRow => ({
  id: r.id, owner: r.owner, status: r.status, spec: JSON.parse(r.spec), images: JSON.parse(r.images),
  mint: r.mint, pendingMint: r.pending_mint, signature: r.signature, createdAt: r.created_at, launchedAt: r.launched_at,
});

export function openDb(path: string): Db {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS nonces (nonce TEXT PRIMARY KEY, address TEXT NOT NULL, issued_at INTEGER NOT NULL, expires_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS sites (
      id TEXT PRIMARY KEY, owner TEXT NOT NULL, status TEXT NOT NULL, spec TEXT NOT NULL, images TEXT NOT NULL,
      mint TEXT UNIQUE, pending_mint TEXT, signature TEXT UNIQUE, created_at INTEGER NOT NULL, launched_at INTEGER
    );
    CREATE INDEX IF NOT EXISTS sites_owner ON sites(owner);
    CREATE TABLE IF NOT EXISTS events (id INTEGER PRIMARY KEY AUTOINCREMENT, wallet TEXT NOT NULL, kind TEXT NOT NULL, ts INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS events_lookup ON events(wallet, kind, ts);
  `);

  return {
    raw: db,
    close: () => db.close(),
    saveNonce(nonce, address, issuedAt, expiresAt) {
      db.prepare('DELETE FROM nonces WHERE expires_at < ?').run(Date.now());
      db.prepare('INSERT INTO nonces (nonce, address, issued_at, expires_at) VALUES (?, ?, ?, ?)').run(nonce, address, issuedAt, expiresAt);
    },
    // Einmal-Nonce: wird beim ersten Versuch verbraucht, egal ob die Signatur danach stimmt
    takeNonce(nonce, address) {
      const row = db.prepare('SELECT issued_at, expires_at FROM nonces WHERE nonce = ? AND address = ?').get(nonce, address) as
        | { issued_at: number; expires_at: number }
        | undefined;
      db.prepare('DELETE FROM nonces WHERE nonce = ?').run(nonce);
      return row ? { issuedAt: row.issued_at, expiresAt: row.expires_at } : null;
    },
    insertSite({ id, owner, spec, images }) {
      db.prepare('INSERT INTO sites (id, owner, status, spec, images, created_at) VALUES (?, ?, ?, ?, ?, ?)')
        .run(id, owner, 'draft', JSON.stringify(spec), JSON.stringify(images), Date.now());
    },
    getSite(id) {
      const r = db.prepare('SELECT * FROM sites WHERE id = ?').get(id) as RawSite | undefined;
      return r ? toSite(r) : null;
    },
    listSites(owner) {
      return (db.prepare('SELECT * FROM sites WHERE owner = ? ORDER BY created_at DESC LIMIT 50').all(owner) as unknown as RawSite[]).map(toSite);
    },
    setPending(id, mint) {
      db.prepare("UPDATE sites SET pending_mint = ?, status = 'prepared' WHERE id = ? AND status != 'launched'").run(mint, id);
    },
    markLaunched(id, mint, signature) {
      db.prepare("UPDATE sites SET mint = ?, signature = ?, status = 'launched', launched_at = ? WHERE id = ? AND status != 'launched'")
        .run(mint, signature, Date.now(), id);
    },
    logEvent(wallet, kind) {
      db.prepare('INSERT INTO events (wallet, kind, ts) VALUES (?, ?, ?)').run(wallet, kind, Date.now());
    },
    countEvents(wallet, kind, sinceMs) {
      const r = db.prepare('SELECT COUNT(*) AS n FROM events WHERE wallet = ? AND kind = ? AND ts >= ?').get(wallet, kind, Date.now() - sinceMs) as { n: number };
      return r.n;
    },
  };
}
