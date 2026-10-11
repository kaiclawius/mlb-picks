import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Keypair, PublicKey, VersionedTransaction } from '@solana/web3.js';
import bs58 from 'bs58';
import nacl from 'tweetnacl';
import { createApp } from '../src/app.js';
import { loadConfig, type Config } from '../src/config.js';
import { openDb } from '../src/db.js';
import { clearGateCache } from '../src/gate.js';
import type { Moderate } from '../src/moderation.js';
import type { Rpc } from '../src/rpc.js';
import type { SiteSpec } from '../src/spec.js';
import { bondingCurveOf, PUMP_PROGRAM } from '../src/transparency.js';

export const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
export const GATE_MINT = Keypair.generate().publicKey.toBase58();

export const kp = () => Keypair.generate();

/** Eine kleine Fake-Blockchain, die genau die RPC-Methoden der App beantwortet. */
export class MockChain {
  balances = new Map<string, number>();
  accounts = new Map<string, unknown>();
  txs = new Map<string, unknown>();
  largest: { address: string; amount: string }[] = [];
  failBalance = false;
  calls: string[] = [];

  rpc: Rpc = async <T>(method: string, params: unknown[] = []): Promise<T> => {
    this.calls.push(method);
    switch (method) {
      case 'getTokenAccountsByOwner': {
        if (this.failBalance) throw new Error('rpc down');
        const amount = this.balances.get(params[0] as string) ?? 0;
        const value = amount > 0 ? [{ account: { data: { parsed: { info: { tokenAmount: { uiAmountString: String(amount) } } } } } }] : [];
        return { value } as T;
      }
      case 'getLatestBlockhash':
        return { value: { blockhash: PublicKey.default.toBase58(), lastValidBlockHeight: 1000 } } as T;
      case 'getTransaction':
        return (this.txs.get(params[0] as string) ?? null) as T;
      case 'getAccountInfo':
        return { value: this.accounts.get(params[0] as string) ?? null } as T;
      case 'getTokenLargestAccounts':
        return { value: this.largest } as T;
      case 'getMultipleAccounts':
        return { value: (params[0] as string[]).map((a) => this.accounts.get(a) ?? null) } as T;
      default:
        throw new Error(`Mock kennt ${method} nicht`);
    }
  };

  /** Simuliert: Nutzer signiert die vorbereitete Transaktion, sie landet auf der Chain. Gibt die Signatur zurück. */
  land(base64Tx: string, user: Keypair, opts: { err?: unknown; withCurve?: boolean } = {}): string {
    const tx = VersionedTransaction.deserialize(Buffer.from(base64Tx, 'base64'));
    tx.sign([user]);
    const signature = bs58.encode(tx.signatures[0]);
    const m = tx.message;
    const keys = m.staticAccountKeys.map((k) => k.toBase58());
    this.txs.set(signature, {
      meta: { err: opts.err ?? null },
      transaction: {
        signatures: tx.signatures.map((s) => bs58.encode(s)),
        message: {
          accountKeys: keys,
          header: { numRequiredSignatures: m.header.numRequiredSignatures },
          instructions: m.compiledInstructions.map((i) => ({ programIdIndex: i.programIdIndex })),
        },
      },
    });
    const mint = keys.find((k, i) => i < m.header.numRequiredSignatures && k !== user.publicKey.toBase58())!;
    if (opts.withCurve !== false) this.accounts.set(bondingCurveOf(mint), { owner: PUMP_PROGRAM });
    return signature;
  }
}

export interface Env {
  cfg: Config;
  chain: MockChain;
  app: ReturnType<typeof createApp>;
  db: ReturnType<typeof openDb>;
  moderateCalls: number;
  setModerate(m: Moderate): void;
}

export function makeEnv(extra: Record<string, string> = {}): Env {
  clearGateCache();
  const dir = mkdtempSync(join(tmpdir(), 'launchpad-'));
  const cfg = loadConfig({
    PUBLIC_URL: 'http://localhost:3000',
    SESSION_SECRET: 'x'.repeat(40),
    DATA_DIR: dir,
    GATE_MINT,
    GATE_TIERS: '100:1,1000:5',
    ...extra,
  });
  const chain = new MockChain();
  const db = openDb(':memory:');
  let moderate: Moderate = async () => ({ allowed: true, reasons: [] });
  const env: Env = {
    cfg, chain, db,
    moderateCalls: 0,
    setModerate: (m) => { moderate = m; },
    app: createApp({
      cfg, db, rpc: chain.rpc,
      generate: async ({ idea, name, symbol }): Promise<SiteSpec> => ({
        name: name || 'Test Coin', symbol: (symbol || 'TST').toUpperCase(), tagline: 'Tagline', about: idea,
        features: [{ title: 'A', text: 'a' }, { title: 'B', text: 'b' }, { title: 'C', text: 'c' }], mode: 'dark', accent: '#f59f00',
      }),
      moderate: async (i) => { env.moderateCalls++; return moderate(i); },
    }),
  };
  return env;
}

const URL0 = 'http://localhost:3000';
export const url = (p: string) => `${URL0}${p}`;
export const jsonInit = (body: unknown, cookie?: string, extra: Record<string, string> = {}): RequestInit => ({
  method: 'POST',
  headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}), ...extra },
  body: JSON.stringify(body),
});

/** Meldet eine Wallet per Signatur an und gibt das Session-Cookie zurück. */
export async function signIn(env: Env, wallet: Keypair): Promise<string> {
  const address = wallet.publicKey.toBase58();
  const ch = await (await env.app.request(url('/api/auth/nonce'), jsonInit({ address }))).json();
  const signature = Buffer.from(nacl.sign.detached(new TextEncoder().encode(ch.message), wallet.secretKey)).toString('base64');
  const res = await env.app.request(url('/api/auth/verify'), jsonInit({ address, message: ch.message, signature }));
  if (res.status !== 200) throw new Error(`Login fehlgeschlagen: ${res.status} ${await res.text()}`);
  return res.headers.get('set-cookie')!.split(';')[0];
}

export function draftForm(fields: Record<string, string> = {}, images: Buffer[] = [], types: string[] = []): FormData {
  const fd = new FormData();
  fd.append('idea', fields.idea ?? 'Ein Beamter, der jeden Antrag ablehnt');
  if (fields.rights !== 'no') fd.append('rights', 'true');
  for (const [k, v] of Object.entries(fields)) if (!['idea', 'rights'].includes(k)) fd.append(k, v);
  images.forEach((b, i) => fd.append('images', new File([new Uint8Array(b)], `a${i}.png`, { type: types[i] ?? 'image/png' })));
  return fd;
}
