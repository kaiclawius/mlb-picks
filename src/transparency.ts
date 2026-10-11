export type Status = 'pass' | 'warn' | 'fail' | 'info';

export interface Check {
  id: string;
  label: string;
  status: Status;
  detail: string;
}

export interface MintFacts {
  mintAuthority: string | null;
  freezeAuthority: string | null;
  supply: number;
  decimals: number;
  /** Größte Konten, absteigend sortiert (Rohmengen, nicht durch decimals geteilt) */
  largest: { address: string; amount: number }[];
}

const pct = (n: number) => `${(n * 100).toFixed(1)} %`;

/** Reine Auswertung ohne Netzwerk, damit sie sich testen lässt. */
export function analyze(facts: MintFacts): Check[] {
  const checks: Check[] = [];

  checks.push(
    facts.mintAuthority === null
      ? { id: 'mint', label: 'Mint-Authority abgegeben', status: 'pass', detail: 'Es können keine neuen Tokens erzeugt werden.' }
      : { id: 'mint', label: 'Mint-Authority aktiv', status: 'fail', detail: `${facts.mintAuthority} kann beliebig neue Tokens erzeugen.` },
  );
  checks.push(
    facts.freezeAuthority === null
      ? { id: 'freeze', label: 'Freeze-Authority abgegeben', status: 'pass', detail: 'Wallets können nicht eingefroren werden.' }
      : { id: 'freeze', label: 'Freeze-Authority aktiv', status: 'fail', detail: `${facts.freezeAuthority} kann Wallets einfrieren.` },
  );

  if (facts.supply > 0 && facts.largest.length > 0) {
    const share = (n: number) => facts.largest.slice(0, n).reduce((s, a) => s + a.amount, 0) / facts.supply;
    const top1 = share(1);
    const top10 = share(10);
    checks.push({
      id: 'holders',
      label: 'Verteilung der größten Konten',
      status: top10 > 0.9 ? 'warn' : 'info',
      detail: `Größtes Konto: ${pct(top1)}, Top 10: ${pct(top10)}. Liquiditätspools und Bonding Curves sind hier mitgezählt und oft das größte Konto.`,
    });
  }
  return checks;
}

async function rpc<T>(url: string, method: string, params: unknown[]): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`RPC ${method}: HTTP ${res.status}`);
  const json = (await res.json()) as { result?: T; error?: { message: string } };
  if (json.error || json.result === undefined) throw new Error(`RPC ${method}: ${json.error?.message ?? 'keine Antwort'}`);
  return json.result;
}

export const isMintAddress = (s: string) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s);

export async function fetchMintFacts(rpcUrl: string, mint: string): Promise<MintFacts> {
  const account = await rpc<{ value: { data: { parsed?: { type: string; info: any } } } | null }>(rpcUrl, 'getAccountInfo', [
    mint,
    { encoding: 'jsonParsed' },
  ]);
  const parsed = account.value?.data?.parsed;
  if (!parsed || parsed.type !== 'mint') throw new Error('Die Adresse ist kein Token-Mint.');

  const largest = await rpc<{ value: { address: string; amount: string }[] }>(rpcUrl, 'getTokenLargestAccounts', [mint]);
  return {
    mintAuthority: parsed.info.mintAuthority ?? null,
    freezeAuthority: parsed.info.freezeAuthority ?? null,
    supply: Number(parsed.info.supply),
    decimals: parsed.info.decimals,
    largest: largest.value.map((a) => ({ address: a.address, amount: Number(a.amount) })),
  };
}
