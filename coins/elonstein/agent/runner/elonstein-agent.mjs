#!/usr/bin/env node
// ELONSTEIN AGENT — a Solana memecoin trading agent that never asks and only calls when it's broke.
//
//   node elonstein-agent.mjs                    # uses ./elonstein-agent.config.json
//   node elonstein-agent.mjs path/to/config.json
//
// Paper mode by default. Live mode needs: "mode": "live" in the config AND the environment variable
//   LIVE_CONFIRM="I accept that this agent can lose the entire budget."
// The agent creates its own wallet (agent-wallet.json) on first run. Fund only that address.
// Optional Telegram: TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID. Commands: STATUS, STOP, START.

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const SOL_MINT = 'So11111111111111111111111111111111111111112';
export const LAMPORTS = 1_000_000_000;
const CONFIRM_SENTENCE = 'I accept that this agent can lose the entire budget.';
const JUP = 'https://lite-api.jup.ag/swap/v1';
const DEX = 'https://api.dexscreener.com';
const FEE_RESERVE_SOL = 0.01;   // always keep this much SOL for fees
const MIN_TRADE_SOL = 0.005;

export const DEFAULTS = {
  name: 'AGENT-01', personality: 'degen', risk: 7, mode: 'paper',
  budgetSol: 0.5, maxTradePct: 20, takeProfitPct: 60, stopLossPct: 30,
  intervalSec: 60, maxTradesPerDay: 30, maxOpenPositions: 0,
  source: 'trending', elonsteinMint: '', minLiquidityUsd: 10000, minAgeMinutes: 15,
  slippageBps: 300, rpcUrl: 'https://api.mainnet-beta.solana.com', paperStartSol: 0
};

const VOICE = {
  degen: ['chart looked like a rocket', 'vibes were immaculate', 'saw a green candle, felt something', 'it was 3am, enough said'],
  conspiracy: ['the numbers aligned', 'a 9 appeared three times', 'whales are signalling', 'the dev’s cat blinked twice'],
  maxi: ['there is only one coin', 'conviction', 'buying the dip on the only chart that matters'],
  paper: ['quick in, quick out', 'nervous but optimistic', 'one small trade, then a lie-down']
};
const pick = a => a[Math.floor(Math.random() * a.length)];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const now = () => new Date().toISOString().replace('T', ' ').slice(0, 19);

/* ---------------- config ---------------- */
export function loadConfig(file){
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  const c = { ...DEFAULTS, ...raw };
  c.risk = Math.min(10, Math.max(1, Number(c.risk) || 5));
  c.maxTradePct = Math.min(100, Math.max(1, Number(c.maxTradePct) || 20));
  c.budgetSol = Math.max(0, Number(c.budgetSol) || 0);
  if(!['degen', 'conspiracy', 'maxi', 'paper'].includes(c.personality)) c.personality = 'degen';
  if(!c.maxOpenPositions) c.maxOpenPositions = 1 + Math.floor(c.risk / 4);
  if(!c.paperStartSol) c.paperStartSol = c.budgetSol;
  return c;
}
// personality shapes the exits
export function exits(c){
  const k = { degen: [1.2, 1.2], conspiracy: [1, 1], maxi: [2, 1.6], paper: [.4, .35] }[c.personality];
  return { tp: c.takeProfitPct * k[0], sl: c.stopLossPct * k[1] };
}
export function tradeSize(c, availableSol){
  const pct = c.maxTradePct / 100 * (.4 + c.risk * .06);
  const size = Math.min(availableSol, availableSol * pct);
  if(size >= MIN_TRADE_SOL) return size;
  return availableSol >= MIN_TRADE_SOL ? availableSol : 0;   // the last bullet: all in
}

