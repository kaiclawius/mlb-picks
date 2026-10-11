import { getWallets } from '@wallet-standard/app';
import type { Wallet, WalletAccount } from '@wallet-standard/base';
import bs58 from 'bs58';

interface Access { allowed: boolean; balance: number | null; perDay: number; remaining: number; viaAllowlist: boolean; reason?: string }
interface SiteItem { id: string; status: string; name: string; symbol: string; mint: string | null; url: string | null }
interface Me { address: string | null; access?: Access; sites?: SiteItem[] }
interface Config { gateMint: string | null; gateTiers: { min: number; perDay: number }[]; feeLamports: number; feeWallet: string | null }

// Minimale Typen der Wallet-Standard-Features, die wir brauchen
type Feature<T> = { [k: string]: T };
interface ConnectFeature { connect(): Promise<{ accounts: readonly WalletAccount[] }> }
interface SignMessageFeature { signMessage(i: { account: WalletAccount; message: Uint8Array }): Promise<{ signedMessage: Uint8Array; signature: Uint8Array }[]> }
interface SignAndSendFeature { signAndSendTransaction(i: { account: WalletAccount; transaction: Uint8Array; chain: string }): Promise<{ signature: Uint8Array }[]> }

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const msg = $('msg');
let me: Me = { address: null };
let config: Config;
let wallet: Wallet | null = null;
let account: WalletAccount | null = null;
let draft: { id: string; name: string; symbol: string } | null = null;

const say = (text: string, kind: '' | 'err' | 'ok' = '') => { msg.textContent = text; msg.className = kind; };
const short = (a: string) => `${a.slice(0, 4)}…${a.slice(-4)}`;
const b64 = (b: Uint8Array) => btoa(Array.from(b, (x) => String.fromCharCode(x)).join(''));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function api<T = any>(path: string, init: RequestInit = {}): Promise<{ status: number; data: T }> {
  const res = await fetch(path, { credentials: 'same-origin', ...init });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}
const post = (path: string, body: unknown) =>
  api(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> & { class?: string } = {}, ...kids: (Node | string)[]) {
  const node = document.createElement(tag);
  const { class: cls, ...rest } = props as Record<string, unknown>;
  if (cls) node.className = cls as string;
  Object.assign(node, rest);
  node.append(...kids);
  return node;
}

// --- Wallets ---
const registry = getWallets();
const usable = () =>
  registry.get().filter((w) => ['standard:connect', 'solana:signMessage', 'solana:signAndSendTransaction'].every((f) => f in w.features));

function renderWallets() {
  const list = $('walletList');
  list.replaceChildren();
  if (me.address) return;
  const ws = usable();
  if (!ws.length) {
    $('walletInfo').textContent = 'Keine Solana-Wallet gefunden. Installiere z. B. Phantom oder Solflare und lade die Seite neu.';
    return;
  }
  $('walletInfo').textContent = 'Wähle deine Wallet. Du signierst nur eine Nachricht, es wird kein Geld bewegt.';
  for (const w of ws) {
    const b = el('button', { type: 'button' }, w.name);
    b.onclick = () => signIn(w).catch((e) => say(e.message, 'err'));
    list.append(b);
  }
}
registry.on('register', renderWallets);

async function signIn(w: Wallet) {
  say('Verbinde...');
  const { accounts } = await (w.features['standard:connect'] as ConnectFeature).connect();
  const acc = accounts.find((a) => a.chains.some((c) => c.startsWith('solana:'))) ?? accounts[0];
  if (!acc) throw new Error('Die Wallet hat kein Konto freigegeben.');
  const ch = await post('/api/auth/nonce', { address: acc.address });
  if (ch.status !== 200) throw new Error(ch.data.error ?? 'Anmeldung fehlgeschlagen.');
  say('Bitte signiere die Nachricht in deiner Wallet.');
  const [signed] = await (w.features['solana:signMessage'] as SignMessageFeature).signMessage({
    account: acc,
    message: new TextEncoder().encode(ch.data.message),
  });
  const res = await post('/api/auth/verify', { address: acc.address, message: ch.data.message, signature: b64(signed.signature) });
  if (res.status !== 200) throw new Error(res.data.error ?? 'Anmeldung fehlgeschlagen.');
  wallet = w;
  account = acc;
  me = res.data;
  say('Angemeldet.', 'ok');
  render();
}

// --- Anzeige ---
function renderAccess() {
  const box = $('access');
  box.replaceChildren();
  if (!me.address || !me.access) return;
  const a = me.access;
  box.append(
    el('p', {}, 'Angemeldet als ', el('code', {}, short(me.address)), ' ', el('span', { class: `badge ${a.allowed ? 'ok' : 'bad'}` }, a.allowed ? 'Zugang' : 'Kein Zugang')),
  );
  if (a.allowed) {
    box.append(el('p', { class: 'muted' }, `${a.remaining} von ${a.perDay} Launches in den letzten 24 Stunden übrig.${a.balance !== null ? ` Bestand: ${a.balance.toLocaleString('de-DE')}.` : ''}`));
  } else {
    const need = config.gateTiers.length ? ` Mindestbestand: ${config.gateTiers[config.gateTiers.length - 1].min.toLocaleString('de-DE')} Token.` : '';
    box.append(el('p', { class: 'muted' }, `${a.reason ?? ''}${need}`));
    if (config.gateMint) box.append(el('p', { class: 'muted' }, 'Token-Adresse: ', el('code', {}, config.gateMint)));
  }
}

