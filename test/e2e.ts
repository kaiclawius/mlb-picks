// Browser-Durchlauf mit echter App, echtem Bundle und einer Mock-Wallet (Wallet-Standard) gegen eine Fake-Blockchain.
// Start: npm run e2e   (Screenshots landen in E2E_OUT, Standard: ./data/e2e)
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { serve } from '@hono/node-server';
import { VersionedTransaction } from '@solana/web3.js';
import bs58 from 'bs58';
import nacl from 'tweetnacl';
import { chromium } from 'playwright-core';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { openDb } from '../src/db.js';
import { bondingCurveOf, PUMP_MINT_AUTHORITY, TOKEN_2022_PROGRAM } from '../src/transparency.js';
import { kp, MockChain, PNG } from './helpers.js';

const out = process.env.E2E_OUT ?? join(process.cwd(), 'data', 'e2e');
mkdirSync(out, { recursive: true });

const freePort = () => new Promise<number>((res) => { const s = createServer().listen(0, () => { const p = (s.address() as { port: number }).port; s.close(() => res(p)); }); });
const port = await freePort();
const user = kp();
const chain = new MockChain();
chain.balances.set(user.publicKey.toBase58(), 5000);

const cfg = loadConfig({
  PUBLIC_URL: `http://localhost:${port}`, SESSION_SECRET: 'e'.repeat(40), DATA_DIR: mkdtempSync(join(tmpdir(), 'e2e-')),
  GATE_MINT: kp().publicKey.toBase58(), GATE_TIERS: '100:1,1000:5',
});
const app = createApp({
  cfg, db: openDb(':memory:'), rpc: chain.rpc,
  generate: async ({ idea, name, symbol }) => ({
    name: name || 'Bürokratius', symbol: (symbol || 'AMT').toUpperCase(), tagline: 'Formular 7b bitte.', about: idea,
    features: [{ title: 'Ablehnung', text: 'Jeder Antrag wird geprüft und abgelehnt.' }, { title: 'Stempel', text: 'Mit Stempel, versteht sich.' }, { title: 'Wartezeit', text: 'Dauert.' }],
    mode: 'dark', accent: '#f59f00',
  }),
  moderate: async () => ({ allowed: true, reasons: [] }),
});
const server = serve({ fetch: app.fetch, port });

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium' });
const problems: string[] = [];
try {
  const ctx = await browser.newContext({ viewport: { width: 420, height: 900 } });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) problems.push(`console ${m.type()}: ${m.text()}`); });
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));

  // Die Wallet lebt im Browser, signiert aber mit dem Schlüssel aus Node. So bleibt der Schlüssel außerhalb der Seite.
  await page.exposeFunction('__signMessage', (b64: string) =>
    Buffer.from(nacl.sign.detached(Buffer.from(b64, 'base64'), user.secretKey)).toString('base64'));
  await page.exposeFunction('__signAndSend', (b64: string) => {
    const tx = VersionedTransaction.deserialize(Buffer.from(b64, 'base64'));
    const mint = tx.message.staticAccountKeys[1].toBase58();
    const signature = chain.land(b64, user);
    chain.accounts.set(mint, { owner: TOKEN_2022_PROGRAM, data: { parsed: { type: 'mint', info: { mintAuthority: PUMP_MINT_AUTHORITY, freezeAuthority: null, supply: '1000000000000000', decimals: 6, extensions: [{ extension: 'metadataPointer' }] } } } });
    chain.largest = [{ address: 'curveAcc', amount: '1000000000000000' }];
    chain.accounts.set('curveAcc', { data: { parsed: { info: { owner: bondingCurveOf(mint) } } } });
    return bs58.encode(bs58.decode(signature));
  });
  // Als String statt Funktion, damit der Transpiler keine Hilfsfunktionen einschleust, die es im Browser nicht gibt
  await page.addInitScript(`(() => {
    const address = ${JSON.stringify(user.publicKey.toBase58())};
    const A = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    const toB64 = (u) => btoa(Array.from(u, (x) => String.fromCharCode(x)).join(''));
    const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
    const b58d = (s) => {
      let n = 0n; for (const c of s) n = n * 58n + BigInt(A.indexOf(c));
      const bytes = []; while (n > 0n) { bytes.unshift(Number(n & 255n)); n >>= 8n; }
      for (const c of s) { if (c === '1') bytes.unshift(0); else break; }
      return Uint8Array.from(bytes);
    };
    const account = { address, publicKey: b58d(address), chains: ['solana:mainnet'], features: ['solana:signMessage', 'solana:signAndSendTransaction'] };
    const wallet = {
      version: '1.0.0', name: 'MockWallet', icon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciLz4=',
      chains: ['solana:mainnet'], accounts: [account],
      features: {
        'standard:connect': { version: '1.0.0', connect: async () => ({ accounts: [account] }) },
        'standard:events': { version: '1.0.0', on: () => () => {} },
        'solana:signMessage': { version: '1.0.0', signMessage: async (...inputs) => Promise.all(inputs.map(async (i) => ({
          signedMessage: i.message, signature: fromB64(await window.__signMessage(toB64(i.message))) }))) },
        'solana:signAndSendTransaction': { version: '1.0.0', supportedTransactionVersions: ['legacy', 0], signAndSendTransaction: async (...inputs) => Promise.all(inputs.map(async (i) => ({
          signature: b58d(await window.__signAndSend(toB64(i.transaction))) }))) },
      },
    };
    const register = (api) => api.register(wallet);
    window.addEventListener('wallet-standard:app-ready', (e) => register(e.detail));
    window.dispatchEvent(new CustomEvent('wallet-standard:register-wallet', { detail: register }));
  })();`);

  const base = `http://localhost:${port}`;
  await page.goto(base);
  await page.waitForSelector('text=MockWallet');
  assert.equal(await page.isVisible('#formCard'), false, 'Formular ist vor dem Login verborgen');
  await page.screenshot({ path: join(out, '1-start.png'), fullPage: true });

  await page.click('button:has-text("MockWallet")');
  await page.waitForSelector('#access .badge.ok');
  assert.match(await page.textContent('#access') ?? '', /5 von 5 Launches/);
  assert.equal(await page.isVisible('#formCard'), true);

  await page.fill('textarea[name=idea]', 'Ein Beamter, der jeden Antrag ablehnt, und das Formular 7b.');
  await page.fill('input[name=name]', 'Bürokratius');
  await page.fill('input[name=symbol]', 'amt');
  await page.setInputFiles('input[name=images]', { name: 'logo.png', mimeType: 'image/png', buffer: PNG });
  await page.check('input[name=rights]');
  await page.click('#draftBtn');
  await page.waitForSelector('#launchCard:not(.hidden)');
  await page.waitForFunction(() => document.getElementById('msg')?.textContent?.includes('Vorschau ist fertig'));
  assert.equal(await page.isEnabled('#deployBtn'), false, 'Deploy erst nach beiden Bestätigungen');
  const frame = page.frameLocator('#preview');
  await frame.locator('h1').waitFor();
  assert.equal(await frame.locator('h1').textContent(), 'Bürokratius');
  await page.screenshot({ path: join(out, '2-preview.png'), fullPage: true });

  await page.check('#ack1');
  assert.equal(await page.isEnabled('#deployBtn'), false);
  await page.check('#ack2');
  await page.click('#deployBtn');
  await page.waitForSelector('#result:not(.hidden)', { timeout: 20_000 });
  const mint = (await page.textContent('#result code'))!.trim();
  assert.match(mint, /^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
  assert.equal(await page.getAttribute('#result a:has-text("pump.fun")', 'href'), `https://pump.fun/coin/${mint}`);
  const siteHref = (await page.getAttribute('#result a:has-text("Deine Seite")', 'href'))!;
  await page.screenshot({ path: join(out, '3-launched.png'), fullPage: true });
  assert.match(await page.textContent('#sites') ?? '', /gestartet/);

  // Veröffentlichte Seite mit Live-Check
  const site = await ctx.newPage();
  site.on('console', (m) => { if (['error', 'warning'].includes(m.type())) problems.push(`site console ${m.type()}: ${m.text()}`); });
  await site.goto(siteHref);
  await site.waitForSelector('#check li.pass');
  const checks = await site.locator('#check li').allTextContents();
  assert.equal(checks.length, 4, checks.join(' | '));
  assert.ok(checks[0].includes('Mint-Authority'));
  await site.screenshot({ path: join(out, '4-site.png'), fullPage: true });

  // Abmelden
  await page.click('#logout');
  await page.waitForSelector('#walletList button');
  assert.equal(await page.isVisible('#launchCard'), false);

  // Nach dem Logout sind App-Daten nicht mehr lesbar
  assert.deepEqual(await (await ctx.request.get(`${base}/api/me`)).json(), { address: null });

  assert.deepEqual(problems, [], `Konsolenfehler oder CSP-Verstöße:\n${problems.join('\n')}`);
  console.log(`E2E erfolgreich. Mint ${mint}. Screenshots: ${out}`);
} finally {
  await browser.close();
  server.close();
}
process.exit(0);
