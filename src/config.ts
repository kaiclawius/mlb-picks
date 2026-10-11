import { randomBytes } from 'node:crypto';
import { join } from 'node:path';

export interface Tier {
  min: number;
  perDay: number;
}

export interface Config {
  port: number;
  production: boolean;
  /** Öffentliche URL der App, z. B. https://launch.example.com */
  publicUrl: string;
  appHost: string;
  secureCookies: boolean;
  /** Wenn gesetzt, werden Coin-Seiten unter <id>.<sitesDomain> ausgeliefert */
  sitesDomain?: string;
  rpcUrl: string;
  sessionSecret: string;
  gateMint?: string;
  gateTiers: Tier[];
  allowlist: Set<string>;
  allowlistPerDay: number;
  /** Nur für lokale Entwicklung: jede Wallet bekommt das Allowlist-Kontingent */
  gateOpen: boolean;
  dataDir: string;
  anthropicKey?: string;
  /** Nur für lokale Entwicklung: Moderation überspringen, wenn kein API-Key da ist */
  allowUnmoderated: boolean;
  feeWallet?: string;
  feeLamports: number;
  priorityMicroLamports: number;
  /** Hinter einem Reverse-Proxy: X-Forwarded-For für die Client-IP nutzen */
  trustProxy: boolean;
}

export function parseTiers(raw: string | undefined): Tier[] {
  if (!raw?.trim()) return [];
  const tiers = raw.split(',').map((part) => {
    const [min, perDay] = part.split(':').map((s) => Number(s.trim()));
    if (!Number.isFinite(min) || !Number.isFinite(perDay) || min < 0 || perDay < 1) {
      throw new Error(`Ungültige GATE_TIERS-Angabe "${part}" (erwartet: Mindestbestand:Launches pro Tag)`);
    }
    return { min, perDay };
  });
  return tiers.sort((a, b) => b.min - a.min);
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const production = env.NODE_ENV === 'production';
  const port = Number(env.PORT ?? 3000);
  const publicUrl = (env.PUBLIC_URL ?? `http://localhost:${port}`).replace(/\/+$/, '');
  const url = new URL(publicUrl);

  let sessionSecret = env.SESSION_SECRET;
  if (!sessionSecret) {
    if (production) throw new Error('SESSION_SECRET muss im Produktivbetrieb gesetzt sein (mind. 32 Zeichen).');
    sessionSecret = randomBytes(32).toString('hex'); // nur Entwicklung: Sessions gelten bis zum Neustart
  }
  if (sessionSecret.length < 32) throw new Error('SESSION_SECRET ist zu kurz (mind. 32 Zeichen).');

  if (production && !env.SITES_DOMAIN) {
    throw new Error('SITES_DOMAIN muss im Produktivbetrieb gesetzt sein, damit Coin-Seiten auf einer eigenen Origin laufen.');
  }
  if (production && env.GATE_OPEN === '1') throw new Error('GATE_OPEN=1 ist im Produktivbetrieb nicht erlaubt.');
  if (production && env.ALLOW_UNMODERATED === '1') throw new Error('ALLOW_UNMODERATED=1 ist im Produktivbetrieb nicht erlaubt.');

  const feeLamports = Number(env.FEE_LAMPORTS ?? 0);
  if (feeLamports > 0 && !env.FEE_WALLET) throw new Error('FEE_LAMPORTS ist gesetzt, aber FEE_WALLET fehlt.');

  return {
    port,
    production,
    publicUrl,
    appHost: url.host,
    secureCookies: url.protocol === 'https:',
    sitesDomain: env.SITES_DOMAIN?.toLowerCase() || undefined,
    rpcUrl: env.SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com',
    sessionSecret,
    gateMint: env.GATE_MINT || undefined,
    gateTiers: parseTiers(env.GATE_TIERS),
    allowlist: new Set((env.ALLOWLIST ?? '').split(',').map((s) => s.trim()).filter(Boolean)),
    allowlistPerDay: Number(env.ALLOWLIST_PER_DAY ?? 3),
    gateOpen: env.GATE_OPEN === '1',
    dataDir: env.DATA_DIR ?? join(process.cwd(), 'data'),
    anthropicKey: env.ANTHROPIC_API_KEY || undefined,
    allowUnmoderated: env.ALLOW_UNMODERATED === '1',
    feeWallet: env.FEE_WALLET || undefined,
    feeLamports,
    priorityMicroLamports: Number(env.PRIORITY_MICRO_LAMPORTS ?? 50_000),
    trustProxy: env.TRUST_PROXY === '1',
  };
}
