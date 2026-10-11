import { PublicKey } from '@solana/web3.js';
import type { Rpc } from './rpc.js';

export type Status = 'pass' | 'warn' | 'fail' | 'info';

export interface Check {
  id: string;
  label: string;
  status: Status;
  detail: string;
}

export interface Holder {
  address: string;
  amount: number;
  /** Eigentümer des Token-Kontos, falls ermittelt */
  owner?: string;
}

export interface MintFacts {
  mint: string;
  mintAuthority: string | null;
  freezeAuthority: string | null;
  supply: number;
  decimals: number;
  /** Programm, dem der Mint gehört (Token oder Token-2022) */
  tokenProgram: string;
  /** Namen der Token-2022-Erweiterungen, z. B. "permanentDelegate" */
  extensions: string[];
  /** Größte Konten, absteigend sortiert (Rohmengen) */
  largest: Holder[];
}

export const PUMP_PROGRAM = '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P';
export const TOKEN_2022_PROGRAM = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';

const pumpProgram = new PublicKey(PUMP_PROGRAM);
/** Mint-Authority aller pump.fun-Coins: ein vom Programm kontrolliertes PDA, keine Wallet einer Person */
export const PUMP_MINT_AUTHORITY = PublicKey.findProgramAddressSync([Buffer.from('mint-authority')], pumpProgram)[0].toBase58();
export const bondingCurveOf = (mint: string) =>
  PublicKey.findProgramAddressSync([Buffer.from('bonding-curve'), new PublicKey(mint).toBuffer()], pumpProgram)[0].toBase58();

// Erweiterungen, mit denen Ersteller Halter schädigen können
const DANGEROUS: Record<string, string> = {
  permanentDelegate: 'Ein Dritter kann Tokens aus jeder Wallet abziehen.',
  transferHook: 'Jede Übertragung ruft fremden Code auf, der sie blockieren kann.',
  pausableConfig: 'Alle Übertragungen können pausiert werden.',
  nonTransferable: 'Der Token lässt sich nicht übertragen.',
  defaultAccountState: 'Neue Konten können standardmäßig eingefroren sein.',
};
const SUSPICIOUS: Record<string, string> = {
  transferFeeConfig: 'Bei jeder Übertragung wird eine Gebühr abgezogen.',
  mintCloseAuthority: 'Der Mint kann geschlossen werden.',
};

const pct = (n: number) => `${(n * 100).toFixed(1)} %`;
const short = (a: string) => `${a.slice(0, 4)}…${a.slice(-4)}`;

function authorityCheck(id: 'mint' | 'freeze', authority: string | null): Check {
  const noun = id === 'mint' ? 'Mint' : 'Freeze';
  const power = id === 'mint' ? 'neue Tokens erzeugen' : 'Wallets einfrieren';
  if (authority === null) return { id, label: `${noun}-Authority abgegeben`, status: 'pass', detail: id === 'mint' ? 'Es können keine neuen Tokens erzeugt werden.' : 'Wallets können nicht eingefroren werden.' };
  if (authority === PUMP_MINT_AUTHORITY) {
    return { id, label: `${noun}-Authority beim pump.fun-Programm`, status: 'pass', detail: 'Kontrolliert vom Programmcode (PDA), nicht von einer Wallet einer Person.' };
  }
  return { id, label: `${noun}-Authority aktiv`, status: 'fail', detail: `Die Wallet ${short(authority)} kann ${power}.` };
}