/* ---------------- market data ---------------- */
async function getJSON(url, opts){
  const r = await fetch(url, opts);
  if(!r.ok) throw new Error(`${r.status} ${url.split('?')[0]}`);
  return r.json();
}
export async function candidates(c){
  let mints = [];
  if(c.source === 'elonstein-only' || c.personality === 'maxi'){
    if(!c.elonsteinMint) throw new Error('elonsteinMint is empty: set the $ELONSTEIN contract address in the config');
    mints = [c.elonsteinMint];
  } else {
    const url = c.source === 'new' ? `${DEX}/token-profiles/latest/v1` : `${DEX}/token-boosts/top/v1`;
    const list = await getJSON(url);
    mints = [...new Set(list.filter(t => t.chainId === 'solana').map(t => t.tokenAddress))].slice(0, 30);
  }
  if(!mints.length) return [];
  const pairs = await getJSON(`${DEX}/tokens/v1/solana/${mints.join(',')}`);
  // best (most liquid) pair per token
  const best = new Map();
  for(const p of pairs){
    const m = p.baseToken?.address; if(!m || m === SOL_MINT) continue;
    if(!best.has(m) || (p.liquidity?.usd || 0) > (best.get(m).liquidity?.usd || 0)) best.set(m, p);
  }
  const minAge = Date.now() - c.minAgeMinutes * 60_000;
  return [...best.values()].filter(p => (p.liquidity?.usd || 0) >= c.minLiquidityUsd && (!p.pairCreatedAt || p.pairCreatedAt <= minAge));
}
export function score(c, p){
  const ch = p.priceChange || {}, r = Math.random();
  switch(c.personality){
    case 'degen': return (ch.m5 || 0) + (ch.h1 || 0) * .5 + r * 10;
    case 'conspiracy': { const s = (p.baseToken.symbol || '') + p.baseToken.address; return (/9/.test(s) ? 8 : 0) + (/42|69/.test(s) ? 12 : 0) + ((p.baseToken.symbol || '').length === 3 ? 6 : 0) + r * 15; }
    case 'maxi': return -(ch.h1 || 0) + r;             // likes dips
    case 'paper': return Math.log10((p.liquidity?.usd || 1)) * 4 + (ch.h1 || 0) * .2 + r * 3;
  }
  return r;
}
export async function quote(inMint, outMint, amountRaw, slippageBps){
  const u = `${JUP}/quote?inputMint=${inMint}&outputMint=${outMint}&amount=${BigInt(Math.floor(Number(amountRaw)))}&slippageBps=${slippageBps}&restrictIntermediateTokens=true`;
  return getJSON(u);
}

/* ---------------- wallet + chain (live mode only) ---------------- */
async function solana(){ return import('@solana/web3.js'); }
export async function loadWallet(dir){
  const web3 = await solana();
  const f = path.join(dir, 'agent-wallet.json');
  if(!fs.existsSync(f)){
    const kp = web3.Keypair.generate();
    fs.writeFileSync(f, JSON.stringify(Array.from(kp.secretKey)), { mode: 0o600 });
    console.log(`\n[${now()}] ⚡ New agent wallet created: ${f}\n    Address: ${kp.publicKey.toBase58()}\n    Fund ONLY this address with what you are fine losing. Never put your main wallet's key here.\n`);
  }
  return web3.Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(f, 'utf8'))));
}
async function swapLive(conn, kp, q){
  const web3 = await solana();
  const { swapTransaction } = await getJSON(`${JUP}/swap`, { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ quoteResponse: q, userPublicKey: kp.publicKey.toBase58(), wrapAndUnwrapSol: true, dynamicComputeUnitLimit: true, prioritizationFeeLamports: 'auto' }) });
  const tx = web3.VersionedTransaction.deserialize(Buffer.from(swapTransaction, 'base64'));
  tx.sign([kp]);
  const sig = await conn.sendRawTransaction(tx.serialize(), { skipPreflight: false, maxRetries: 3 });
  const bh = await conn.getLatestBlockhash();
  const res = await conn.confirmTransaction({ signature: sig, ...bh }, 'confirmed');
  if(res.value.err) throw new Error('swap failed on-chain: ' + JSON.stringify(res.value.err));
  return sig;
}
async function tokenBalanceRaw(conn, owner, mint){
  const web3 = await solana();
  const r = await conn.getParsedTokenAccountsByOwner(owner, { mint: new web3.PublicKey(mint) });
  return r.value.reduce((s, a) => s + BigInt(a.account.data.parsed.info.tokenAmount.amount), 0n);
}

