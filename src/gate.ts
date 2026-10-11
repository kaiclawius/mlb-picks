import type { Config } from './config.js';
import type { Db } from './db.js';
import type { Rpc } from './rpc.js';

export interface Access {
  allowed: boolean;
  balance: number | null;
  /** Erlaubte Launches pro 24 Stunden */
  perDay: number;
  remaining: number;
  viaAllowlist: boolean;
  reason?: string;
}

// Einen Bestand von 0 nur kurz merken: wer gerade Tokens gekauft hat, soll nicht lange warten müssen
const CACHE_MS = 60_000;
const CACHE_ZERO_MS = 10_000;
const cache = new Map<string, { at: number; balance: number }>();

export async function tokenBalance(cfg: Config, rpc: Rpc, wallet: string, fresh: boolean): Promise<number> {
  if (!cfg.gateMint) return 0;
  const key = `${cfg.gateMint}:${wallet}`;
  const hit = cache.get(key);
  if (!fresh && hit && Date.now() - hit.at < (hit.balance > 0 ? CACHE_MS : CACHE_ZERO_MS)) return hit.balance;

  const res = await rpc<{ value: { account: { data: { parsed: { info: { tokenAmount: { uiAmountString: string } } } } } }[] }>(
    'getTokenAccountsByOwner',
    [wallet, { mint: cfg.gateMint }, { encoding: 'jsonParsed' }],
  );
  const balance = res.value.reduce((sum, a) => sum + Number(a.account.data.parsed.info.tokenAmount.uiAmountString), 0);
  cache.set(key, { at: Date.now(), balance });
  return balance;
}

export function clearGateCache(): void {
  cache.clear();
}

/** `fresh` umgeht den Cache. Wird beim Launch genutzt, damit ein kurzzeitig geliehener Bestand nicht reicht. */
export async function getAccess(cfg: Config, db: Db, rpc: Rpc, wallet: string, opts: { fresh?: boolean } = {}): Promise<Access> {
  const viaAllowlist = cfg.allowlist.has(wallet) || cfg.gateOpen;
  let balance: number | null = null;
  let perDay = viaAllowlist ? cfg.allowlistPerDay : 0;

  if (cfg.gateMint) {
    try {
      balance = await tokenBalance(cfg, rpc, wallet, opts.fresh ?? false);
    } catch (e) {
      // Fail closed: ohne gesicherten Bestand gibt es nur den Allowlist-Zugang
      if (!viaAllowlist) {
        return { allowed: false, balance: null, perDay: 0, remaining: 0, viaAllowlist, reason: 'Der Token-Bestand konnte nicht geprüft werden. Bitte später erneut versuchen.' };
      }
    }
    const tier = cfg.gateTiers.find((t) => balance !== null && balance >= t.min);
    if (tier) perDay = Math.max(perDay, tier.perDay);
  }

  const used = db.countEvents(wallet, 'launch', 24 * 60 * 60 * 1000);
  const remaining = Math.max(0, perDay - used);
  const allowed = perDay > 0;
  return {
    allowed,
    balance,
    perDay,
    remaining,
    viaAllowlist,
    reason: allowed ? undefined : cfg.gateMint ? 'Dir fehlt der nötige Bestand am Plattform-Token.' : 'Diese Wallet steht nicht auf der Zugangsliste.',
  };
}