/** Reine Auswertung ohne Netzwerk, damit sie sich testen lässt. */
export function analyze(facts: MintFacts): Check[] {
  const checks = [authorityCheck('mint', facts.mintAuthority), authorityCheck('freeze', facts.freezeAuthority)];

  if (facts.tokenProgram === TOKEN_2022_PROGRAM) {
    const bad = facts.extensions.filter((e) => DANGEROUS[e]);
    const odd = facts.extensions.filter((e) => SUSPICIOUS[e]);
    if (bad.length) {
      checks.push({ id: 'extensions', label: 'Gefährliche Token-Erweiterung', status: 'fail', detail: bad.map((e) => `${e}: ${DANGEROUS[e]}`).join(' ') });
    } else if (odd.length) {
      checks.push({ id: 'extensions', label: 'Auffällige Token-Erweiterung', status: 'warn', detail: odd.map((e) => `${e}: ${SUSPICIOUS[e]}`).join(' ') });
    } else {
      checks.push({ id: 'extensions', label: 'Keine gefährlichen Erweiterungen', status: 'pass', detail: 'Weder Permanent Delegate, Transfer Hook noch Pausierung.' });
    }
  }

  if (facts.supply > 0 && facts.largest.length > 0) {
    // Die Bonding Curve hält anfangs fast alles. Sie zählt nicht als Halter, sonst wäre jeder neue Coin "konzentriert".
    const curve = bondingCurveOf(facts.mint);
    const onCurve = facts.largest.filter((h) => h.owner === curve).reduce((s, h) => s + h.amount, 0);
    const circulating = facts.supply - onCurve;
    const holders = facts.largest.filter((h) => h.owner !== curve);

    if (circulating <= 0) {
      checks.push({ id: 'holders', label: 'Verteilung', status: 'info', detail: 'Noch alle Tokens liegen in der Bonding Curve, es gibt keine Halter.' });
    } else if (holders.length === 0) {
      checks.push({ id: 'holders', label: 'Verteilung', status: 'info', detail: 'Die größten Konten konnten nicht aufgeschlüsselt werden.' });
    } else {
      const share = (n: number) => holders.slice(0, n).reduce((s, h) => s + h.amount, 0) / circulating;
      const top1 = share(1);
      const top10 = share(10);
      const concentrated = top1 > 0.3 || top10 > 0.8;
      checks.push({
        id: 'holders',
        label: concentrated ? 'Stark konzentrierte Verteilung' : 'Verteilung',
        status: concentrated ? 'warn' : 'info',
        detail: `Ohne Bonding Curve hält das größte Konto ${pct(top1)}, die Top 10 halten ${pct(top10)} der umlaufenden Tokens.${onCurve > 0 ? ` In der Bonding Curve liegen ${pct(onCurve / facts.supply)} des Gesamtangebots.` : ''}`,
      });
    }
  }
  return checks;
}

export const isMintAddress = (s: string) => {
  try {
    return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s) && new PublicKey(s).toBytes().length === 32;
  } catch {
    return false;
  }
};

interface ParsedMint {
  value: { owner: string; data: { parsed?: { type: string; info: any } } } | null;
}

export async function fetchMintFacts(rpc: Rpc, mint: string): Promise<MintFacts> {
  const account = await rpc<ParsedMint>('getAccountInfo', [mint, { encoding: 'jsonParsed' }]);
  const parsed = account.value?.data?.parsed;
  if (!account.value || !parsed || parsed.type !== 'mint') throw new Error('Die Adresse ist kein Token-Mint.');

  const largest = await rpc<{ value: { address: string; amount: string }[] }>('getTokenLargestAccounts', [mint]);
  const top = largest.value.slice(0, 20);

  // Eigentümer der größten Konten nachladen, um die Bonding Curve herauszurechnen
  const owners = new Map<string, string>();
  if (top.length) {
    try {
      const accs = await rpc<{ value: ({ data: { parsed?: { info?: { owner?: string } } } } | null)[] }>('getMultipleAccounts', [
        top.map((a) => a.address),
        { encoding: 'jsonParsed' },
      ]);
      accs.value.forEach((a, i) => {
        const owner = a?.data?.parsed?.info?.owner;
        if (owner) owners.set(top[i].address, owner);
      });
    } catch {
      /* Ohne Eigentümer fällt der Konzentrations-Check auf "nicht aufschlüsselbar" zurück */
    }
  }

  const info = parsed.info;
  return {
    mint,
    mintAuthority: info.mintAuthority ?? null,
    freezeAuthority: info.freezeAuthority ?? null,
    supply: Number(info.supply),
    decimals: info.decimals,
    tokenProgram: account.value.owner,
    extensions: Array.isArray(info.extensions) ? info.extensions.map((e: { extension: string }) => e.extension) : [],
    largest: top.map((a) => ({ address: a.address, amount: Number(a.amount), owner: owners.get(a.address) })),
  };
}