/* ---------------- notifications ---------------- */
function telegram(){
  const token = process.env.TELEGRAM_BOT_TOKEN, chat = process.env.TELEGRAM_CHAT_ID;
  if(!token || !chat) return null;
  let offset = 0;
  return {
    send: text => getJSON(`https://api.telegram.org/bot${token}/sendMessage`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ chat_id: chat, text }) }).catch(e => console.log('telegram:', e.message)),
    async commands(){
      try{
        const r = await getJSON(`https://api.telegram.org/bot${token}/getUpdates?timeout=0&offset=${offset}`);
        const out = [];
        for(const u of r.result || []){ offset = u.update_id + 1; const m = u.message; if(m && String(m.chat.id) === String(chat)) out.push((m.text || '').trim().toUpperCase()); }
        return out;
      }catch(e){ return []; }
    }
  };
}

/* ---------------- the agent ---------------- */
export function createAgent(c, deps = {}){
  const dir = deps.dir || process.cwd();
  const statePath = path.join(dir, 'agent-state.json'), logPath = path.join(dir, 'agent-log.jsonl');
  const live = c.mode === 'live';
  const tg = deps.telegram === undefined ? telegram() : deps.telegram;
  let st = fs.existsSync(statePath) ? JSON.parse(fs.readFileSync(statePath, 'utf8'))
    : { paperSol: c.paperStartSol, spentSol: 0, positions: [], tradesToday: 0, day: new Date().toDateString(), broke: false, stopped: false, totalTrades: 0 };
  const save = () => fs.writeFileSync(statePath, JSON.stringify(st, null, 2));
  const log = (o) => { fs.appendFileSync(logPath, JSON.stringify({ t: now(), ...o }) + '\n'); };
  const say = (m) => console.log(`[${now()}] ${c.name}: ${m}`);
  const notify = (m) => { say(m); if(tg) tg.send(`${c.name}: ${m}`); };
  let conn = null, kp = null;

  async function init(){
    if(live){
      if(process.env.LIVE_CONFIRM !== CONFIRM_SENTENCE) throw new Error(`Live mode needs LIVE_CONFIRM="${CONFIRM_SENTENCE}"`);
      const web3 = await solana();
      conn = new web3.Connection(process.env.RPC_URL || c.rpcUrl, 'confirmed');
      kp = await loadWallet(dir);
      say(`LIVE. Wallet ${kp.publicKey.toBase58()}. Budget ${c.budgetSol} SOL.`);
    } else say(`PAPER mode. Virtual balance ${st.paperSol.toFixed(4)} SOL. Nothing real is traded.`);
    say(`Personality: ${c.personality}. Risk ${c.risk}/10. I will not ask. I will call when I'm broke.`);
  }
  async function walletSol(){ return live ? (await conn.getBalance(kp.publicKey)) / LAMPORTS : st.paperSol; }
  async function available(){
    const w = await walletSol();
    const budgetLeft = c.budgetSol - st.spentSol;
    return Math.max(0, Math.min(w - (live ? FEE_RESERVE_SOL : 0), budgetLeft));
  }
  async function buy(p, sizeSol){
    const q = await quote(SOL_MINT, p.baseToken.address, Math.floor(sizeSol * LAMPORTS), c.slippageBps);
    let sig = 'paper';
    if(live) sig = await swapLive(conn, kp, q); else st.paperSol -= sizeSol;
    st.spentSol += sizeSol;
    st.positions.push({ mint: p.baseToken.address, symbol: p.baseToken.symbol, costSol: sizeSol, amountRaw: q.outAmount, at: Date.now() });
    st.tradesToday++; st.totalTrades++;
    const why = pick(VOICE[c.personality]);
    say(`BUY ${p.baseToken.symbol} for ${sizeSol.toFixed(4)} SOL · ${why}`);
    log({ side: 'buy', mint: p.baseToken.address, symbol: p.baseToken.symbol, sol: sizeSol, amountRaw: q.outAmount, sig, why });
  }
  async function sell(pos, reason, valueSol, q){
    let sig = 'paper', amount = pos.amountRaw;
    if(live){
      const bal = await tokenBalanceRaw(conn, kp.publicKey, pos.mint);
      if(bal === 0n){ st.positions = st.positions.filter(x => x !== pos); return; }
      amount = bal.toString();
      q = await quote(pos.mint, SOL_MINT, amount, c.slippageBps);
      sig = await swapLive(conn, kp, q);
      valueSol = Number(q.outAmount) / LAMPORTS;
    } else st.paperSol += valueSol;
    st.spentSol -= valueSol;                       // money back into the budget
    st.positions = st.positions.filter(x => x !== pos);
    st.tradesToday++; st.totalTrades++;
    const pnl = (valueSol / pos.costSol - 1) * 100;
    say(`SELL ${pos.symbol} · ${reason} · ${pnl >= 0 ? '+' : ''}${pnl.toFixed(1)}%`);
    log({ side: 'sell', mint: pos.mint, symbol: pos.symbol, sol: valueSol, pnlPct: pnl, reason, sig });
  }
  async function status(){
    const w = await walletSol();
    const lines = [`${live ? 'LIVE' : 'PAPER'} · balance ${w.toFixed(4)} SOL · budget used ${st.spentSol.toFixed(4)}/${c.budgetSol} SOL · trades ${st.totalTrades}`];
    for(const p of st.positions) lines.push(`holding ${p.symbol} (cost ${p.costSol.toFixed(4)} SOL)`);
    return lines.join('\n');
  }
  async function handleCommands(){
    if(!tg) return;
    for(const cmd of await tg.commands()){
      if(cmd === 'STOP'){ st.stopped = true; notify('Stopped. You’ll miss me.'); }
      else if(cmd === 'START'){ st.stopped = false; st.broke = false; notify('Back. Don’t ask.'); }
      else if(cmd === 'STATUS'){ tg.send(await status()); }
    }
  }
  async function step(){
    if(st.day !== new Date().toDateString()){ st.day = new Date().toDateString(); st.tradesToday = 0; }
    await handleCommands();
    const { tp, sl } = exits(c);
    // 1. manage open positions
    for(const pos of [...st.positions]){
      try{
        const q = await quote(pos.mint, SOL_MINT, pos.amountRaw, c.slippageBps);
        const value = Number(q.outAmount) / LAMPORTS, pnl = (value / pos.costSol - 1) * 100;
        if(pnl >= tp) await sell(pos, 'take profit', value, q);
        else if(pnl <= -sl) await sell(pos, 'stop loss', value, q);
      }catch(e){ say(`could not price ${pos.symbol}: ${e.message}`); }
    }
    if(st.stopped) return save();
    // 2. broke?
    const avail = await available();
    if(!st.positions.length && avail < MIN_TRADE_SOL){
      if(!st.broke){ st.broke = true; notify(`Boss. Need more SOL. Don’t ask.\n${await status()}`); }
      return save();
    }
    if(st.broke && avail >= MIN_TRADE_SOL){ st.broke = false; say('Refuelled. Resuming. Don’t ask.'); }
    // 3. open a new position
    if(st.tradesToday >= c.maxTradesPerDay || st.positions.length >= c.maxOpenPositions) return save();
    const size = tradeSize(c, avail);
    if(!size) return save();
    const held = new Set(st.positions.map(p => p.mint));
    const list = (await candidates(c)).filter(p => !held.has(p.baseToken.address));
    if(!list.length){ say('nothing worth buying. suspicious.'); return save(); }
    list.sort((a, b) => score(c, b) - score(c, a));
    await buy(list[0], size);
    save();
  }
  return { init, step, status, get state(){ return st; }, notify };
}

export async function main(){
  const file = path.resolve(process.argv[2] || 'elonstein-agent.config.json');
  if(!fs.existsSync(file)){ console.error(`Config not found: ${file}\nDownload it from the Agent Lab on the $ELONSTEIN site.`); process.exit(1); }
  const c = loadConfig(file);
  const agent = createAgent(c, { dir: path.dirname(file) });
  await agent.init();
  let errors = 0;
  process.on('SIGINT', () => { console.log(`\n${c.name}: Stopped. You’ll miss me.`); process.exit(0); });
  for(;;){
    try{ await agent.step(); errors = 0; }
    catch(e){
      errors++;
      console.log(`[${now()}] error: ${e.message}`);
      if(errors === 3) agent.notify(`Something broke: ${e.message}. Pausing for a bit.`);
      if(errors >= 3) await sleep(10 * 60_000);
    }
    await sleep(c.intervalSec * 1000);
  }
}

if(process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main();