function renderSites() {
  const list = $('sites');
  list.replaceChildren();
  const sites = me.sites ?? [];
  $('sitesCard').classList.toggle('hidden', sites.length === 0);
  for (const s of sites) {
    const li = el('li', {}, el('strong', {}, `${s.name} ($${s.symbol}) `), el('span', { class: 'badge' }, s.status === 'launched' ? 'gestartet' : 'Entwurf'));
    if (s.url) li.append(' ', el('a', { href: s.url, target: '_blank', rel: 'noopener noreferrer' }, 'Seite'));
    if (s.mint) li.append(' ', el('a', { href: `https://pump.fun/coin/${s.mint}`, target: '_blank', rel: 'noopener noreferrer' }, 'pump.fun'));
    list.append(li);
  }
}

function render() {
  const loggedIn = !!me.address;
  renderWallets();
  renderAccess();
  $('logout').classList.toggle('hidden', !loggedIn);
  $('formCard').classList.toggle('hidden', !(loggedIn && me.access?.allowed));
  renderSites();
}

// --- Entwurf ---
$('form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = $<HTMLButtonElement>('draftBtn');
  btn.disabled = true;
  say('Wird erzeugt und geprüft...');
  try {
    const res = await api('/api/sites', { method: 'POST', body: new FormData($('form') as HTMLFormElement) });
    if (res.status !== 200) throw new Error(res.data.error ?? 'Fehler');
    draft = { id: res.data.id, name: res.data.spec.name, symbol: res.data.spec.symbol };
    ($('preview') as HTMLIFrameElement).src = res.data.preview;
    $('summary').textContent = `${draft.name} ($${draft.symbol})${config.feeLamports ? ` · Plattform-Gebühr: ${(config.feeLamports / 1e9).toFixed(4)} SOL` : ''} · dazu kommen die Netzwerkgebühren von pump.fun und Solana.`;
    ($('ack1') as HTMLInputElement).checked = false;
    ($('ack2') as HTMLInputElement).checked = false;
    $('steps').classList.add('hidden');
    $('result').classList.add('hidden');
    $('launchCard').classList.remove('hidden');
    updateDeploy();
    say('Vorschau ist fertig. Wenn sie passt, kannst du deployen.', 'ok');
    $('launchCard').scrollIntoView({ behavior: 'smooth' });
    me = (await api<Me>('/api/me')).data;
    renderSites();
  } catch (err) {
    say((err as Error).message, 'err');
  }
  btn.disabled = false;
});

function updateDeploy() {
  const ok = ($('ack1') as HTMLInputElement).checked && ($('ack2') as HTMLInputElement).checked && !!draft;
  $<HTMLButtonElement>('deployBtn').disabled = !ok;
}
$('ack1').addEventListener('change', updateDeploy);
$('ack2').addEventListener('change', updateDeploy);

// --- Deploy ---
function step(n: number) {
  $('steps').classList.remove('hidden');
  document.querySelectorAll<HTMLElement>('#steps li').forEach((li) => {
    const s = Number(li.dataset.s);
    li.className = s < n ? 'done' : s === n ? 'active' : '';
  });
}

$('deployBtn').addEventListener('click', async () => {
  if (!draft || !wallet || !account) return;
  const btn = $<HTMLButtonElement>('deployBtn');
  btn.disabled = true;
  try {
    step(1);
    say('Bereite die Transaktion vor...');
    const prep = await post(`/api/sites/${draft.id}/launch/prepare`, {});
    if (prep.status !== 200) throw new Error(prep.data.error ?? 'Vorbereitung fehlgeschlagen.');

    step(2);
    say('Bitte prüfe und bestätige die Transaktion in deiner Wallet. Sie ist nur kurze Zeit gültig.');
    const [sent] = await (wallet.features['solana:signAndSendTransaction'] as SignAndSendFeature).signAndSendTransaction({
      account,
      transaction: unb64(prep.data.transaction),
      chain: 'solana:mainnet',
    });
    const signature = bs58.encode(sent.signature);

    step(3);
    say('Warte auf die Bestätigung durch die Blockchain...');
    let done: { mint: string; siteUrl: string; pumpUrl: string } | null = null;
    for (let i = 0; i < 30 && !done; i++) {
      const res = await post(`/api/sites/${draft.id}/launch/confirm`, { signature });
      if (res.status === 200) done = res.data;
      else if (res.status === 202) await sleep(2000);
      else throw new Error(res.data.error ?? 'Bestätigung fehlgeschlagen.');
    }
    if (!done) throw new Error(`Noch nicht bestätigt. Deine Transaktion: ${signature}. Versuche es in einer Minute erneut.`);

    step(5);
    say('Dein Coin ist live.', 'ok');
    const result = $('result');
    result.replaceChildren(
      el('p', {}, 'Contract-Adresse:'),
      el('p', {}, el('code', {}, done.mint)),
      el('p', {}, el('a', { class: 'btn', href: done.pumpUrl, target: '_blank', rel: 'noopener noreferrer' }, 'Auf pump.fun ansehen'), ' ', el('a', { class: 'btn', href: done.siteUrl, target: '_blank', rel: 'noopener noreferrer' }, 'Deine Seite')),
    );
    result.classList.remove('hidden');
    me = (await api<Me>('/api/me')).data;
    renderAccess();
    renderSites();
  } catch (err) {
    say((err as Error).message, 'err');
    btn.disabled = false;
  }
});

$('logout').addEventListener('click', async () => {
  await post('/api/auth/logout', {});
  me = { address: null };
  wallet = account = null;
  draft = null;
  $('launchCard').classList.add('hidden');
  say('Abgemeldet.');
  render();
});

// --- Start ---
(async () => {
  config = (await api<Config>('/api/config')).data;
  me = (await api<Me>('/api/me')).data;
  render();
})();
